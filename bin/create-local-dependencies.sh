#!/usr/bin/env bash
## This script sets the dependencies for the `samples` so you can
## modify in local the SDK and test it on a sample.
## It can also include your local kalix-proxy if PROXY_SNAPSHOT_DIRECTORY is set

 if [[ "${PROXY_SNAPSHOT_DIRECTORY}" ]]; then
    echo "PROXY_SNAPSHOT_DIRECTORY is set to [${PROXY_SNAPSHOT_DIRECTORY}]"
    echo "using your local kalix-proxy project to generate the SDK"
else 
	 echo "PROXY_SNAPSHOT_DIRECTORY is not set"
	 echo "when set you can use your local kalix-proxy project to generate the SDK"
	 cd sdk && framework_version=$(node --print 'require("./config.json").frameworkVersion') && cd ..
	 echo "you are downloading kalix-proxy [${framework_version}] to generate the SDK"
fi

export KALIXJSSDK=${PWD}

# generate kalix-io-kalix-scripts-0.0.0.tgz
cd codegen
sbt kalix-codegen-js-cli/nativeImage
cd ${KALIXJSSDK}/npm-js/kalix-scripts
export KALIX_NPMJS_CODEGEN_BINARY="$KALIXJSSDK/codegen/js-gen-cli/target/native-image/kalix-codegen-js"
nvm use 14
npm install
npm pack

# generate sdk kalix-io-kalix-javascript-sdk-0.0.0.tgz
cd ${KALIXJSSDK}/sdk
nvm use 14
npm run clean
npm run prepare # note tha bin/prepare.sh has * in lines 29 and 30. that is not working in iOS
npm install
npm pack

# generate testkit kalix-io-testkit-0.0.0.tgz
cd ${KALIXJSSDK}/testkit
nvm use 14
npm install ${KALIXJSSDK}/sdk/kalix-io-kalix-javascript-sdk-0.0.0.tgz
npm pack
