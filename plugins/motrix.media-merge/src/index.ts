import { commands } from 'motrix:plugin-api'

commands.registerOperation<
  {
    videoInput: string
    audioInput: string
    output: string
    format: 'mp4' | 'mkv'
  },
  { output: string }
>(
  'motrix.media-merge.mergeStreams',
  async ({ videoInput, audioInput, output, format }, context) => {
    if (videoInput === audioInput) context.fail('differentFiles')
    const first = await context.media.probe(videoInput)
    const second = await context.media.probe(audioInput)
    const has = (info: typeof first, type: string) =>
      info.streams.some((stream) => stream.type === type)
    let durationMs = first.durationMs
    if (!(has(first, 'video') && has(second, 'audio'))) {
      if (!(has(second, 'video') && has(first, 'audio')))
        context.fail('missingStreams')
      ;[videoInput, audioInput] = [audioInput, videoInput]
      durationMs = second.durationMs
    }
    context.signal.throwIfAborted()
    await context.media.mergeStreams({
      video: videoInput,
      audio: audioInput,
      output,
      format,
      expectedDurationMs: durationMs,
    })
    return { output }
  }
)
