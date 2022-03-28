#!/bin/bash

# Prepare script for the kalix-javascript-sdk package

# get the framework version from config.json
readonly framework_version=$(node --print 'require("./config.json").frameworkVersion')

function download_protocol {
  local module="$1"
  mkdir -p ./proto
  curl -OL "https://repo1.maven.org/maven2/com/akkaserverless/akkaserverless-$module-protocol/$framework_version/akkaserverless-$module-protocol-$framework_version.zip"
  unzip "akkaserverless-$module-protocol-$framework_version.zip"
  cp -r "akkaserverless-$module-protocol-$framework_version"/* proto
  rm -rf "akkaserverless-$module-protocol-$framework_version.zip" "akkaserverless-$module-protocol-$framework_version"
}

# Need to delete the proto directory and generated files to rebuild (including local snapshot versions)
if [ -d "./proto" ] ; then
  echo "Protocol already built ('npm run clean' first to fetch and compile again)"
  echo
else
  if [ -n "$PROXY_SNAPSHOT_DIRECTORY" ]; then
     # Use local proxy and sdk sources, useful for development, point PROXY_SNAPSHOTS_DIRECTORY to the local
     # proxy project source directory
     echo "Using snapshot of proxy and sdk protocols from '$PROXY_SNAPSHOT_DIRECTORY'"
     cp -rf $PROXY_SNAPSHOT_DIRECTORY/protocols/proxy/src/main/protobuf/* ./proto/
     cp -rf $PROXY_SNAPSHOT_DIRECTORY/protocols/sdk/src/main/protobuf/* ./proto/
   else
     # Download and unzip the proxy and SDK protocols to the proto directory
     download_protocol proxy
     download_protocol sdk
   fi
fi

# Compile protobuf
./bin/compile-protobuf.sh

# Generate TS type definitions based on the JSDocs
echo "Generating TS type definitions based on JSDocs"
cp index.d.preamble.ts index.d.ts
jsdoc -t ./node_modules/@lightbend/tsd-jsdoc/dist -c ./jsdoc.json -d .
cat types.d.ts >> index.d.ts && rm -f types.d.ts
echo "Applying search-replace no generated TS to fix 'module:' entries"
# There replacements are quite dirty, but even the patched tsd-jsdoc generator can't deal with these (mostly module related) issues currently
perl -i -pe 's/declare module \"kalix\"/declare module \"\@lightbend\/kalix-javascript-sdk\"/g' index.d.ts
perl -i -pe 's/module:kalix\.//g' index.d.ts
perl -i -pe 's/import\("kalix"\).([a-zA-Z]*)/$1/g' index.d.ts
perl -i -pe 's/import\("kalix\.([a-zA-Z.|]*)\"\).(?!default\W)([a-zA-Z]*)/$1.$2/g' index.d.ts
perl -i -pe 's/import\("kalix\.([a-zA-Z.|]*)\"\).default/$1/g' index.d.ts
