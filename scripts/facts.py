#!/usr/bin/env python3
"""Extracts per-library facts from local clones of the public ubgo repos.

Usage: facts.py <clones-dir> <libraries.yaml> <out-dir>

<clones-dir> holds one shallow clone per repo (named like the repo) and a
<name>.tags file with `git ls-remote --tags` output; `task facts` prepares both.
For every library in libraries.yaml it writes <out-dir>/<name>.json with facts
read from the repo itself, never guessed:

  module      root go.mod module path ("" when the repo has no root go.mod)
  go          Go version from the root go.mod
  license     license name detected from the LICENSE file
  latestTag   highest root vX.Y.Z tag ("" when there is none)
  streamTags  highest tag per prefixed stream, e.g. {"volt": "v0.2.0"} for volt/v0.2.0
  branch      default branch of the clone (for links into the repo)
  coreDeps    number of direct requires in the root go.mod
  modules     every go.mod in the repo: {dir, module, deps}
  contrib     contrib/<name> folders: {name, module, deps, summary}
  plugins     plugin/<name> (or plugins/<name>) folders, same shape as contrib;
              module is "" when the plugin lives in the root module. Ordered as
              the repo README first links them, then by name
  packages    top-level Go package folders (backends like lock/redislock)
  ubgoDeps    other ubgo libraries required by any go.mod: {name, from}
  examples    up to 4 short Go or TypeScript code blocks from the README: {title, lang, code}
  features    bullet points from the README's feature section
  table       first README table about backends/adapters, as markdown
"""
import json
import os
import re
import sys

ROOT, LIBS, OUT = sys.argv[1:4]
# Every repo listed in libraries.yaml: the libraries (2-space indent) and the volt
# repos (4-space indent under volt.repos). FACTS_ONLY=a,b limits a run to those.
# Everything from the top-level `upcoming:` key on is private repos and the home
# builder, so it is cut off before matching (private repos never get facts).
NAMES = re.findall(r"^ +- name: ([a-z0-9-]+)", re.split(r"^upcoming:", open(LIBS, encoding="utf-8").read(), flags=re.M)[0], re.M)
ALL_NAMES = list(NAMES)  # dependency matching always sees every repo name
if os.environ.get("FACTS_ONLY"):
    NAMES = [n for n in NAMES if n in os.environ["FACTS_ONLY"].split(",")]
# Module path prefixes that refer to a ubgo library (some repos moved from khanakia).
PREFIXES = ("github.com/ubgo/", "github.com/khanakia/")
SKIP_DIRS = {"internal", "cmd", "contrib", "plugin", "plugins", "examples", "example", "docs", "testdata", "scripts", "brand", "vendor", ".github", "node_modules"}


def parse_gomod(path):
    text = open(path, encoding="utf-8").read()
    module = (re.search(r"^module\s+(\S+)", text, re.M) or [None, ""])[1]
    go = (re.search(r"^go\s+(\S+)", text, re.M) or [None, ""])[1]
    reqs = []
    for block in re.findall(r"^require\s*\((.*?)^\)", text, re.M | re.S):
        reqs += [l for l in block.splitlines() if l.strip() and not l.strip().startswith("//")]
    reqs += re.findall(r"^require\s+([^\s(].*)$", text, re.M)
    direct = [r.split()[0] for r in reqs if "// indirect" not in r]
    return module, go, direct


def license_name(repo):
    for f in os.listdir(repo):
        if f.upper().startswith(("LICENSE", "COPYING")):
            t = open(os.path.join(repo, f), encoding="utf-8", errors="replace").read(3000)
            for pat, name in (("Apache License", "Apache-2.0"), ("MIT License", "MIT"), ("PolyForm Perimeter License 1.0.0", "PolyForm Perimeter 1.0.0"), ("BSD 3-Clause", "BSD-3-Clause")):
                if pat in t:
                    return name
            return "see LICENSE"
    return ""


def branch(repo):
    head = os.path.join(repo, ".git", "HEAD")
    if os.path.exists(head):
        m = re.search(r"refs/heads/(\S+)", open(head).read())
        if m:
            return m.group(1)
    return "main"


def stream_tags(name):
    p = os.path.join(ROOT, f"{name}.tags")
    if not os.path.exists(p):
        return {}
    best = {}
    for stream, ver in re.findall(r"refs/tags/(.+?)[/@](v\d+\.\d+\.\d+)$", open(p).read(), re.M):
        key = tuple(int(x) for x in ver[1:].split("."))
        if stream not in best or key > best[stream][0]:
            best[stream] = (key, ver)
    return {k: v[1] for k, v in sorted(best.items())}


def latest_tag(name):
    p = os.path.join(ROOT, f"{name}.tags")
    if not os.path.exists(p):
        return ""
    tags = re.findall(r"refs/tags/(v\d+\.\d+\.\d+)$", open(p).read(), re.M)
    return max(tags, key=lambda t: tuple(int(x) for x in t[1:].split(".")), default="")


def plain(md):
    """Markdown inline -> plain text, keeping `code`; drops links and images."""
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)
    md = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"<[^>]+>", "", md)
    return re.sub(r"\s+", " ", md).strip()


def readme_parts(repo):
    p = next((os.path.join(repo, f) for f in os.listdir(repo) if f.lower() == "readme.md"), None)
    if not p:
        return [], [], ""
    lines = open(p, encoding="utf-8").read().splitlines()
    examples, features, table = [], [], ""
    heading, in_code, lang, buf = "", False, "", []
    feat_section, feat_done = False, False
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            if not in_code:
                in_code, lang, buf = True, line[3:].strip().lower(), []
            else:
                in_code = False
                code = "\n".join(buf).rstrip()
                n = len(buf)
                lang = {"typescript": "ts", "golang": "go"}.get(lang, lang)
                if lang in ("go", "ts") and 4 <= n <= 32 and len(examples) < 4 and "..." not in code[:20]:
                    title = plain(heading) or "Example"
                    if title not in [e["title"] for e in examples]:
                        examples.append({"title": title, "lang": lang, "code": code})
            i += 1
            continue
        if in_code:
            buf.append(line)
            i += 1
            continue
        m = re.match(r"^(#{2,4})\s+(.*)", line)
        if m:
            heading = m.group(2).strip()
            if features:
                feat_done = True
            feat_section = not feat_done and bool(re.search(r"feature|what it does|highlight|at a glance|what you get|why ", heading, re.I))
        elif feat_section and re.match(r"^\s{0,1}[-*]\s+\S", line) and len(features) < 10:
            item = re.sub(r"^\s*[-*]\s+", "", line)
            # README bullets often wrap: join indented continuation lines.
            while i + 1 < len(lines) and re.match(r"^\s{2,}\S", lines[i + 1]) and not re.match(r"^\s*[-*]\s", lines[i + 1]):
                i += 1
                item += " " + lines[i].strip()
            features.append(plain(item))
        elif not table and line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|?\s*$", lines[i + 1]) and re.search(r"backend|adapter|contrib|support|matrix|famil|packag|module|checker|driver|source|codec", heading + " " + line, re.I):
            # Only start at a header row (the next line is the |---| separator).
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(re.sub(r"\[([^\]]+)\]\((?!https?://)[^)]*\)", r"\1", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", lines[i])))
                i += 1
            if len(rows) >= 3:
                table = "\n".join(rows)
            continue
        i += 1
    return examples, features, table


def adapter_dirs(repo, folder, readme_order=False):
    """Sub-folders of <repo>/<folder> (contrib/, plugin/): {name, module, deps, summary}.

    The summary is the first prose line of the folder's README. Sorted by name;
    with readme_order, folders the repo README links as `folder/<name>` come
    first, in the README's own order (e.g. a plugin table), then the rest by name.
    """
    cdir = os.path.join(repo, folder)
    if not os.path.isdir(cdir):
        return []
    rp = next((os.path.join(repo, x) for x in os.listdir(repo) if x.lower() == "readme.md"), None)
    order = []
    if rp and readme_order:
        for m in re.findall(rf"\({re.escape(folder)}/([a-z0-9_-]+)\)", open(rp, encoding="utf-8").read()):
            if m not in order:
                order.append(m)
    names = [c for c in sorted(os.listdir(cdir)) if os.path.isdir(os.path.join(cdir, c))]
    names.sort(key=lambda c: (order.index(c) if c in order else len(order), c))
    out = []
    for c in names:
        cp = os.path.join(cdir, c)
        gm = os.path.join(cp, "go.mod")
        module, _, direct = parse_gomod(gm) if os.path.exists(gm) else ("", "", [])
        summary = ""
        rp2 = os.path.join(cp, "README.md")
        if os.path.exists(rp2):
            for line in open(rp2, encoding="utf-8").read().splitlines()[1:]:
                if line.strip() and not line.startswith(("#", "[!", "!", "<", "|", "```", ">")):
                    summary = plain(line)[:160]
                    break
        out.append({"name": c, "module": module, "deps": len(direct), "summary": summary})
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    name_of = {}
    for n in NAMES:  # module path -> library name, from every go.mod in every repo
        repo = os.path.join(ROOT, n)
        for d, dirs, files in os.walk(repo):
            dirs[:] = [x for x in dirs if x not in {".git", "node_modules", "testdata"}]
            if "go.mod" in files:
                name_of[parse_gomod(os.path.join(d, "go.mod"))[0]] = n
    for n in NAMES:
        repo = os.path.join(ROOT, n)
        f = {"name": n, "module": "", "go": "", "coreDeps": 0, "license": license_name(repo), "latestTag": latest_tag(n), "streamTags": stream_tags(n), "branch": branch(repo),
             "modules": [], "contrib": [], "packages": [], "ubgoDeps": []}
        seen = set()
        for d, dirs, files in os.walk(repo):
            dirs[:] = sorted(x for x in dirs if x not in {".git", "node_modules", "testdata"})
            if "go.mod" not in files:
                continue
            module, go, direct = parse_gomod(os.path.join(d, "go.mod"))
            rel = os.path.relpath(d, repo)
            f["modules"].append({"dir": rel, "module": module, "deps": len(direct)})
            if rel == ".":
                f.update(module=module, go=go, coreDeps=len(direct))
            for r in direct:
                target = name_of.get(r)
                if target is None and r.startswith(PREFIXES):
                    target = next((x for x in ALL_NAMES if r.split("/")[2] == x), None)
                if target and target != n and target not in seen and not rel.startswith(("examples", "example")):
                    seen.add(target)
                    f["ubgoDeps"].append({"name": target, "from": rel})
        f["contrib"] = adapter_dirs(repo, "contrib")
        f["plugins"] = adapter_dirs(repo, "plugin", True) or adapter_dirs(repo, "plugins", True)
        for c in sorted(os.listdir(repo)):
            cp = os.path.join(repo, c)
            if os.path.isdir(cp) and c not in SKIP_DIRS and not c.startswith(".") and any(x.endswith(".go") and not x.endswith("_test.go") for x in os.listdir(cp)):
                f["packages"].append(c)
        f["examples"], f["features"], f["table"] = readme_parts(repo)
        with open(os.path.join(OUT, f"{n}.json"), "w", encoding="utf-8") as fh:
            json.dump(f, fh, indent=1, ensure_ascii=False)
            fh.write("\n")
    print(f"facts: wrote {len(NAMES)} files to {OUT}")


main()
