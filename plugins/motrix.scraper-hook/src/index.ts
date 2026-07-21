import {
  type BeforeCreateHttpContext,
  config,
  hooks,
  http,
  lifecycle,
  log,
} from 'motrix:plugin-api'
import { findArchiveLink } from './scrapers'

const DEFAULT_MAX_BODY = 524288

async function isEnabled(): Promise<boolean> {
  const v = await config.get<boolean>('enabled')
  return v !== false
}

async function readMaxBody(): Promise<number> {
  const v = await config.get<number>('maxBodyBytes')
  return typeof v === 'number' && v > 0 ? v : DEFAULT_MAX_BODY
}

hooks.beforeCreate(
  async (ctx: BeforeCreateHttpContext): Promise<BeforeCreateHttpContext> => {
    if (ctx.type !== 'http') return ctx
    if (!(await isEnabled())) return ctx
    const url = ctx.uris[0]
    if (!url) return ctx
    try {
      const head = await http.request({
        method: 'HEAD',
        url,
        responseType: 'text',
        timeoutMs: 5_000,
      })
      const ctHeader = head.headers.find(
        (h) => h.name.toLowerCase() === 'content-type'
      )
      const ct = ctHeader?.value ?? ''
      if (!ct.includes('text/html')) return ctx
      const maxBody = await readMaxBody()
      const res = await http.request({
        method: 'GET',
        url,
        responseType: 'text',
        timeoutMs: 10_000,
        maxBodyBytes: maxBody,
      })
      const archiveUrl = findArchiveLink(res.body as string, url)
      if (archiveUrl) {
        log.info('scraper rewrote URL', { from: url, to: archiveUrl })
        ctx.update({ uris: [archiveUrl] })
      }
    } catch (e) {
      log.warn('scraper failed', { err: String(e) })
    }
    return ctx
  }
)

lifecycle.onDeactivate(async () => {
  log.info('shutting down scraper-hook')
})
