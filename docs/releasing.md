# Releasing a builtin plugin

English | [简体中文](./releasing.zh-CN.md)

Maintainer guide for cutting an official release of a Motrix builtin plugin.
For building and testing, see [Development](../README.md#development) in the
README.

## Background

This repo was extracted out of `motrix-turbo` (per the "Builtin Plugin
Independent Update" design, 2026-07-18) so each builtin plugin can be
versioned and released on its own tag instead of waiting for a full app
release. `motrix-turbo` downloads the signed `.moext` files published here
through its lockfile-pinned `scripts/fetch-builtins.mjs` step
(`scripts/builtins.lock.json` pins each plugin's tag and sha256).

This repo is the sole source of truth for builtin plugin code. After
releasing a new plugin version, bump the corresponding lockfile entry in
`motrix-turbo` so the app picks it up.

## Release process

1. Bump the `version` field in `plugins/<id>/motrix-plugin.json`.
2. Tag the commit as `<id>@<version>`, e.g.:
   ```bash
   git tag motrix.url-resolver@1.1.0
   git push origin motrix.url-resolver@1.1.0
   ```
3. The tag push triggers `.github/workflows/release.yml`, which runs two
   jobs:
   - **build** (no secret): asserts the manifest version matches the tag,
     builds, typechecks, and tests the whole workspace, packs just that
     plugin into `.moext` + `.metadata.json`, and hands them over as a
     workflow artifact;
   - **sign** (bound to the `plugin-signing` Environment — a reviewer must
     approve the run): asserts the tag commit is an ancestor of `main`,
     signs the pre-built `.moext` (Ed25519 detached signature) using only
     scripts checked out from `main`, cross-checks the signature against
     `keys/signing-key.pub.pem`, and publishes a GitHub Release with the
     `.moext`, `.moext.sig`, and `.metadata.json` attached.

Tags must match `motrix.<name>@<semver>` — anything else is rejected by
`scripts/parse-tag.mjs` before packing starts.

## Signing key policy

- The Ed25519 **private** signing key lives ONLY in the
  `MOTRIX_PLUGIN_SIGNING_KEY` GitHub Actions secret, scoped to the
  `plugin-signing` Environment; `release.yml` binds every release run to
  that Environment. The key is never committed, never present on a developer
  machine long-term, and never logged.
- Two protections govern who can mint a release: the protected-tag ruleset
  for `motrix.*@*` (only repo admins can create, move, or delete release
  tags) and the Environment's required-reviewer rule (a reviewer must
  approve each release run before any step executes). Both live in GitHub
  configuration, not in workflow code — when in doubt, re-verify with
  `gh ruleset list` and `gh api repos/<owner>/<repo>/environments`; the
  dated status note lives in the comments of `release.yml`.
- Key rotation: run `scripts/keygen.mjs` to generate a fresh keypair, store
  the new private key material only in the GitHub secret, replace
  `keys/signing-key.pub.pem` with the new public key, and discard the local
  private-key file.
- The corresponding **public** key is committed at
  `keys/signing-key.pub.pem` — the canonical copy consumers verify against.
  `motrix-turbo` pins its own copy at `scripts/builtins-signing.pub.pem`;
  its `fetch-builtins.mjs` verifies every fetched `.moext`'s Ed25519
  signature (in addition to the lockfile sha256) at every source before
  installing.

## Verifying an artifact

With a release's `.moext` and its `.moext.sig` in the same directory:

```bash
node scripts/verify.mjs <id>-<version>.moext --pub keys/signing-key.pub.pem
```
