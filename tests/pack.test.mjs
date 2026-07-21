import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import yauzl from 'yauzl'

const ROOT = path.resolve(import.meta.dirname, '..')
const ARTIFACTS = path.join(ROOT, 'dist', 'artifacts')

function zipEntries(file) {
  return new Promise((resolve, reject) => {
    const names = []
    yauzl.open(file, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err)
      zip.on('entry', (e) => {
        names.push(e.fileName)
        zip.readEntry()
      })
      zip.on('end', () => resolve(names))
      zip.on('error', reject)
      zip.readEntry()
    })
  })
}

describe('pack.mjs', () => {
  it('packs every plugin into a verified .moext + metadata pair', async () => {
    execFileSync('node', [path.join(ROOT, 'scripts', 'pack.mjs')], {
      stdio: 'inherit',
    })
    const metas = readdirSync(ARTIFACTS).filter((f) =>
      f.endsWith('.metadata.json')
    )
    expect(metas.length).toBe(3)
    for (const metaFile of metas) {
      const meta = JSON.parse(readFileSync(path.join(ARTIFACTS, metaFile)))
      const moext = path.join(ARTIFACTS, meta.file)
      const bytes = readFileSync(moext)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(meta.sha256)
      expect(bytes.length).toBe(meta.size)
      const entries = await zipEntries(moext)
      expect(entries).toContain('motrix-plugin.json')
      expect(entries).toContain('dist/plugin.js')
    }
  }, 120_000)

  it('is deterministic: two packs of the same tree hash identically', async () => {
    const { packOne } = await import('../scripts/pack.mjs')
    const a = await packOne('motrix.scraper-hook')
    const b = await packOne('motrix.scraper-hook')
    expect(a.sha256).toBe(b.sha256)
    expect(a.size).toBe(b.size)
  }, 120_000)
})
