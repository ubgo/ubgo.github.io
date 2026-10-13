#!/usr/bin/env python3
"""Checks every internal link and asset in a built Hugo site resolves to a file.

Usage: linkcheck.py <public-dir> [base-url ...]
Scans every .html file for href/src/srcset and content= URLs. A URL is internal when
it is relative, root-relative, or starts with one of the base URLs (default: the
production and preview bases). Fragment links (#id) are checked against the ids in
the target page. Exits 1 and lists each broken link when anything is missing.
"""
import html.parser
import os
import sys
from urllib.parse import unquote, urljoin, urlparse

BASES = sys.argv[2:] or ["https://ubgo.github.io/", "https://ubgo.shipd.fyi/"]
# Served on the fly by `hugo server`, never written to disk.
SERVER_ONLY = ("/livereload.js",)


class Collector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids = [], set()

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        for key in ("href", "src"):
            if a.get(key):
                self.links.append(a[key])
        if a.get("srcset"):
            self.links += [p.strip().split(" ")[0] for p in a["srcset"].split(",") if p.strip()]
        if tag == "meta" and (a.get("property") in ("og:image", "og:url") or a.get("name") == "twitter:image"):
            self.links.append(a.get("content", ""))


def target_file(root, path):
    p = os.path.join(root, unquote(path).lstrip("/"))
    if path.endswith("/") or os.path.isdir(p):
        p = os.path.join(p, "index.html")
    return p


def main():
    root = sys.argv[1]
    pages, broken, checked = {}, [], 0
    for d, _, files in os.walk(root):
        for f in files:
            if f.endswith(".html"):
                full = os.path.join(d, f)
                c = Collector()
                c.feed(open(full, encoding="utf-8").read())
                pages[full] = c
    for full, c in pages.items():
        page_url = "/" + os.path.relpath(full, root).replace(os.sep, "/")
        for link in c.links:
            for b in BASES:
                if link.startswith(b):
                    link = "/" + link[len(b):]
            u = urlparse(link)
            if u.scheme or link.startswith("//") or link.startswith(("mailto:", "data:", "javascript:")):
                continue
            if link.startswith(SERVER_ONLY):
                continue
            checked += 1
            resolved = urlparse(urljoin(page_url, link))
            f = target_file(root, resolved.path) if resolved.path else full
            if not os.path.isfile(f):
                broken.append(f"{page_url}: {link} (no file {os.path.relpath(f, root)})")
                continue
            if resolved.fragment and f.endswith(".html"):
                t = pages.get(f)
                if t is not None and resolved.fragment not in t.ids:
                    broken.append(f"{page_url}: {link} (no id #{resolved.fragment})")
    print(f"linkcheck: {len(pages)} pages, {checked} internal links checked, {len(broken)} broken")
    for b in broken:
        print("  BROKEN", b)
    sys.exit(1 if broken else 0)


main()
