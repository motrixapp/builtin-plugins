# CLAUDE.md

This file contains the shared instructions for AI coding agents working in
this repository. `AGENTS.md` points here so the guidance only needs to be
maintained in one place.

## What this repo is

`motrixapp/builtin-plugins` is a pnpm workspace monorepo holding the source
and release pipeline for Motrix Turbo's three builtin plugins, extracted out
of `motrix-turbo` so they can be versioned and released independently of app
releases (see `motrix-turbo/docs/superpowers/specs/2026-07-18-builtin-plugin-independent-update-design.md`).
This repo is the SOLE source of truth for builtin plugin code: `motrix-turbo`
consumes the signed `.moext` releases published here via its lockfile-pinned
`scripts/fetch-builtins.mjs` (`scripts/builtins.lock.json` pins each plugin's
tag + sha256); its former in-tree copies are deleted. After releasing a new
plugin version, bump the corresponding lockfile entry in `motrix-turbo`.

## The three plugins

| id | `plugins/` dir | purpose |
|----|----------------|---------|
| `motrix.filename-template` | `plugins/motrix.filename-template/` | renames completed downloads from a user-configurable filename template |
| `motrix.scraper-hook` | `plugins/motrix.scraper-hook/` | pre-resolve HTTP hook for site scraping |
| `motrix.url-resolver` | `plugins/motrix.url-resolver/` | URL-resolver framework + Wikimedia Commons demo resolver; site-specific extraction lives in separately installed site-resolver plugins |

Plugin ids double as tag prefixes and manifest `id` fields — they must match
the plugin's directory name (`scripts/pack.mjs` asserts this).

## Hard constraints

- **Minify: `minifyWhitespace` + `minifySyntax` only — never full `minify`.**
  All three plugins build through the shared `buildPlugin()` in
  `shared/esbuild.base.mjs`. Full esbuild `minify` renames identifiers, which
  breaks the host-side `prepareBundle` regex in `motrix-turbo` that rewrites
  `import ... from 'motrix:plugin-api'`. Do not add `minify: true` or change
  identifier names as part of the build step.
- **`.moext` size caps, enforced by `scripts/pack.mjs`:** the built
  `dist/plugin.js` bundle must be ≤ 1 MiB, and the final packed `.moext`
  archive must be ≤ 5 MiB. `pack.mjs` throws if either is exceeded — don't
  raise these limits without updating the design doc first.
- **Release tag format:** `motrix.<name>@<semver>`, e.g.
  `motrix.url-resolver@1.1.0`. Enforced by `scripts/parse-tag.mjs`
  (`ID_RE = /^motrix\.[a-z0-9][a-z0-9-]*$/`); malformed tags fail the release
  workflow before anything is built.
- **Signing key never touches this repo or a developer machine long-term.**
  It lives only in the `MOTRIX_PLUGIN_SIGNING_KEY` GitHub Actions secret
  (`plugin-signing` Environment). Use `scripts/keygen.mjs` for rotation.
