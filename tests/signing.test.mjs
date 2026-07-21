import { execFileSync } from 'node:child_process'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { signBytes, verifyBytes } from '../scripts/sign.mjs'

function pemPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  return {
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    pub: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  }
}

describe('ed25519 signing', () => {
  it('sign → verify roundtrip succeeds', () => {
    const { priv, pub } = pemPair()
    const data = Buffer.from('moext bytes')
    const sig = signBytes(data, priv)
    expect(verifyBytes(data, sig, pub)).toBe(true)
  })

  it('tampered bytes fail verification', () => {
    const { priv, pub } = pemPair()
    const sig = signBytes(Buffer.from('original'), priv)
    expect(verifyBytes(Buffer.from('tampered'), sig, pub)).toBe(false)
  })

  it('wrong key fails verification', () => {
    const { priv } = pemPair()
    const other = pemPair()
    const data = Buffer.from('moext bytes')
    const sig = signBytes(data, priv)
    expect(verifyBytes(data, sig, other.pub)).toBe(false)
  })

  it('CLI signs via MOTRIX_SIGNING_KEY_PEM with no --key flag', () => {
    const { privateKey } = generateKeyPairSync('ed25519')
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const dir = mkdtempSync(path.join(tmpdir(), 'sign-cli-'))
    try {
      const f = path.join(dir, 'artifact.bin')
      writeFileSync(f, Buffer.from('payload'))
      execFileSync('node', [path.resolve('scripts/sign.mjs'), f], {
        env: { ...process.env, MOTRIX_SIGNING_KEY_PEM: pem },
      })
      // sidecar written and non-empty base64
      const sig = readFileSync(`${f}.sig`, 'utf8').trim()
      expect(sig.length).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
