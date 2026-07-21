import { describe, expect, it } from 'vitest'
import { parseTag } from '../scripts/parse-tag.mjs'

describe('parseTag', () => {
  it('parses id@version', () => {
    expect(parseTag('motrix.url-resolver@1.2.3')).toEqual({
      id: 'motrix.url-resolver',
      version: '1.2.3',
    })
  })
  it('accepts prerelease/build suffixes', () => {
    expect(parseTag('motrix.scraper-hook@1.0.0-beta.1+build5').version).toBe(
      '1.0.0-beta.1+build5'
    )
  })
  it('rejects non-motrix ids', () => {
    expect(() => parseTag('evil.plugin@1.0.0')).toThrow()
  })
  it('rejects malformed versions', () => {
    expect(() => parseTag('motrix.url-resolver@not-semver')).toThrow()
  })
})
