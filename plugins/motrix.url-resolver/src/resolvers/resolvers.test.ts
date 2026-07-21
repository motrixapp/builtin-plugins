// src/resolvers/resolvers.test.ts
//
// Unit tests for the discriminated ResolverResult union and the resolveUrl
// dispatcher. This builtin ships NO risky extractor — only a Wikimedia Commons
// demo resolver (covered by commons.test.ts) + a `generic` no-op — so resolveUrl
// returns null for every non-Commons URL.
// Run via: pnpm exec vitest run builtin-plugins/motrix.url-resolver/src/resolvers/resolvers.test.ts

import { describe, expect, it } from 'vitest'
import type { ResolverDeps, ResolverResult } from './index'
import { resolveUrl } from './index'

// ---------------------------------------------------------------------------
// Minimal stub deps — the generic no-op makes no network calls
// ---------------------------------------------------------------------------
function makeDeps(): ResolverDeps {
  return {
    quality: '720p',
    http: async () => ({ status: 200, body: '' }),
    log: {
      info: () => undefined,
      warn: () => undefined,
      debug: () => undefined,
    },
  }
}

// ---------------------------------------------------------------------------
// 1. Type-level: a mux-shaped object satisfies ResolverResult
// This test is compile-time only — if it builds it passes.
// ---------------------------------------------------------------------------
it('ResolverResult type accepts a mux shape', () => {
  const muxResult: ResolverResult = {
    kind: 'mux',
    video: { url: 'https://video.example.com/v.mp4' },
    audio: { url: 'https://audio.example.com/a.m4a' },
    container: 'mp4',
  }
  expect(muxResult.kind).toBe('mux')
})

// ---------------------------------------------------------------------------
// 2. Type-level: a direct-shaped object satisfies ResolverResult
// ---------------------------------------------------------------------------
it('ResolverResult type accepts a direct shape', () => {
  const directResult: ResolverResult = {
    kind: 'direct',
    directUrl: 'https://cdn.example.com/file.mp4',
    headers: { Authorization: 'Bearer token' },
  }
  expect(directResult.kind).toBe('direct')
})

// ---------------------------------------------------------------------------
// 3. resolveUrl ships no risky extractor: a non-Commons URL falls to the
// generic no-op, which resolves nothing → null. (Commons resolution is covered
// by commons.test.ts.) This is the official builtin's harmless-face invariant.
// ---------------------------------------------------------------------------
describe('resolveUrl — no extractor for non-Commons URLs', () => {
  it('returns null for a bilibili video URL (no site extractor shipped)', async () => {
    const result = await resolveUrl(
      'https://www.bilibili.com/video/BV1xx411c7mD',
      makeDeps()
    )
    expect(result).toBeNull()
  })

  it('returns null for a youtube watch URL (no site extractor shipped)', async () => {
    const result = await resolveUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      makeDeps()
    )
    expect(result).toBeNull()
  })

  it('returns null for a plain HTTP file URL', async () => {
    const result = await resolveUrl(
      'https://example.com/plain-file.zip',
      makeDeps()
    )
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. Mux ResolverResult fixture — the union variant is still usable end-to-end
// (site-resolver plugins produce it; the host mux seam consumes it).
// ---------------------------------------------------------------------------
describe('mux ResolverResult fixture', () => {
  function makeMuxResult(): ResolverResult {
    return {
      kind: 'mux',
      video: {
        url: 'https://r1.googlevideo.com/videoplayback?itag=137',
        headers: { Range: 'bytes=0-' },
      },
      audio: {
        url: 'https://r1.googlevideo.com/videoplayback?itag=140',
        headers: { Range: 'bytes=0-' },
      },
      container: 'mp4',
    }
  }

  it('mux fixture has the expected shape', () => {
    const r = makeMuxResult()
    expect(r.kind).toBe('mux')
    if (r.kind === 'mux') {
      expect(r.video.url).toContain('itag=137')
      expect(r.audio.url).toContain('itag=140')
      expect(r.container).toBe('mp4')
      // narrow ensures directUrl is NOT a property on mux
      // @ts-expect-error directUrl is not on mux variant
      expect(() => r.directUrl).not.toThrow()
    }
  })

  it('mux fixture container can be mkv', () => {
    const r: ResolverResult = {
      kind: 'mux',
      video: { url: 'https://v.example.com/v.mkv' },
      audio: { url: 'https://a.example.com/a.mka' },
      container: 'mkv',
    }
    expect(r.kind).toBe('mux')
    if (r.kind === 'mux') {
      expect(r.container).toBe('mkv')
    }
  })
})
