#!/usr/bin/env node
// parseTag('motrix.url-resolver@1.2.3') -> { id, version }
// Version pattern mirrors plugin-manifest-schema's manifest.version regex.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ID_RE = /^motrix\.[a-z0-9][a-z0-9-]*$/
const VERSION_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/

export function parseTag(tag) {
  const at = tag.lastIndexOf('@')
  if (at <= 0) throw new Error(`malformed tag: ${tag}`)
  const id = tag.slice(0, at)
  const version = tag.slice(at + 1)
  if (!ID_RE.test(id)) throw new Error(`invalid plugin id in tag: ${id}`)
  if (!VERSION_RE.test(version)) {
    throw new Error(`invalid version in tag: ${version}`)
  }
  return { id, version }
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly && process.argv[2]) {
  const { id, version } = parseTag(process.argv[2])
  console.log(JSON.stringify({ id, version }))
}
