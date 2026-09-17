import type { BeforeCreateHttpContext } from 'motrix:plugin-api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  config: { get: vi.fn() },
  hooks: { beforeCreate: vi.fn() },
  http: { request: vi.fn() },
  lifecycle: { onDeactivate: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn() },
}))
vi.mock('motrix:plugin-api', () => api)

describe('optional scraper budget', () => {
  let run: (ctx: BeforeCreateHttpContext) => Promise<BeforeCreateHttpContext>
  let ctx: BeforeCreateHttpContext
  beforeEach(async () => {
    vi.resetModules()
    vi.resetAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(0)
    api.config.get.mockResolvedValue(undefined)
    await import('./index')
    run = api.hooks.beforeCreate.mock.calls[0]![0]
    ctx = {
      type: 'http',
      uris: ['https://example.test/page'],
      headers: [{ name: 'Referer', value: 'https://example.test/' }],
      update: vi.fn(),
    } as unknown as BeforeCreateHttpContext
  })
  afterEach(() => vi.useRealTimers())

  it('shares one three-second deadline across HEAD and GET', async () => {
    api.http.request
      .mockImplementationOnce(async () => {
        vi.setSystemTime(2400)
        return { headers: [{ name: 'Content-Type', value: 'text/html' }] }
      })
      .mockResolvedValueOnce({ body: '<html></html>', headers: [] })
    expect(await run(ctx)).toBe(ctx)
    expect(
      api.http.request.mock.calls.map(([request]) => request.timeoutMs)
    ).toEqual([3000, 600])
    expect(api.http.request.mock.calls[1]![0]).toMatchObject({
      maxBodyBytes: 524288,
      headers: ctx.headers,
    })
  })

  it('does not start GET when HEAD has consumed the budget', async () => {
    api.http.request.mockImplementationOnce(async () => {
      vi.setSystemTime(3001)
      return { headers: [{ name: 'Content-Type', value: 'text/html' }] }
    })
    expect(await run(ctx)).toBe(ctx)
    expect(api.http.request).toHaveBeenCalledOnce()
  })

  it.each([
    'plugin.http.timeout',
    'plugin.http.network',
    'plugin.http.response_too_large',
  ])('falls back for %s without a partial update', async (code) => {
    api.http.request.mockRejectedValue(
      Object.assign(new Error('unavailable'), { code })
    )
    expect(await run(ctx)).toBe(ctx)
    expect(ctx.update).not.toHaveBeenCalled()
  })

  it.each([
    'plugin.http.aborted',
    'plugin.http.host_not_permitted',
    'plugin.http.redirect_not_allowed',
    'unknown',
  ])('propagates critical failure %s', async (code) => {
    const error = Object.assign(new Error('denied'), { code })
    api.http.request.mockRejectedValue(error)
    await expect(run(ctx)).rejects.toBe(error)
    expect(ctx.update).not.toHaveBeenCalled()
  })
})
