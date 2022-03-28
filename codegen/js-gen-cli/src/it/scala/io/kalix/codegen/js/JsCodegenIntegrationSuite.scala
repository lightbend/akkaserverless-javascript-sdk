/*
 * Copyright (c) Lightbend Inc. 2021
 *
 */

package io.kalix.codegen.js

import scala.io.Source
import scala.util.Using
import java.io.PrintWriter
import java.nio.file.{ Files, Paths }
import java.util.concurrent.TimeUnit.MINUTES

import com.typesafe.config.ConfigFactory
import org.slf4j.LoggerFactory
import org.testcontainers.containers.{ Container, GenericContainer, Network }
import org.testcontainers.containers.output.Slf4jLogConsumer
import org.testcontainers.images.builder.ImageFromDockerfile
import org.testcontainers.utility.MountableFile

class JsCodegenIntegrationSuite extends munit.FunSuite {
  val config = ConfigFactory.load()
  val npmJsPath = Paths.get(config.getString("kalix-npm-js.path"))
  val cliImagePath = Paths.get(config.getString("js-codegen-cli.native-image"))
  val proxyImage = config.getString("kalix-proxy.image")
  val logger = LoggerFactory.getLogger(classOf[JsCodegenIntegrationSuite])
  logger.info(cliImagePath.toString)
  val codegenImage =
    new ImageFromDockerfile("kalix-codegen-js-test", /* deleteOnExit */ false)
      .withFileFromClasspath("Dockerfile", "Dockerfile")
      .withFileFromClasspath("scripts", "scripts")
      .withFileFromPath("kalix-codegen-js", cliImagePath)
      .withFileFromPath("kalix-npm-js", npmJsPath)

  class AkkaslsJsCodegenContainer extends GenericContainer[AkkaslsJsCodegenContainer](codegenImage)

  class AkkaslsProxyContainer extends GenericContainer[AkkaslsProxyContainer](proxyImage)

  val logConsumer = new Slf4jLogConsumer(logger);
  logger.info("Waiting for docker image to be built. This can take several minutes")
  // We manually await the docker image to avoid timeouts waiting on Maven install
  val imageName = codegenImage.get(10, MINUTES)
  logger.info(s"Docker image built and tagged as [${imageName}]")

  // Define simple dockerised deployment with proxy and container for generated project
  val network = Network.newNetwork()
  val codegenContainer =
    new AkkaslsJsCodegenContainer()
      .withNetwork(network)
      .withNetworkAliases("generated-entity")
      .withEnv("HOST", "0.0.0.0")
  val proxyContainer = new AkkaslsProxyContainer()
    .withNetwork(network)
    .withNetworkAliases("proxy")
    .withExposedPorts(9000)
    .withEnv("USER_FUNCTION_HOST", "generated-entity")
    .withEnv("USER_FUNCTION_PORT", "8080")

  // Start the codegen container (the proxy fails its health checks until a service is available)
  codegenContainer.start()

  test("verify unmodified generated event-sourced entity") {
    val entityName = "unmodified-eventsourced-entity"

    // Generate a new entity within the codegen container
    assertSuccessful(
      codegenContainer.execInContainer("create-kalix-entity", entityName, "--template", "event-sourced-entity"))

    // Setup and build the entity
    assertSuccessful(codegenContainer.execInContainer("./scripts/setup-entity.sh", entityName))
    // Start the entity gRPC server
    assertSuccessful(codegenContainer.execInContainer("./scripts/start-entity.sh", entityName))

    // Start the proxy
    proxyContainer.start()
    val proxyUrl = s"http://${proxyContainer.getHost}:${proxyContainer.getMappedPort(9000)}"

    // Eventually, a GetValue request should return a 500 error, with our generated error message
    var getResult = retryUntil[requests.Response](_.statusCode == 500) {
      requests.post(
        s"$proxyUrl/com.example.MyServiceEntity/GetValue",
        check = false,
        data = """{"entityId": "test-entity-id"}""",
        headers = Map("Content-Type" -> "application/json"))
    }
    assertEquals(getResult.statusCode, 500)
    assertEquals(getResult.text(), "The command handler for `GetValue` is not implemented, yet")

    // Kill the gRPC server, and stop the proxy
    assertSuccessful(codegenContainer.execInContainer("./scripts/stop-entity.sh", entityName))
    proxyContainer.stop()
  }

  test("verify simple implementation of event-sourced entity") {
    val entityName = "simple-impl-eventsourced-entity"

    // Generate a new entity within the codegen container
    assertSuccessful(
      codegenContainer.execInContainer("create-kalix-entity", entityName, "--template", "event-sourced-entity"))

    // Setup and build the entity
    assertSuccessful(codegenContainer.execInContainer("./scripts/setup-entity.sh", entityName))

    // Stream generated MyEntityImpl, and replace function bodies with simple implementations
    val implFile = Files.createTempFile("generated-entity-impl", ".js")
    val implContainerPath =
      s"/home/${entityName}/src/myentity.js"
    Using(new PrintWriter(implFile.toFile())) { writer =>
      codegenContainer.copyFileFromContainer(
        implContainerPath,
        Source
          .fromInputStream(_)
          .getLines()
          .flatMap {
            case """      return ctx.fail("The command handler for `GetValue` is not implemented, yet");""" =>
              Seq("""      return state;""")
            case """      return ctx.fail("The command handler for `SetValue` is not implemented, yet");""" =>
              Seq("""      ctx.emit({ type: "ValueSet", value: command.value });""", """      return {};""")
            case """      return state;""" =>
              Seq("""        return { value: event.value };""")
            case line => Seq(line)
          }
          .foreach { line =>
            println(line)
            writer.write(s"${line}\n")
          })
    }
    codegenContainer.copyFileToContainer(MountableFile.forHostPath(implFile), implContainerPath)

    // Start the entity gRPC server
    assertSuccessful(codegenContainer.execInContainer("./scripts/start-entity.sh", entityName))

    // Start the proxy
    proxyContainer.start()
    val proxyUrl = s"http://${proxyContainer.getHost}:${proxyContainer.getMappedPort(9000)}"

    // Eventually, a GetValue request should return a 200 OK
    var getResult = retryUntil[requests.Response](_.statusCode == 200) {
      requests.post(
        s"$proxyUrl/com.example.MyServiceEntity/GetValue",
        check = false,
        data = """{"entityId": "test-entity-id"}""",
        headers = Map("Content-Type" -> "application/json"))
    }
    assertEquals(getResult.statusCode, 200)
    assertEquals(getResult.text(), """{"value":0}""")

    val newValue = 42;

    val setResult = requests.post(
      s"$proxyUrl/com.example.MyServiceEntity/SetValue",
      check = false,
      data = s"""{"entityId": "test-entity-id", "value": ${newValue}}""",
      headers = Map("Content-Type" -> "application/json"))
    assertEquals(setResult.statusCode, 200)

    val getAgainResult =
      requests.post(
        s"$proxyUrl/com.example.MyServiceEntity/GetValue",
        check = false,
        data = """{"entityId": "test-entity-id"}""",
        headers = Map("Content-Type" -> "application/json"))
    assertEquals(getAgainResult.statusCode, 200)
    assertEquals(getAgainResult.text(), s"""{"value":${newValue}}""")

    // Kill the gRPC server, and stop the proxy
    assertSuccessful(codegenContainer.execInContainer("./scripts/stop-entity.sh", entityName))
    proxyContainer.stop()
  }

  test("verify unmodified generated value entity") {
    val entityName = "unmodified-value-entity"

    // Generate a new entity within the codegen container
    assertSuccessful(
      codegenContainer.execInContainer("create-kalix-entity", entityName, "--template", "event-sourced-entity"))

    // Overwrite the domain with a value entity definition
    codegenContainer.copyFileToContainer(
      MountableFile.forClasspathResource("proto/value-entity-domain.proto"),
      s"/home/$entityName/proto/myentity_domain.proto")

    // Setup and build the entity
    assertSuccessful(codegenContainer.execInContainer("./scripts/setup-entity.sh", entityName))

    // Start the entity gRPC server
    assertSuccessful(codegenContainer.execInContainer("./scripts/start-entity.sh", entityName))

    // Start the proxy
    proxyContainer.start()
    val proxyUrl = s"http://${proxyContainer.getHost}:${proxyContainer.getMappedPort(9000)}"

    // Eventually, a GetValue request should return a 500 error, with our generated error message
    var getResult = retryUntil[requests.Response] { r =>
      println(r.toString())
      r.statusCode == 500
    } {
      requests.post(
        s"$proxyUrl/com.example.MyServiceEntity/GetValue",
        check = false,
        data = """{"entityId": "test-entity-id"}""",
        headers = Map("Content-Type" -> "application/json"))
    }
    assertEquals(getResult.statusCode, 500)
    assertEquals(getResult.text(), "The command handler for `GetValue` is not implemented, yet")

    // Kill the gRPC server, and stop the proxy
    assertSuccessful(codegenContainer.execInContainer("./scripts/stop-entity.sh", entityName))
    proxyContainer.stop()
  }

  test("verify simple implementation of value entity") {
    val entityName = "simple-impl-value-entity"

    // Generate a new entity within the codegen container
    assertSuccessful(
      codegenContainer.execInContainer("create-kalix-entity", entityName, "--template", "event-sourced-entity"))

    // Overwrite the domain with a value entity definition
    codegenContainer.copyFileToContainer(
      MountableFile.forClasspathResource("proto/value-entity-domain.proto"),
      s"/home/$entityName/proto/myentity_domain.proto")

    // Setup and build the entity
    assertSuccessful(codegenContainer.execInContainer("./scripts/setup-entity.sh", entityName))

    // Stream generated MyEntityImpl, and replace function bodies with simple implementations
    val implFile = Files.createTempFile("generated-entity-impl", ".js")
    val implContainerPath =
      s"/home/${entityName}/src/myentity.js"
    Using(new PrintWriter(implFile.toFile())) { writer =>
      codegenContainer.copyFileFromContainer(
        implContainerPath,
        Source
          .fromInputStream(_)
          .getLines()
          .flatMap {
            case """    return ctx.fail("The command handler for `GetValue` is not implemented, yet");""" =>
              Seq("""    return state;""")
            case """    return ctx.fail("The command handler for `SetValue` is not implemented, yet");""" =>
              Seq("""    ctx.updateState({ type: "MyState", value: command.value });""", """    return {};""")
            case line => Seq(line)
          }
          .foreach { line =>
            println(line)
            writer.write(s"${line}\n")
          })
    }
    codegenContainer.copyFileToContainer(MountableFile.forHostPath(implFile), implContainerPath)

    assertSuccessful(codegenContainer.execInContainer("ps"))

    // Start the entity gRPC server
    assertSuccessful(codegenContainer.execInContainer("./scripts/start-entity.sh", entityName))

    // Start the proxy
    proxyContainer.start()
    val proxyUrl = s"http://${proxyContainer.getHost}:${proxyContainer.getMappedPort(9000)}"

    // Eventually, a GetValue request should return a 200 OK
    var getResult = retryUntil[requests.Response] { r =>
      println(r.toString())
      r.statusCode == 200
    } {
      requests.post(
        s"$proxyUrl/com.example.MyServiceEntity/GetValue",
        check = false,
        data = """{"entityId": "test-entity-id"}""",
        headers = Map("Content-Type" -> "application/json"))
    }
    assertEquals(getResult.statusCode, 200)
    assertEquals(getResult.text(), """{"value":0}""")

    val newValue = 42;

    val setResult = requests.post(
      s"$proxyUrl/com.example.MyServiceEntity/SetValue",
      check = false,
      data = s"""{"entityId": "test-entity-id", "value": ${newValue}}""",
      headers = Map("Content-Type" -> "application/json"))
    assertEquals(setResult.statusCode, 200)

    val getAgainResult =
      requests.post(
        s"$proxyUrl/com.example.MyServiceEntity/GetValue",
        check = false,
        data = """{"entityId": "test-entity-id"}""",
        headers = Map("Content-Type" -> "application/json"))
    assertEquals(getAgainResult.statusCode, 200)
    assertEquals(getAgainResult.text(), s"""{"value":${newValue}}""")

    // Kill the gRPC server, and stop the proxy
    assertSuccessful(codegenContainer.execInContainer("./scripts/stop-entity.sh", entityName))
    proxyContainer.stop()
  }

  /**
   * Action Services
   *
   * note: since an action without implementation can't gracefully report errors, we simply check it compiles before
   * making changes rather than running a dedicated unmodified action test
   */

  test("verify simple implementation of action") {
    val entityName = "simple-impl-action"

    // Generate a new entity within the codegen container
    assertSuccessful(
      codegenContainer.execInContainer("create-kalix-entity", entityName, "--template", "event-sourced-entity"))

    // Remove default proto definitions
    assertSuccessful(
      codegenContainer.execInContainer(
        "rm",
        s"/home/$entityName/proto/myentity_api.proto",
        s"/home/$entityName/proto/myentity_domain.proto"))

    // Replace proto with an action definition
    codegenContainer.copyFileToContainer(
      MountableFile.forClasspathResource("proto/action-service.proto"),
      s"/home/$entityName/proto/myactionservice_action.proto")

    // Setup and build the entity
    assertSuccessful(codegenContainer.execInContainer("./scripts/setup-entity.sh", entityName))

    // Stream generated action, and replace function bodies with simple implementations
    val implFile = Files.createTempFile("generated-service-impl", ".js")
    val implContainerPath =
      s"/home/${entityName}/src/myactionservice.js"
    Using(new PrintWriter(implFile.toFile())) { writer =>
      codegenContainer.copyFileFromContainer(
        implContainerPath,
        Source
          .fromInputStream(_)
          .getLines()
          .flatMap {
            case """    throw new Error("The command handler for `SingleMethod` is not implemented, yet");""" =>
              Seq("""    return { type: "Response", value: request.value + 1 };""")
            case """    throw new Error("The command handler for `StreamedMethod` is not implemented, yet");""" =>
              Seq(
                """    [...Array(request.value).keys()].forEach(i =>""",
                """      ctx.write({ type: "Response", value: i })""",
                """    );""",
                """    ctx.end();""")
            case line => Seq(line)
          }
          .foreach { line =>
            println(line)
            writer.write(s"${line}\n")
          })
    }
    codegenContainer.copyFileToContainer(MountableFile.forHostPath(implFile), implContainerPath)

    // Start the entity gRPC server
    assertSuccessful(codegenContainer.execInContainer("./scripts/start-entity.sh", entityName))

    // Start the proxy
    proxyContainer.start()
    val proxyUrl = s"http://${proxyContainer.getHost}:${proxyContainer.getMappedPort(9000)}"

    // Eventually, a SingleMethod request should return a 200 OK
    var getResult = retryUntil[requests.Response](_.statusCode == 200) {
      requests.post(
        s"$proxyUrl/com.example.MyActionService/SingleMethod",
        check = false,
        data = """{"value": 99}""",
        headers = Map("Content-Type" -> "application/json"))
    }
    assertEquals(getResult.statusCode, 200)
    assertEquals(getResult.text(), """{"value":100}""")

    val streamedResult = requests.post(
      s"$proxyUrl/com.example.MyActionService/StreamedMethod",
      check = false,
      data = """{"value": 3}""",
      headers = Map("Content-Type" -> "application/json"))
    assertEquals(streamedResult.statusCode, 200)

    assertEquals(
      streamedResult.text(),
      """|{"value":0}
         |{"value":1}
         |{"value":2}
         |""".stripMargin)

    // Kill the gRPC server, and stop the proxy
    assertSuccessful(codegenContainer.execInContainer("./scripts/stop-entity.sh", entityName))
    proxyContainer.stop()
  }

  def assertSuccessful(result: Container.ExecResult) = {
    val success = result.getExitCode() == 0
    if (!success) {
      logger.error(result.getStdout())
    }
    assert(success, () => result.getStderr())
  }

  def retryUntil[A](condition: A => Boolean, limit: Integer = 20, delay: Long = 1000)(function: => A): A =
    Some(function).filter(condition).getOrElse {
      if (limit > 0) {
        Thread.sleep(delay)
        retryUntil(condition, limit - 1, delay)(function)
      } else throw new Exception("Retry limit reached")
    }
}
