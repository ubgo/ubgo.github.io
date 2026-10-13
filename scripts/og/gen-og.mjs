// Builds one 1280x640 social card per library into static/og/<name>.png, in the
// style of the brand card (brand/og-card.svg): Socket icon, library name, summary,
// area and install line. Reads data/libraries.yaml and data/brand.json, so cards
// change only when the data does. Text is outlined with opentype.js, so resvg needs
// no installed fonts. Run: `task og` (or `node gen-og.mjs` in this folder).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Resvg } from "@resvg/resvg-js"
import opentype from "opentype.js"
import YAML from "yaml"

const HERE = dirname(fileURLToPath(import.meta.url))
const SITE = join(HERE, "..", "..")
const OUT = join(SITE, "static", "og")
const data = YAML.parse(readFileSync(join(SITE, "data", "libraries.yaml"), "utf8"))
const brand = JSON.parse(readFileSync(join(SITE, "data", "brand.json"), "utf8"))
const C = brand.colors
const font = (pkg, file) => opentype.loadSync(join(HERE, "node_modules/@fontsource", pkg, "files", file))
const MONO_B = font("jetbrains-mono", "jetbrains-mono-latin-700-normal.woff")
const MONO = font("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff")
const DISPLAY = font("space-grotesk", "space-grotesk-latin-700-normal.woff")
const SANS = font("inter", "inter-latin-400-normal.woff")
const SANS_M = font("inter", "inter-latin-500-normal.woff")

const W = 1280
const H = 640
const TEXT_X = 112
const TEXT_MAX = W - TEXT_X - 112

function advance(f, str, size, ls = 0) {
  let w = 0
  for (const ch of str) w += (f.charToGlyph(ch).advanceWidth / f.unitsPerEm) * size + ls
  return w - ls
}

function path(f, str, x, y, size, fill, ls = 0) {
  let d = ""
  let cx = x
  for (const ch of str) {
    const g = f.charToGlyph(ch)
    d += g.getPath(cx, y, size).toPathData(2)
    cx += (g.advanceWidth / f.unitsPerEm) * size + ls
  }
  return `<path d="${d}" fill="${fill}"/>`
}

// Greedy word wrap to maxWidth; the last allowed line gets an ellipsis if cut.
function wrap(f, text, size, maxWidth, maxLines) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ""
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (advance(f, next, size) <= maxWidth) line = next
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (advance(f, `${last}…`, size) > maxWidth) last = last.replace(/\s*\S+$/, "")
    kept[maxLines - 1] = `${last}…`
    return kept
  }
  return lines
}

// Fit a single line by shrinking the font size down to a floor.
function fit(f, text, size, maxWidth, floor) {
  let s = size
  while (s > floor && advance(f, text, s) > maxWidth) s -= 2
  return s
}

const icon = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s / 512})">
  <rect width="512" height="512" rx="112" fill="url(#ic)"/>
  <path d="M176 140 V276 a80 80 0 0 0 160 0 V140" stroke="${C.fg}" stroke-width="64" stroke-linecap="round" fill="none"/>
  <rect x="226" y="202" width="60" height="60" rx="14" fill="${C.accent}"/>
</g>`

function card(lib, areaTitle) {
  const nameSize = fit(MONO_B, lib.name, 104, TEXT_MAX, 60)
  const lines = wrap(SANS, lib.summary, 34, TEXT_MAX, 3)
  const install = lib.install || `github.com/ubgo/${lib.name}`
  const installSize = fit(MONO, install, 26, TEXT_MAX - 64, 16)
  const chip = areaTitle.toUpperCase()
  const chipW = advance(SANS_M, chip, 18, 2) + 32
  let y = 250
  const summary = lines.map((l, i) => path(SANS, l, TEXT_X, y + 100 + i * 46, 34, "#CBD5E1")).join("")
  const after = y + 100 + (lines.length - 1) * 46 + 50
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${W}" y2="${H}" gradientUnits="userSpaceOnUse"><stop stop-color="${C.darkTile[0]}"/><stop offset="1" stop-color="${C.darkTile[1]}"/></linearGradient>
    <linearGradient id="ic" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse"><stop stop-color="${C.tile[0]}"/><stop offset="1" stop-color="${C.tile[1]}"/></linearGradient>
    <radialGradient id="glow" cx="1100" cy="40" r="620" gradientUnits="userSpaceOnUse"><stop stop-color="${C.primaryDark}" stop-opacity=".22"/><stop offset="1" stop-color="${C.primaryDark}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${icon(TEXT_X, 72, 64)}
  ${path(DISPLAY, "ubgo", TEXT_X + 84, 118, 40, "#FFFFFF", -1)}
  <rect x="${W - 112 - chipW}" y="84" width="${chipW}" height="36" rx="18" fill="#1E293B" stroke="#334155"/>
  ${path(SANS_M, chip, W - 112 - chipW + 16, 108, 18, "#67E8F9", 2)}
  ${path(MONO_B, lib.name, TEXT_X, y, nameSize, "#FFFFFF", -2)}
  <rect x="${TEXT_X}" y="${y + 40}" width="96" height="8" rx="4" fill="${C.accent}"/>
  ${summary}
  <rect x="${TEXT_X}" y="${after}" width="${advance(MONO, install, installSize) + 64}" height="56" rx="12" fill="#0B1220" stroke="#334155"/>
  ${path(MONO, "$", TEXT_X + 22, after + 37, installSize, "#64748B")}
  ${path(MONO, install, TEXT_X + 46, after + 37, installSize, "#E2E8F0")}
</svg>`
}

mkdirSync(OUT, { recursive: true })
const areaTitle = Object.fromEntries(data.areas.map((a) => [a.key, a.title]))
const only = process.argv.slice(2)
let n = 0
for (const lib of data.libraries) {
  if (only.length && !only.includes(lib.name)) continue
  const png = new Resvg(card(lib, areaTitle[lib.area]), { fitTo: { mode: "width", value: W } }).render().asPng()
  writeFileSync(join(OUT, `${lib.name}.png`), png)
  n++
}
console.log(`og: wrote ${n} cards to ${OUT}`)
