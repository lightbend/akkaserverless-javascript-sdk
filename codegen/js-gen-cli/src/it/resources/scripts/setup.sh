#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Set up and install our npm-js tooling
pushd kalix-npm-js

pushd kalix-scripts
# Disable download of codegen CLI, and manually add our version
mv package.json original-package.json
node /home/scripts/disable-download-cli.js original-package.json > package.json
cp /home/kalix-codegen-js bin/kalix-codegen-js.bin

# Use npm link to make this available within the container
npm install
npm link
popd

pushd create-kalix-entity
# Install create-kalix-entity globally within the container
npm install
npm pack
npm i -g lightbend-create-kalix-entity-1.0.0.tgz
popd

popd
