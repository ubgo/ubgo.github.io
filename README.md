# ubgo.github.io

The website for [ubgo](https://github.com/ubgo), served by GitHub Pages at https://ubgo.github.io. Built with Hugo and the standalone Tailwind CLI, so no Node is needed to build or run it.

## Layout

| Path | What it is |
| --- | --- |
| `data/libraries.yaml` | The one list of public libraries, areas and principles. The site and the org profile README are generated from it. |
| `content/libraries/_content.gotmpl` | Makes one page per library from the data file. |
| `layouts/` | Templates (home, library index, library page, about, 404, robots.txt). |
| `layouts/_partials/profile-readme.md` | Template for the org profile README (`ubgo/.github`, `profile/README.md`). |
| `assets/css/main.css` | Tailwind input. `task css` builds `assets/css/site.css`. |
| `assets/js/site.js` | Theme toggle, copy buttons, library search and filter. |
| `static/` | Logo, favicons and social card, copied from the brand folder by `task brand`. |
| `content-preview/` | The `/preview/` page (logo options, rendered profile README). Only built with `--environment preview`. |
| `config/` | `_default` (production), `preview` (owner preview), `profile` (README generation). |
| `scripts/linkcheck.py` | Checks every internal link and asset in a build. |
| `scripts/install-tools.sh` | Installs the pinned Hugo and Tailwind binaries with checksum checks. |

## Tasks

```sh
task tools       # install pinned Hugo extended 0.167.0 and Tailwind 4.3.3 into ~/.local/bin
task brand       # copy logo, favicons and social card from ../brand
task build       # production build into public/
task serve       # preview at https://ubgo.shipd.fyi through portless (owner login only)
task profile     # regenerate ../profile/profile/README.md from data/libraries.yaml
task linkcheck   # build, then check every internal link
task check       # profile + build + link check
```

## Adding a library

Add an entry to `data/libraries.yaml` (only public repos), then run `task check`. That updates the site and the org profile README together, so they never drift.
