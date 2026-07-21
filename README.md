# Motrix Builtin Plugins

English | [简体中文](./README.zh-CN.md)

**Official plugins that come with [Motrix](https://motrix.app).**

---

Motrix 2 includes three plugins. They rename finished downloads, find files
linked from download pages, and handle supported media page URLs. You can
change their settings or turn them off from the **Plugins** page in Motrix.

This repository contains their source code and the scripts used to build and
release them. Read on for a description of each plugin, or skip to
[Development](#development) if you want to work on the code.

## At a glance

| Plugin | What it does |
|--------|--------------|
| 📝 [Filename Template](#-filename-template) | Gives finished downloads consistent names |
| 🔗 [Page Scraper](#-page-scraper) | Finds the file linked from a download page |
| 🎬 [URL Resolver](#-url-resolver) | Turns supported media page URLs into downloadable file URLs |

## 📝 Filename Template

*Plugin ID: `motrix.filename-template`*

Uses a template to rename each download when it finishes. The name is changed
before the file is placed in your download folder, so you only see the final
name.

The template can contain these placeholders:

| Placeholder | Value |
|-------------|-------|
| `{{title}}` | the original filename without its extension |
| `{{ext}}` | the file extension |
| `{{date}}` | the current date in `YYYY-MM-DD` format |
| `{{id}}` | the download task ID |

For example, with the template `{{date}} {{title}}.{{ext}}`,
`vacation-photos.zip` is saved as:

```text
2026-07-21 vacation-photos.zip
```

With the default template, `{{title}}.{{ext}}`, files keep their original
names.

**Settings**

| Setting | Default | Description |
|---------|---------|-------------|
| Filename template | `{{title}}.{{ext}}` | The template used to name finished downloads |

**Notes**

- Works with HTTP, FTP, and BitTorrent downloads.
- Characters that cannot be used in filenames (`/ \ < > : " | ? *`) are
  replaced with `_`. Names are also limited to 200 characters.

## 🔗 Page Scraper

*Plugin ID: `motrix.scraper-hook`*

Sometimes a "download link" leads to an HTML page that contains the real file
link. Without this plugin, Motrix would save the page as an `.html` file.

When you add an HTTP download, the plugin checks whether the URL leads to an
HTML page. If it does, the plugin looks for the first archive or installer
link on that page. It recognizes `.zip`, `.tar.gz`, `.tgz`, `.rar`, `.7z`,
`.exe`, `.dmg`, `.iso`, and `.pkg` links. If it finds one, Motrix downloads
that file instead.

**Example**

```text
URL you add:      https://example.com/downloads.html
URL Motrix uses:  https://example.com/files/app-2.3.1.dmg
```

**Settings**

| Setting | Default | Description |
|---------|---------|-------------|
| Enabled | on | Whether to scan download pages |
| Max page size | 512 KiB | The largest HTML page the plugin will scan (4 KiB–2 MiB) |

**Notes**

- Direct file links are left alone. The plugin only scans URLs that the server
  identifies as HTML pages.
- If the page cannot be opened or has no supported file link, Motrix keeps the
  original URL.
- **Logs** shows every URL change and why it was made.

## 🎬 URL Resolver

*Plugin ID: `motrix.url-resolver`*

This is the base plugin for site-specific media resolvers. A resolver takes a
media page URL and returns the file URL that Motrix should download.

It comes with one example resolver for **Wikimedia Commons**. Paste a URL such
as `https://commons.wikimedia.org/wiki/File:…`, and Motrix downloads the
original file instead of saving the web page.

Support for other websites comes from separate plugins. Once installed, they
can use the settings below, including your preferred quality. If none of the
installed resolvers supports a URL, Motrix leaves it unchanged.

**Settings**

| Setting | Default | Description |
|---------|---------|-------------|
| Preferred quality | `720p` | The quality (`1080p`, `720p`, or `480p`) requested from a site resolver |

## Using the plugins in Motrix

All three plugins are already installed and turned on.

1. **Find a plugin:** click **Plugins** in the left sidebar.
2. **Enable or disable it:** use the **Enabled** switch on its card or detail
   page.
3. **Change its settings:** open the plugin, go to **Settings**, make your
   changes, and click **Apply**. **Reset** restores the defaults.
4. **Check its activity:** open **Logs** on the detail page to see recent
   renames, URL changes, and resolver matches.

Motrix automatically gives builtin plugins the permissions they need. The
read-only **Access** tab shows those permissions. Builtin plugins can be
turned off, but they cannot be uninstalled.

---

## Development

The rest of this document is for people working on the plugins.

These plugins are bundled with Motrix, but they do not have to wait for a new
Motrix release. Each plugin has its own version and tag. Push that tag, and
GitHub Actions builds, tests, packages, signs, and publishes the plugin.
Motrix can then update it separately from the app.

### Repository layout

| Path | Description |
|------|-------------|
| `plugins/motrix.filename-template/` | Renames finished downloads from a user-defined template |
| `plugins/motrix.scraper-hook/` | Checks HTML download pages for direct file links before Motrix resolves the task |
| `plugins/motrix.url-resolver/` | Shared URL resolver with a Wikimedia Commons example |
| `shared/esbuild.base.mjs` | Shared `buildPlugin()` configuration used by all three plugin builds |
| `scripts/pack.mjs` | Builds a plugin, then writes `dist/artifacts/<id>-<version>.moext` and `<id>-<version>.metadata.json` (`id`, `version`, `file`, `sha256`, and `size`) |
| `scripts/keygen.mjs` | Generates the Ed25519 key pair used during initial signing setup or key rotation |
| `scripts/sign.mjs` | Creates a detached, base64-encoded Ed25519 signature (`<file>.sig`) for a `.moext` file |
| `scripts/verify.mjs` | Verifies a signature with the corresponding public key |
| `scripts/parse-tag.mjs` | Reads a release tag (`motrix.<id>@<version>`) and returns its plugin ID and version |
| `tests/` | Vitest tests for packaging, tag parsing, signing, and verification |
| `.github/workflows/ci.yml` | Runs builds, type checks, and tests for pushes and pull requests |
| `.github/workflows/release.yml` | Checks and publishes a plugin when its release tag is pushed |

Every `plugins/<id>/` directory has the same basic structure:
`motrix-plugin.json` for the manifest, `src/` for the TypeScript source,
`locales/` for translated strings, plus `esbuild.config.mjs` and
`tsconfig.json`.

### Commands

```bash
pnpm install               # Install workspace dependencies
pnpm -r build              # Build dist/plugin.js for all plugins
pnpm -r typecheck          # Type-check all plugins without emitting files
pnpm test                  # Run the Vitest suite
pnpm lint                  # Check lint and formatting rules (Biome)
node scripts/pack.mjs      # Package all plugins into dist/artifacts/*.moext
node scripts/pack.mjs <id> # Package one plugin, such as motrix.url-resolver
```

The packaging script runs the selected plugin's `pnpm build` command first,
so you do not need to run `pnpm -r build` beforehand.

### Releases

Each plugin has its own release tag. The format is
`motrix.<name>@<semver>`, for example `motrix.url-resolver@1.1.0`.

Pushing the tag starts the release workflow. GitHub Actions builds, tests,
packages, and signs the plugin, then creates a GitHub Release containing:

- the `.moext` plugin package
- its detached Ed25519 signature, `.moext.sig`
- a `.metadata.json` file with the package's SHA-256 hash and size

To check a downloaded package with the Motrix plugin-signing public key:

```bash
node scripts/verify.mjs <id>-<version>.moext --pub keys/signing-key.pub.pem
```

For the full release checklist, signing-key rules, and first-time setup, see
[docs/releasing.md](./docs/releasing.md).
