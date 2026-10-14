#!/bin/sh
# Usage: fetch-facts.sh <clones-dir> <libraries.yaml>
# Brings one shallow clone plus a <name>.tags file per public repo up to date over https
# (public repos need no auth). The link from some build hosts to GitHub drops connections
# at random, so every git call has a hard timeout and is retried; a repo that still fails
# after all attempts fails the whole run, so stale facts are never written silently.
set -u
ATTEMPTS=${FETCH_ATTEMPTS:-6}   # per git call
TIMEOUT=${FETCH_TIMEOUT:-45}    # seconds per attempt; a healthy fetch takes about a second
PARALLEL=${FETCH_PARALLEL:-4}
export GIT_TERMINAL_PROMPT=0

# retry <cmd...>: run with a timeout until it succeeds or the attempts run out.
retry() {
  n=1
  while [ "$n" -le "$ATTEMPTS" ]; do
    timeout "$TIMEOUT" "$@" && return 0
    n=$((n + 1))
    sleep 2
  done
  return 1
}

if [ "${1:-}" = "--one" ]; then
  CLONES=$2
  name=$3
  url=https://github.com/ubgo/$name.git
  cd "$CLONES" || exit 1
  if [ -d "$name/.git" ]; then
    retry git -C "$name" fetch -q --depth 1 origin && git -C "$name" reset -q --hard FETCH_HEAD || { echo "FAILED fetch $name" >&2; exit 1; }
  else
    rm -rf "$name"
    retry git clone -q --depth 1 "$url" "$name" || { echo "FAILED clone $name" >&2; exit 1; }
  fi
  retry sh -c "git ls-remote --tags $url > $name.tags.tmp" && mv "$name.tags.tmp" "$name.tags" || { echo "FAILED tags $name" >&2; exit 1; }
  exit 0
fi

CLONES=$1
LIBS=$2
mkdir -p "$CLONES"
export ATTEMPTS TIMEOUT
grep -oE "^ +- name: [a-z0-9-]+" "$LIBS" | awk "{print \$3}" | \
  xargs -P "$PARALLEL" -I{} sh "$0" --one "$CLONES" {}
