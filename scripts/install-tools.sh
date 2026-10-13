#!/bin/sh
# Installs pinned Hugo extended + Tailwind standalone CLI into $3 (no root), after
# checking each download against the release's published SHA-256 checksums.
# Usage: install-tools.sh <hugo-version> <tailwind-version> <bin-dir>
set -eu
HV=$1; TV=$2; BIN=$3
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) HA=linux-amd64; TA=linux-x64 ;;
  Linux-aarch64) HA=linux-arm64; TA=linux-arm64 ;;
  Darwin-*) HA=darwin-universal; TA=macos-$( [ "$(uname -m)" = arm64 ] && echo arm64 || echo x64) ;;
  *) echo "unsupported platform $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
H=hugo_extended_${HV}_${HA}.tar.gz
curl -fsSLO "https://github.com/gohugoio/hugo/releases/download/v${HV}/${H}"
curl -fsSLO "https://github.com/gohugoio/hugo/releases/download/v${HV}/hugo_${HV}_checksums.txt"
grep " ${H}\$" "hugo_${HV}_checksums.txt" | sha256sum -c -
tar xzf "$H" hugo
T=tailwindcss-${TA}
curl -fsSLO "https://github.com/tailwindlabs/tailwindcss/releases/download/v${TV}/${T}"
curl -fsSLO "https://github.com/tailwindlabs/tailwindcss/releases/download/v${TV}/sha256sums.txt"
grep -E " (\./)?${T}\$" sha256sums.txt | sed 's#\./##' | sha256sum -c -
mkdir -p "$BIN"
install -m 755 hugo "$BIN/hugo"
install -m 755 "$T" "$BIN/tailwindcss"
"$BIN/hugo" version
