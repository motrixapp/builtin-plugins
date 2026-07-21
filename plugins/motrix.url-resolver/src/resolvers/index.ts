import type { JsonValue } from 'motrix:plugin-api'
import { match as matchCommons, resolve as resolveCommons } from './commons'
import { match as matchGeneric, resolve as resolveGeneric } from './generic'

export type Quality = '1080p' | '720p' | '480p'

export interface ResolverDeps {
  /** Preferred media quality from plugin config (unused by the demo/no-op). */
  quality: Quality
  http: HttpFn
  log: Logger
}

export type ResolverResult =
  | { kind: 'direct'; directUrl: string; headers?: Record<string, string> }
  | {
      kind: 'mux'
      video: { url: string; headers?: Record<string, string> }
      audio: { url: string; headers?: Record<string, string> }
      container: 'mp4' | 'mkv'
      /** Optional human-readable title for the output filename. */
      title?: string
    }

export type HttpFn = (
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    jsonBody?: unknown
    timeoutMs?: number
  }
) => Promise<{ status: number; body: string }>

export interface Logger {
  info(msg: string, fields?: Record<string, JsonValue>): void
  warn(msg: string, fields?: Record<string, JsonValue>): void
  debug(msg: string, fields?: Record<string, JsonValue>): void
}

interface SiteResolver {
  name: string
  match(url: string): boolean
  resolve(url: string, deps: ResolverDeps): Promise<ResolverResult | null>
}

// This official builtin ships NO site-specific extractors. It is the
// SiteResolver framework + a `commons` demo resolver (Wikimedia Commons, a
// freely-licensed source with a public API — zero circumvention) + a `generic`
// no-op that matches everything else and resolves nothing. Real site-specific
// extraction is provided by separately installed site-resolver plugins, each
// contributing its own hostPermissions and `<id>.resolve` command; the host
// mux seam routes to them.
const SITE_RESOLVERS: ReadonlyArray<SiteResolver> = [
  { name: 'commons', match: matchCommons, resolve: resolveCommons },
  { name: 'generic', match: matchGeneric, resolve: resolveGeneric },
]

export async function resolveUrl(
  url: string,
  deps: ResolverDeps
): Promise<ResolverResult | null> {
  for (const r of SITE_RESOLVERS) {
    if (!r.match(url)) continue
    deps.log.debug('site resolver matched', { resolver: r.name, url })
    return r.resolve(url, deps)
  }
  return null
}
