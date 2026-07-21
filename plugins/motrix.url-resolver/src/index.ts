import {
  type BeforeCreateHttpContext,
  commands,
  config,
  hooks,
  http,
  type JsonValue,
  lifecycle,
  log,
} from 'motrix:plugin-api'
import { type Quality, type ResolverDeps, resolveUrl } from './resolvers'

const DEFAULT_QUALITY: Quality = '720p'

// This official builtin is the SiteResolver framework + a Wikimedia Commons
// demo resolver + a `generic` no-op. It ships no risky extractor, so buildDeps
// only wires the generic capabilities (http + log); a real site-resolver plugin
// brings its own resolver logic and any extra capabilities (e.g. crypto).
function buildDeps(quality: Quality): ResolverDeps {
  return {
    quality,
    http: async (url, init) => {
      const r = await http.request({
        method:
          (init?.method as
            | 'GET'
            | 'POST'
            | 'PUT'
            | 'DELETE'
            | 'HEAD'
            | 'PATCH') ?? 'GET',
        url,
        headers: init?.headers
          ? Object.entries(init.headers).map(([name, value]) => ({
              name,
              value,
            }))
          : undefined,
        body:
          init?.jsonBody !== undefined
            ? { type: 'json' as const, data: init.jsonBody as JsonValue }
            : undefined,
        responseType: 'text',
        timeoutMs: init?.timeoutMs ?? 10_000,
      })
      return { status: r.status, body: r.body as string }
    },
    log,
  }
}

async function readQuality(): Promise<Quality> {
  const v = await config.get<string>('preferredQuality')
  if (v === '1080p' || v === '720p' || v === '480p') return v
  return DEFAULT_QUALITY
}

// beforeCreate (pre-resolve band). The shipped Commons demo yields a single
// `direct` URL; this hook rewrites the download's uris to it. A `mux` result
// (from a site-resolver plugin) is not handled here — the host mux seam invokes
// the public resolve command for that.
hooks.beforeCreate(
  async (ctx: BeforeCreateHttpContext): Promise<BeforeCreateHttpContext> => {
    if (ctx.type !== 'http') return ctx
    const url = ctx.uris[0]
    if (!url) return ctx
    const quality = await readQuality()
    try {
      const r = await resolveUrl(url, buildDeps(quality))
      if (r && r.kind === 'direct') {
        const headerArr = Object.entries(r.headers ?? {}).map(
          ([name, value]) => ({ name, value })
        )
        ctx.update({ uris: [r.directUrl], headers: headerArr })
      }
    } catch (e) {
      log.warn('resolver failed', { err: String(e) })
    }
    return ctx
  }
)

interface ResolveArgs {
  url: string
  quality?: Quality
}

// Public extension-point command the host mux seam invokes. The shipped
// resolvers return either a `direct` result (Commons) or null (generic); a
// real site-resolver plugin returns a `mux` pair here.
commands.register('motrix.url-resolver.resolve', async (raw: JsonValue) => {
  const args = raw as unknown as ResolveArgs
  const quality = args.quality ?? DEFAULT_QUALITY
  const r = await resolveUrl(args.url, buildDeps(quality))
  if (!r) throw new Error('no resolver matched')
  return r as unknown as JsonValue
})

commands.register('motrix.url-resolver.flushCache', async () => {
  // No cache in the framework build — placeholder kept for API stability.
  log.debug('flushCache invoked (no-op)')
})

lifecycle.onDeactivate(async () => {
  log.info('shutting down url-resolver')
})
