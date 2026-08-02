import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HOST_PERMISSIONS_REQUIRED_FOR_HOOKS,
  LOCALE_MISSING_EN_US,
  LOCALE_MISSING_KEYS,
  validateLocaleCoverage,
  validateManifest,
} from '../scripts/validate-manifest.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const FIXTURES = path.join(import.meta.dirname, 'fixtures')
const PLUGINS = path.join(ROOT, 'plugins')

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

describe('validateManifest (pack-time gate)', () => {
  it('rejects a manifest that declares hooks but no hostPermissions', () => {
    const manifest = readJson(
      path.join(FIXTURES, 'hooks-without-host-permissions.json')
    )
    expect(() => validateManifest(manifest, manifest.id)).toThrow(
      new RegExp(HOST_PERMISSIONS_REQUIRED_FOR_HOOKS.replace(/\./g, '\\.'))
    )
  })

  it('rejects a structurally invalid manifest before the invariant check', () => {
    const manifest = readJson(path.join(FIXTURES, 'structurally-invalid.json'))
    expect(() => validateManifest(manifest, manifest.id)).toThrow(
      /invalid motrix-plugin\.json/
    )
  })

  it('accepts all three real builtin manifests', () => {
    for (const id of [
      'motrix.filename-template',
      'motrix.scraper-hook',
      'motrix.url-resolver',
    ]) {
      const manifest = readJson(path.join(PLUGINS, id, 'motrix-plugin.json'))
      expect(() => validateManifest(manifest, id)).not.toThrow()
    }
  })
})

// Until now this repo ran no locale check at all: pack.mjs copied `locales/`
// through a helper wrapped in a bare `catch {}`, so a missing catalogue shipped
// signed and rendered as a literal `%name%` in the UI. The CLI had this check
// and this pipeline did not — the drift the shared schema package removes.
describe('validateLocaleCoverage (pack-time gate)', () => {
  function scratchPlugin(manifest, locale) {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'locale-gate-'))
    writeFileSync(
      path.join(dir, 'motrix-plugin.json'),
      JSON.stringify(manifest)
    )
    if (locale !== undefined) {
      mkdirSync(path.join(dir, 'locales'))
      writeFileSync(
        path.join(dir, 'locales/en-US.json'),
        JSON.stringify(locale)
      )
    }
    return dir
  }

  it('accepts all three real builtin plugins', async () => {
    for (const id of [
      'motrix.filename-template',
      'motrix.scraper-hook',
      'motrix.url-resolver',
    ]) {
      const dir = path.join(PLUGINS, id)
      const manifest = readJson(path.join(dir, 'motrix-plugin.json'))
      await expect(
        validateLocaleCoverage(dir, manifest)
      ).resolves.toBeUndefined()
    }
  })

  it('rejects a placeholder with no translation', async () => {
    const dir = scratchPlugin({ l10n: 'locales', name: '%name%' }, {})
    await expect(
      validateLocaleCoverage(dir, { l10n: 'locales', name: '%name%' })
    ).rejects.toThrow(`${LOCALE_MISSING_KEYS}: name`)
  })

  it('rejects a declared l10n directory with no en-US.json', async () => {
    const dir = scratchPlugin({ l10n: 'locales', name: '%name%' }, undefined)
    await expect(
      validateLocaleCoverage(dir, { l10n: 'locales', name: '%name%' })
    ).rejects.toThrow(LOCALE_MISSING_EN_US)
  })

  // The fixed-list collector the CLI used to run saw only name/description/
  // commands[].title, so configuration strings went unchecked entirely.
  it('rejects an unresolved configuration placeholder', async () => {
    const manifest = {
      l10n: 'locales',
      contributes: { configuration: { title: '%settings.title%' } },
    }
    const dir = scratchPlugin(manifest, { name: 'x' })
    await expect(validateLocaleCoverage(dir, manifest)).rejects.toThrow(
      `${LOCALE_MISSING_KEYS}: settings.title`
    )
  })

  it('skips plugins that declare no l10n directory', async () => {
    const dir = scratchPlugin({ name: 'Plain' }, undefined)
    await expect(
      validateLocaleCoverage(dir, { name: 'Plain' })
    ).resolves.toBeUndefined()
  })
})
