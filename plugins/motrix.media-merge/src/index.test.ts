import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  handler: undefined as
    | ((args: unknown, context: unknown) => Promise<unknown>)
    | undefined,
}))
vi.mock('motrix:plugin-api', () => ({
  commands: {
    registerOperation: (_id: string, handler: typeof mock.handler) => {
      mock.handler = handler
    },
  },
}))

import './index'

const args = {
  videoInput: 'video-reference',
  audioInput: 'audio-reference',
  output: 'output-reference',
  format: 'mp4',
}
const context = {
  signal: new AbortController().signal,
  fail: (code: string): never => {
    throw new Error(code)
  },
  media: { probe: vi.fn(), mergeStreams: vi.fn() },
}
const invoke = (value = args) => mock.handler?.(value, context)
describe('media merge operation', () => {
  beforeEach(() => {
    context.signal = new AbortController().signal
    context.media.probe
      .mockReset()
      .mockResolvedValueOnce({ durationMs: 1000, streams: [{ type: 'video' }] })
      .mockResolvedValueOnce({ streams: [{ type: 'audio' }] })
    context.media.mergeStreams.mockReset().mockResolvedValue(undefined)
  })
  it('uses opaque references and returns the output reference', async () => {
    await expect(invoke()).resolves.toEqual({ output: args.output })
    expect(context.media.mergeStreams).toHaveBeenCalledWith({
      video: args.videoInput,
      audio: args.audioInput,
      output: args.output,
      format: 'mp4',
      expectedDurationMs: 1000,
    })
  })
  it('swaps reversed track roles and supports MKV', async () => {
    context.media.probe
      .mockReset()
      .mockResolvedValueOnce({ streams: [{ type: 'audio' }] })
      .mockResolvedValueOnce({ durationMs: 2000, streams: [{ type: 'video' }] })
    await invoke({ ...args, format: 'mkv' })
    expect(context.media.mergeStreams).toHaveBeenCalledWith({
      video: args.audioInput,
      audio: args.videoInput,
      output: args.output,
      format: 'mkv',
      expectedDurationMs: 2000,
    })
  })
  it('keeps roles for dual-track inputs', async () => {
    context.media.probe
      .mockReset()
      .mockResolvedValue({ streams: [{ type: 'video' }, { type: 'audio' }] })
    await invoke()
    expect(context.media.mergeStreams).toHaveBeenCalledWith(
      expect.objectContaining({ video: args.videoInput })
    )
  })
  it('rejects missing tracks and duplicate references', async () => {
    context.media.probe
      .mockReset()
      .mockResolvedValue({ streams: [{ type: 'audio' }] })
    await expect(invoke()).rejects.toThrow('missingStreams')
    await expect(
      invoke({ ...args, audioInput: args.videoInput })
    ).rejects.toThrow('differentFiles')
    expect(context.media.mergeStreams).not.toHaveBeenCalled()
  })
  it('awaits completion and propagates failures', async () => {
    let reject!: (e: Error) => void
    context.media.mergeStreams.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        })
    )
    const pending = expect(invoke()).rejects.toThrow('cancelled')
    await vi.waitFor(() =>
      expect(context.media.mergeStreams).toHaveBeenCalled()
    )
    reject(new Error('cancelled'))
    await pending
  })
  it('does not launch after cancellation during probe', async () => {
    const controller = new AbortController()
    context.signal = controller.signal
    controller.abort()
    await expect(invoke()).rejects.toThrow()
    expect(context.media.mergeStreams).not.toHaveBeenCalled()
  })
})
