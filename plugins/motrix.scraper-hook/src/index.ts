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
const DISCOVERY_BUDGET_MS = 3_000
const OPTIONAL_NETWORK_ERRORS = new Set([
  'plugin.http.timeout',
  'plugin.http.network',
  'plugin.http.response_too_large',
  'plugin.http.too_many_redirects',
])

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
    const deadline = Date.now() + DISCOVERY_BUDGET_MS
    const maxBody = await readMaxBody()
    const remaining = () => Math.max(0, deadline - Date.now())
    try {
      const headBudget = remaining()
      if (!headBudget) return ctx
      const head = await http.request({
        method: 'HEAD',
        url,
        responseType: 'text',
        headers: ctx.headers,
        timeoutMs: headBudget,
      })
      const ctHeader = head.headers.find(
        (h) => h.name.toLowerCase() === 'content-type'
      )
      const ct = ctHeader?.value ?? ''
      if (!ct.includes('text/html')) return ctx
      const getBudget = remaining()
      if (!getBudget) return ctx
      const res = await http.request({
        method: 'GET',
        url,
        responseType: 'text',
        headers: ctx.headers,
        timeoutMs: getBudget,
        maxBodyBytes: maxBody,
      })
      const archiveUrl = findArchiveLink(res.body as string, url)
      if (archiveUrl) {
        log.info('scraper discovered a download target')
        ctx.update({ uris: [archiveUrl] })
      }
    } catch (e) {
      const code =
        typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : ''
      if (!OPTIONAL_NETWORK_ERRORS.has(code)) throw e
      log.warn('optional discovery unavailable', { code })
    }
    return ctx
  }
)

lifecycle.onDeactivate(async () => {
  log.info('shutting down scraper-hook')
})
