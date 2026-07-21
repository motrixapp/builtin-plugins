#!/usr/bin/env node
// Build every plugins/<id>/, stage its runtime tree, zip it into
// dist/artifacts/<id>-<version>.moext, and emit a sibling
// <id>-<version>.metadata.json { id, version, file, sha256, size }.
// The staged tree layout matches PluginRegistry.scanInto():
//   motrix-plugin.json, dist/plugin.js, locales/*.json?, icon.png?

// Zip entries store LOCAL DOS time: without a pinned timezone the same tree
// packs to different bytes on different machines, breaking the "rebuild the
// tag, confirm the digest" audit property. Must be set before yazl converts
// any entry mtime.
process.env.TZ = 'UTC'

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yazl from 'yazl'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PLUGINS = path.join(ROOT, 'plugins')
const STAGING = path.join(ROOT, 'dist', 'staging')
const ARTIFACTS = path.join(ROOT, 'dist', 'artifacts')
const BUNDLE_MAX = 1 << 20
const TOTAL_MAX = 5 << 20

export async function listPluginIds() {
  const out = []
  for (const e of await readdir(PLUGINS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    try {
      await stat(path.join(PLUGINS, e.name, 'motrix-plugin.json'))
      out.push(e.name)
    } catch {}
  }
  return out
}

function runBuild(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['build'], { cwd, stdio: 'inherit' })
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`pnpm build failed in ${cwd} (exit ${code})`))
    )
    child.on('error', reject)
  })
}

async function copyDirShallow(src, dst) {
  try {
    const entries = await readdir(src)
    await mkdir(dst, { recursive: true })
    for (const name of entries) {
      const s = await stat(path.join(src, name))
      if (s.isFile()) await copyFile(path.join(src, name), path.join(dst, name))
    }
  } catch {}
}

export async function stageOne(id) {
  const src = path.join(PLUGINS, id)
  const dst = path.join(STAGING, id)
  await rm(dst, { recursive: true, force: true })
  await mkdir(path.join(dst, 'dist'), { recursive: true })
  await copyFile(
    path.join(src, 'motrix-plugin.json'),
    path.join(dst, 'motrix-plugin.json')
  )
  await copyFile(
    path.join(src, 'dist', 'plugin.js'),
    path.join(dst, 'dist', 'plugin.js')
  )
  await copyDirShallow(path.join(src, 'locales'), path.join(dst, 'locales'))
  if (await stat(path.join(src, 'icon.png')).catch(() => null)) {
    await copyFile(path.join(src, 'icon.png'), path.join(dst, 'icon.png'))
  }
  return dst
}

async function listEntries(dir, prefix = '') {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    if (e.isDirectory()) out.push(...(await listEntries(abs, rel)))
    else if (e.isFile()) out.push({ abs, rel })
  }
  return out
}

export async function packOne(id) {
  const staged = await stageOne(id)
  const manifest = JSON.parse(
    await readFile(path.join(staged, 'motrix-plugin.json'), 'utf8')
  )
  if (manifest.id !== id) {
    throw new Error(`${id}: manifest.id "${manifest.id}" != directory name`)
  }
  const bundle = await stat(path.join(staged, 'dist', 'plugin.js'))
  if (bundle.size > BUNDLE_MAX) {
    throw new Error(
      `${id}: dist/plugin.js ${bundle.size}B > ${BUNDLE_MAX}B cap`
    )
  }
  const file = `${manifest.id}-${manifest.version}.moext`
  const outFile = path.join(ARTIFACTS, file)
  const z = new yazl.ZipFile()
  // Deterministic archive: sort entries by rel path and zero out mtime/mode so
  // the same source tree always hashes to the same sha256. This makes every
  // builtins.lock.json digest bump independently reproducible by a reviewer or
  // CI job (rebuild the tag → identical digest), instead of an opaque value.
  const entries = (await listEntries(staged)).sort((a, b) =>
    a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0
  )
  for (const { abs, rel } of entries) {
    z.addFile(abs, rel, { mtime: new Date(0), mode: 0o100644 })
  }
  z.end()
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(outFile)
    z.outputStream.pipe(ws).on('close', resolve).on('error', reject)
    z.on('error', reject)
  })
  const bytes = await readFile(outFile)
  if (bytes.length > TOTAL_MAX) {
    throw new Error(`${id}: moext ${bytes.length}B > ${TOTAL_MAX}B cap`)
  }
  const meta = {
    id: manifest.id,
    version: manifest.version,
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
  }
  await writeFile(
    path.join(ARTIFACTS, `${manifest.id}-${manifest.version}.metadata.json`),
    `${JSON.stringify(meta, null, 2)}\n`
  )
  return meta
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const only = process.argv[2]
  await mkdir(ARTIFACTS, { recursive: true })
  const ids = only ? [only] : await listPluginIds()
  if (ids.length === 0) {
    console.error('[pack] no plugins found under plugins/')
    process.exit(1)
  }
  for (const id of ids) {
    await runBuild(path.join(PLUGINS, id))
    const meta = await packOne(id)
    console.log(`[pack] ${meta.file} sha256=${meta.sha256} size=${meta.size}`)
  }
}
