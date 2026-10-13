#!/usr/bin/env python3
"""Builds the brand download zip from the brand folder.

Usage: brand-zip.py <brand-dir> <out.zip>
Packs brand.json, README.md, every top-level SVG, favicon.ico, tokens and png/.
Timestamps are fixed so the zip only changes when an asset changes.
"""
import os
import sys
import zipfile

src, out = sys.argv[1:3]
keep = lambda f: f.endswith((".svg", ".ico", ".css")) or f in ("brand.json", "README.md", "tokens.json", "palette.json")
files = sorted(f for f in os.listdir(src) if os.path.isfile(os.path.join(src, f)) and keep(f))
files += sorted(os.path.join("png", f) for f in os.listdir(os.path.join(src, "png")) if f.endswith(".png"))
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        info = zipfile.ZipInfo(os.path.join("ubgo-brand", f), date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, open(os.path.join(src, f), "rb").read())
print(f"brand zip: {len(files)} files -> {out}")
