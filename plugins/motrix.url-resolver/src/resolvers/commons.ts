import type { ResolverDeps, ResolverResult } from './index'

// Wikimedia Commons demo resolver.
//
// Commons hosts ONLY freely-licensed (CC / public-domain) media and exposes a
// public, documented MediaWiki API — no auth, no signing, no circumvention.
// This resolver turns a `File:` page URL into its direct upload.wikimedia.org
// URL via the imageinfo API, documenting the page→API→direct extension point on
// a zero-risk source. It is the official builtin's only shipped resolver; all
// site-specific extractors live in separately installed plugins.

const FILE_PAGE_RE = /^https?:\/\/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/i

// Wikimedia's API etiquette asks callers to send a descriptive User-Agent.
const API_UA = 'MotrixURLResolver/1.0 (+https://motrix.app)'

export function match(url: string): boolean {
  return FILE_PAGE_RE.test(url)
}

export async function resolve(
  url: string,
  deps: ResolverDeps
): Promise<ResolverResult | null> {
  const m = FILE_PAGE_RE.exec(url)
  if (!m?.[1]) return null

  let title: string
  try {
    title = decodeURIComponent(m[1])
  } catch {
    title = m[1]
  }

  const api =
    'https://commons.wikimedia.org/w/api.php' +
    '?action=query&format=json&prop=imageinfo&iiprop=url' +
    `&titles=${encodeURIComponent(title)}`

  let resp: { status: number; body: string }
  try {
    resp = await deps.http(api, {
      headers: { 'User-Agent': API_UA },
      timeoutMs: 10_000,
    })
  } catch (e) {
    deps.log.warn('commons: api request failed', { err: String(e) })
    return null
  }

  if (resp.status !== 200) {
    deps.log.warn('commons: api non-200', { status: resp.status })
    return null
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(resp.body) as Record<string, unknown>
  } catch {
    deps.log.warn('commons: response not valid JSON')
    return null
  }

  const query = data.query as Record<string, unknown> | undefined
  const pages = query?.pages as Record<string, unknown> | undefined
  if (!pages) {
    deps.log.info('commons: no pages in response', { title })
    return null
  }

  const firstPage = Object.values(pages)[0] as
    | Record<string, unknown>
    | undefined
  const imageinfo = firstPage?.imageinfo as
    | Array<Record<string, unknown>>
    | undefined
  const directUrl = imageinfo?.[0]?.url

  if (typeof directUrl !== 'string' || directUrl.length === 0) {
    deps.log.info('commons: no imageinfo url', { title })
    return null
  }

  return { kind: 'direct', directUrl }
}
