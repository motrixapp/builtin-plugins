#!/usr/bin/env node
// Generate an Ed25519 keypair for plugin signing. NEVER commit the private
// key; it belongs in the GitHub Actions secret MOTRIX_PLUGIN_SIGNING_KEY.
import { generateKeyPairSync } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outDir = process.argv[2] ?? '.'
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' })
const pub = publicKey.export({ type: 'spki', format: 'pem' })
await mkdir(outDir, { recursive: true })
await writeFile(path.join(outDir, 'signing-key.pem'), priv, { mode: 0o600 })
await writeFile(path.join(outDir, 'signing-key.pub.pem'), pub)
console.log(`[keygen] wrote signing-key.pem (SECRET) + signing-key.pub.pem`)
