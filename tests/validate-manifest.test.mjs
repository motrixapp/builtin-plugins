import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HOST_PERMISSIONS_REQUIRED_FOR_HOOKS,
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
