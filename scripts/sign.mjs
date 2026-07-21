#!/usr/bin/env node
// Detached Ed25519 signature over a file's bytes. Signature is base64 in a
// sidecar <file>.sig. Private key: PKCS8 PEM via MOTRIX_SIGNING_KEY_PEM env
// or --key <path>. Ed25519 passes `null` as the digest algorithm.
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function signBytes(bytes, privatePem) {
  return sign(null, bytes, createPrivateKey(privatePem)).toString('base64')
}

export function verifyBytes(bytes, sigB64, publicPem) {
  return verify(
    null,
    bytes,
    createPublicKey(publicPem),
    Buffer.from(sigB64, 'base64')
  )
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const args = process.argv.slice(2)
  const keyFlag = args.indexOf('--key')
  const file = args.find(
    (_a, i) => keyFlag < 0 || (i !== keyFlag && i !== keyFlag + 1)
  )
  if (!file) {
    console.error('usage: sign.mjs <file> [--key <private.pem>]')
    process.exit(2)
  }
  const pem =
    keyFlag >= 0
      ? await readFile(args[keyFlag + 1], 'utf8')
      : process.env.MOTRIX_SIGNING_KEY_PEM
  if (!pem) {
    console.error('no key: set MOTRIX_SIGNING_KEY_PEM or pass --key')
    process.exit(2)
  }
  const sig = signBytes(await readFile(file), pem)
  await writeFile(`${file}.sig`, `${sig}\n`)
  console.log(`[sign] ${file}.sig`)
}
