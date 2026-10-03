import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  handlers: new Map<string, (args: unknown) => Promise<unknown>>(),
  ffmpeg: { available: true, probe: vi.fn(), mergeStreams: vi.fn() },
}))
vi.mock('motrix:plugin-api', () => ({
  commands: {
    register: (id: string, handler: (args: unknown) => Promise<unknown>) =>
      mock.handlers.set(id, handler),
  },
  ffmpeg: mock.ffmpeg,
  i18n: { t: (key: string) => key },
}))

import './index'

const invoke = (args: unknown) =>
  mock.handlers.get('motrix.media-merge.mergeStreams')!(args)
const args = {
  videoInput: '/video.mp4',
  audioInput: '/audio.mp4',
  output: '/merged.mp4',
}

describe('media merge plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mock.ffmpeg.available = true
    mock.ffmpeg.probe
      .mockReset()
      .mockResolvedValueOnce({ durationMs: 3000, streams: [{ type: 'video' }] })
      .mockResolvedValueOnce({ streams: [{ type: 'audio' }] })
    mock.ffmpeg.mergeStreams.mockResolvedValue({
      result: Promise.resolve({ outputPath: args.output }),
    })
  })
  it('detects tracks and waits for the asynchronous operation handle and result', async () => {
    let finish: (value: unknown) => void = () => {}
    mock.ffmpeg.mergeStreams.mockResolvedValue({
      result: new Promise((resolve) => {
        finish = resolve
      }),
    })
    let completed = false
    const pending = invoke(args).then((result) => {
      completed = true
      return result
    })
    await vi.waitFor(() => expect(mock.ffmpeg.mergeStreams).toHaveBeenCalled())
    expect(completed).toBe(false)
    finish({ outputPath: args.output })
    await expect(pending).resolves.toEqual({ outputPath: args.output })
    expect(mock.ffmpeg.mergeStreams).toHaveBeenCalledWith({
      ...args,
      expectedDurationMs: 3000,
    })
  })
  it('swaps unambiguously reversed inputs, including audio in an MP4 container', async () => {
    mock.ffmpeg.probe
      .mockReset()
      .mockResolvedValueOnce({ streams: [{ type: 'audio' }] })
      .mockResolvedValueOnce({ durationMs: 1000, streams: [{ type: 'video' }] })
    await invoke(args)
    expect(mock.ffmpeg.mergeStreams).toHaveBeenCalledWith({
      videoInput: args.audioInput,
      audioInput: args.videoInput,
      output: args.output,
      expectedDurationMs: 1000,
    })
  })
  it('rejects missing streams without launching a merge', async () => {
    mock.ffmpeg.probe
      .mockReset()
      .mockResolvedValue({ streams: [{ type: 'audio' }] })
    await expect(invoke(args)).rejects.toThrow('missingStreams')
    expect(mock.ffmpeg.mergeStreams).not.toHaveBeenCalled()
  })
  it('guides users to configure FFmpeg when unavailable', async () => {
    mock.ffmpeg.available = false
    await expect(invoke(args)).rejects.toThrow('ffmpegMissing')
    expect(mock.ffmpeg.probe).not.toHaveBeenCalled()
  })
  it('propagates a codec or cancellation failure', async () => {
    mock.ffmpeg.mergeStreams.mockRejectedValue(new Error('unsupported codec'))
    await expect(invoke(args)).rejects.toThrow('unsupported codec')
  })
  it('propagates an operation failure after a successful launch', async () => {
    let fail: (reason: Error) => void = () => {}
    mock.ffmpeg.mergeStreams.mockResolvedValue({
      result: new Promise((_resolve, reject) => {
        fail = reject
      }),
    })
    const pending = expect(invoke(args)).rejects.toThrow('cancelled')
    await vi.waitFor(() => expect(mock.ffmpeg.mergeStreams).toHaveBeenCalled())
    fail(new Error('cancelled'))
    await pending
  })
  it('keeps the selected track roles for dual-track files and supports MKV', async () => {
    mock.ffmpeg.probe.mockReset().mockResolvedValue({
      durationMs: Number.NaN,
      streams: [{ type: 'video' }, { type: 'audio' }],
    })
    const mkv = { ...args, output: '/merged.mkv' }
    await expect(invoke(mkv)).resolves.toEqual({ outputPath: mkv.output })
    expect(mock.ffmpeg.mergeStreams).toHaveBeenCalledWith({
      ...mkv,
      expectedDurationMs: 0,
    })
  })
  it.each([
    [{ ...args, videoInput: '' }, 'differentFiles'],
    [{ ...args, audioInput: args.videoInput }, 'differentFiles'],
    [{ ...args, output: '/merged.avi' }, 'outputFormat'],
  ])('rejects invalid selections before probing', async (selection, error) => {
    await expect(invoke(selection)).rejects.toThrow(error)
    expect(mock.ffmpeg.probe).not.toHaveBeenCalled()
    expect(mock.ffmpeg.mergeStreams).not.toHaveBeenCalled()
  })
})
