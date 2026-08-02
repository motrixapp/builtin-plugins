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
  `shared/esbuild.base.mjs`. Do not add `minify: true` or change identifier
  names as part of the build step.

  Caveat on the stated reason: this rule was introduced because full `minify`
  renames identifiers and the host-side `prepareBundle` regex in `motrix-turbo`
  could not cope. **That host limitation is fixed** — `CapabilityBridge.ts`
  now converts `import { x as y }` into destructuring `x: y`, with tests
  covering plain, fully-renamed and mixed imports, and real `minify: true`
  bundles pass its rewrite plus a syntax check. The constraint is kept as a
  deliberately conservative default (it buys ~20% size, and only the
  `motrix:plugin-api` import shape has been re-verified). If you do relax it,
  re-verify against the host rather than against this note. Note also that
  `@motrix/plugin-cli`'s `pack` — what third-party authors run — has always
  used full `minify`.
- **Pack-time validation is shared code — do not re-implement it here.**
  `scripts/validate-manifest.mjs` is a thin façade over
  `@motrix/plugin-manifest-schema`'s `validate.ts`, which `@motrix/plugin-cli`
  imports too. Both gates (`validateManifest` for schema + the
  `hooks ⇒ hostPermissions` invariant, `validateLocaleCoverage` for `%key%`
  resolution) run in `packOne` against the **staged** tree, before any archive
  bytes are written — staging is checked rather than the source tree so a
  locale file that failed to copy is caught even when the source looks fine.
  A new rule belongs in the schema package so both pipelines get it; the
  hand-copied invariant that used to live here is exactly the drift that let
  this repo ship signed plugins with no locale check at all.
- **`.moext` size caps, enforced by `scripts/pack.mjs`:** the built
  `dist/plugin.js` bundle must be ≤ 1 MiB, and the final packed `.moext`
  archive must be ≤ 5 MiB. `pack.mjs` throws if either is exceeded — don't
  raise these limits without updating the design doc first.
- **Archive bytes are pinned; changing how they are produced breaks the
  audit trail.** `pack.mjs` sets `process.env.TZ = 'UTC'` before yazl touches
  any mtime, sorts entries by path, and zeroes mtime/mode, so rebuilding a tag
  reproduces its sha256 exactly — that property is what makes a
  `builtins.lock.json` digest bump independently verifiable. Touching the
  staging layout, entry order, or timestamps changes every future digest, and
  would break reproduction of already-released tags. (`@motrix/plugin-cli`
  reaches the same guarantee differently, via a local-time `DOS_EPOCH`
  constant instead of a process-wide `TZ`, because a library must not mutate
  the caller's environment. Do not "align" this script to that approach — the
  digests of released artifacts depend on the current scheme.)
- **Release tag format:** `motrix.<name>@<semver>`, e.g.
  `motrix.url-resolver@1.1.0`. Enforced by `scripts/parse-tag.mjs`
  (`ID_RE = /^motrix\.[a-z0-9][a-z0-9-]*$/`); malformed tags fail the release
  workflow before anything is built.
- **Signing key never touches this repo or a developer machine long-term.**
  It lives only in the `MOTRIX_PLUGIN_SIGNING_KEY` GitHub Actions secret
  (`plugin-signing` Environment). Use `scripts/keygen.mjs` for rotation.
