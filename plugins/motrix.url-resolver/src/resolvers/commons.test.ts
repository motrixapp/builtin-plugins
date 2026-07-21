// src/resolvers/commons.test.ts
//
// Unit tests for the Wikimedia Commons demo resolver. All tests use fixture
// JSON — NO network calls. Commons hosts only freely-licensed (CC/PD) media
// and exposes a public MediaWiki imageinfo API, so this is the official
// builtin's zero-risk demonstration of the page→API→direct extension point.
// Run via: pnpm exec vitest run builtin-plugins/motrix.url-resolver/src/resolvers/commons.test.ts

import { describe, expect, it } from 'vitest'
import { match, resolve } from './commons'
import type { ResolverDeps } from './index'

const FILE_URL = 'https://commons.wikimedia.org/wiki/File:Example.jpg'
const DIRECT_URL =
  'https://upload.wikimedia.org/wikipedia/commons/a/a9/Example.jpg'

const IMAGEINFO_OK = JSON.stringify({
  query: {
    pages: {
      '-1': {
        title: 'File:Example.jpg',
        imageinfo: [{ url: DIRECT_URL }],
      },
    },
  },
})

interface Captured {
  url: string
  init?: { headers?: Record<string, string> }
}

function makeDeps(
  bodyFn: () => string,
  status = 200,
  captured?: Captured[]
): ResolverDeps {
  return {
    quality: '720p',
    http: async (url, init) => {
      captured?.push({ url, init })
      return { status, body: bodyFn() }
    },
    log: {
      info: () => undefined,
      warn: () => undefined,
      debug: () => undefined,
    },
  }
}

describe('commons.match()', () => {
  it('matches a Commons File: page URL', () => {
    expect(match(FILE_URL)).toBe(true)
  })

  it('does not match a Commons non-File page', () => {
    expect(match('https://commons.wikimedia.org/wiki/Main_Page')).toBe(false)
  })

  it('does not match other sites', () => {
    expect(match('https://www.youtube.com/watch?v=x')).toBe(false)
    expect(match('https://www.bilibili.com/video/BV1')).toBe(false)
    expect(match('https://example.com/file.zip')).toBe(false)
  })
})

describe('commons.resolve()', () => {
  it('resolves a File: page to its direct upload URL (kind: direct)', async () => {
    const result = await resolve(
      FILE_URL,
      makeDeps(() => IMAGEINFO_OK)
    )
    expect(result).toEqual({ kind: 'direct', directUrl: DIRECT_URL })
  })

  it('calls the imageinfo API with the encoded title and a User-Agent', async () => {
    const captured: Captured[] = []
    await resolve(
      FILE_URL,
      makeDeps(() => IMAGEINFO_OK, 200, captured)
    )
    expect(captured).toHaveLength(1)
    const call = captured[0]
    expect(call?.url).toContain('commons.wikimedia.org/w/api.php')
    expect(call?.url).toContain('prop=imageinfo')
    expect(call?.url).toContain(
      `titles=${encodeURIComponent('File:Example.jpg')}`
    )
    expect(call?.init?.headers?.['User-Agent']).toBeTruthy()
  })

  it('returns null on a non-200 API response', async () => {
    const result = await resolve(
      FILE_URL,
      makeDeps(() => '', 500)
    )
    expect(result).toBeNull()
  })

  it('returns null when the API body is not valid JSON', async () => {
    const result = await resolve(
      FILE_URL,
      makeDeps(() => 'not json')
    )
    expect(result).toBeNull()
  })

  it('returns null when the page has no imageinfo url', async () => {
    const body = JSON.stringify({
      query: { pages: { '-1': { title: 'File:Missing.jpg' } } },
    })
    const result = await resolve(
      FILE_URL,
      makeDeps(() => body)
    )
    expect(result).toBeNull()
  })
})
