/*
 * Copyright (c) Lightbend Inc. 2021
 *
 */

package io.kalix.codegen

import java.io.FileInputStream
import java.io.FileNotFoundException
import java.io.IOException
import java.io.InputStream
import java.util.logging.Level
import java.util.logging.Logger

import scala.jdk.CollectionConverters._
import scala.util.Failure
import scala.util.Success
import scala.util.Using

import com.google.protobuf.ExtensionRegistry
import com.google.protobuf.DescriptorProtos
import com.google.protobuf.Descriptors

/**
 * Provides conveniences for reading and parsing Protobuf descriptor sets
 *
 * Copy from JVM SDK
 */
object DescriptorSet {

  /**
   * The descriptor file cannot be opened
   */
  final case class CannotOpen(e: Throwable)

  /**
   * Various error conditions during a read
   */
  sealed abstract class ReadFailure
  case class CannotRead(e: IOException) extends ReadFailure
  case class CannotValidate(e: Descriptors.DescriptorValidationException) extends ReadFailure

  /**
   * Read Protobuf FileDescriptor objects from given a file hosting a DescriptorSet
   * @param file
   *   the file to read
   * @return
   *   a collection of FileDescriptor objects or an error condition
   */
  def fileDescriptors(
      file: java.io.File): Either[CannotOpen, Either[ReadFailure, Iterable[Descriptors.FileDescriptor]]] =
    Using[FileInputStream, Either[CannotOpen, Either[ReadFailure, Iterable[Descriptors.FileDescriptor]]]](
      new FileInputStream(file)) { fis => descriptors(fis) } match {
      case Success(result)                   => result
      case Failure(e: FileNotFoundException) => Left(CannotOpen(e))
      case Failure(e)                        => throw e
    }

  @SuppressWarnings(Array("org.wartremover.warts.Throw"))
  def descriptors(is: InputStream): Either[CannotOpen, Either[ReadFailure, Iterable[Descriptors.FileDescriptor]]] = {
    val registry = ExtensionRegistry.newInstance()
    registry.add(kalix.Annotations.codegen)
    registry.add(kalix.Annotations.service)
    registry.add(kalix.Annotations.file)
    registry.add(kalix.Annotations.method)

    Right(try {
      val descriptorProtos =
        DescriptorProtos.FileDescriptorSet.parseFrom(is, registry).getFileList.asScala

      val empty: Either[ReadFailure, Iterable[Descriptors.FileDescriptor]] =
        Right(Array[Descriptors.FileDescriptor]())
      descriptorProtos.foldLeft(empty)((acc, file) => accumulatedBuildFrom(acc, file))
    } catch {
      case e: IOException =>
        Left(CannotRead(e))
    })
  }

  private val descriptorslogger = Logger.getLogger(classOf[Descriptors].getName)
  descriptorslogger.setLevel(Level.OFF); // Silence protobuf

  /**
   * This method accumulates `FileDescriptor`s to provide all the necessary dependencies for each call to
   * FileDescriptor.buildFrom. Otherwise placeholders (mocked references) get created instead and these can't function
   * as proper dependencies. Chiefly as imports.
   *
   * see allowUnknownDependencies per
   * https://github.com/protocolbuffers/protobuf/blob/ae26a81918fa9e16f64ac27b5a2fb2b110b7aa1b/java/core/src/main/java/com/google/protobuf/Descriptors.java#L286
   */
  private def accumulatedBuildFrom(
      reads: Either[ReadFailure, Iterable[Descriptors.FileDescriptor]],
      file: DescriptorProtos.FileDescriptorProto): Either[ReadFailure, Iterable[Descriptors.FileDescriptor]] = {
    reads match {
      case Left(_) => reads
      case Right(fileDescriptors) =>
        try {
          Right(fileDescriptors ++ List(Descriptors.FileDescriptor.buildFrom(file, fileDescriptors.toArray, true)))
        } catch {
          case e: Descriptors.DescriptorValidationException =>
            Left(CannotValidate(e))
        }
    }
  }

}
