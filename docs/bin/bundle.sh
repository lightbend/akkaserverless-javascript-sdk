#!/usr/bin/env bash
#
# Bundle a sample project for download.
#
# Usage:
#   bundle.sh --zip <file> <dir>

set -euo pipefail

function _script_path {
  local source="${BASH_SOURCE[0]}"
  while [ -h "$source" ] ; do
    local linked="$(readlink "$source")"
    local dir="$(cd -P $(dirname "$source") && cd -P $(dirname "$linked") && pwd)"
    source="$dir/$(basename "$linked")"
  done
  echo ${source}
}

readonly script_path=$(_script_path)
readonly script_dir="$(cd -P "$(dirname "$script_path")" && pwd)"
readonly docs_dir="$(cd "$script_dir/.." && pwd)"
readonly build_dir="$docs_dir/build"
readonly bundle_dir="$build_dir/bundle"
readonly npm_dir="$build_dir/npm"
readonly json="$npm_dir/bin/json"

readonly sdk_version="$("$script_dir/version.sh")"

function _remove_doc_tags {
  local -r dir="$1"
  # note: use commands that are compatible with both GNU sed and BSD (macOS) sed
  find "$dir" -type f -exec sed -i.bak "/tag::[^\[]*\[.*\]/d" {} \; -exec rm -f {}.bak \;
  find "$dir" -type f -exec sed -i.bak "/end::[^\[]*\[.*\]/d" {} \; -exec rm -f {}.bak \;
  find "$dir" -type f -exec sed -i.bak "s/ *\/\/ *<[0-9][0-9]*>//g" {} \; -exec rm -f {}.bak \;
}

function _set_sdk_version {
  local -r dir="$1"
  # install json command once in a local dir
  [ -f "$json" ] || npm install --prefix "$npm_dir" -g json
  if [ -n "$("$json" -q -f "$dir/package.json" "dependencies['@kalix-io/kalix-javascript-sdk']")" ] ; then
    "$json" -q -I -f "$dir/package.json" -e "this.dependencies['@kalix-io/kalix-javascript-sdk'] = '$sdk_version'"
  fi
  if [ -n "$("$json" -q -f "$dir/package.json" "devDependencies['@kalix-io/kalix-scripts']")" ] ; then
    "$json" -q -I -f "$dir/package.json" -e "this.devDependencies['@kalix-io/kalix-scripts'] = '$sdk_version'"
  fi
  if [ -n "$("$json" -q -f "$dir/package.json" "devDependencies['@kalix-io/testkit']")" ] ; then
    "$json" -q -I -f "$dir/package.json" -e "this.devDependencies['@kalix-io/testkit'] = '$sdk_version'"
  fi
}

function _bundle {
  local zip
  local sample
  while [[ $# -gt 0 ]] ; do
    case "$1" in
      --zip | -z ) zip="$2" ; shift 2 ;;
      * ) sample=$1 ; shift ;;
    esac
  done

  [ -z "$zip" ] && echo "missing required argument for zip file" && exit 1
  [ -z "$sample" ] && echo "missing required argument for sample directory" && exit 1

  mkdir -p "$bundle_dir"
  mkdir -p "$(dirname $zip)"

  local -r sample_name="$(basename "$sample")"
  local -r sample_bundle_dir="$bundle_dir/$sample_name"
  local -r zip_dir="$(cd -P "$(dirname "$zip")" && pwd)"
  local -r zip_file="$zip_dir/$(basename "$zip")"

  rsync -a --exclude-from "$sample/.bundleignore" --exclude ".bundleignore" "$sample"/ "$sample_bundle_dir"/

  _remove_doc_tags "$sample_bundle_dir"
  _set_sdk_version "$sample_bundle_dir"

  pushd "$sample_bundle_dir" > /dev/null
  zip -q -r "$zip_file" .
  popd > /dev/null

  echo "Bundled $sample as $zip"
}

_bundle "$@"
