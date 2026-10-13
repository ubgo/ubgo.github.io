#!/bin/sh
# Preview server for portless: portless sets PORT; Hugo does not read it, so pass it on.
# Public URL is https://ubgo.shipd.fyi (TLS ends at the tunnel, so live reload uses 443).
# It writes to .preview-out/ so a production build into public/ never clobbers it.
# The Tailwind CLI watches the templates and rewrites assets/css/site.css; Hugo reloads on it.
set -e
BIN="$HOME/.local/bin"
"$BIN/tailwindcss" -i assets/css/main.css -o assets/css/site.css --minify
"$BIN/tailwindcss" -i assets/css/main.css -o assets/css/site.css --minify --watch=always &
TW=$!
trap 'kill $TW 2>/dev/null' EXIT INT TERM
"$BIN/hugo" server --bind 127.0.0.1 --port "${PORT:?PORT not set}" \
  --baseURL https://ubgo.shipd.fyi/ --appendPort=false --liveReloadPort 443 \
  --environment preview --disableFastRender --destination .preview-out
