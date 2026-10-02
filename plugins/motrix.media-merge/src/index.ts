import { commands, ffmpeg, i18n } from 'motrix:plugin-api'

interface MediaInfo {
  durationMs?: number
  streams?: Array<{ type?: string }>
}

commands.register<
  { videoInput: string; audioInput: string; output: string },
  { outputPath: string }
>(
  'motrix.media-merge.mergeStreams',
  async ({ videoInput, audioInput, output }) => {
    if (!ffmpeg.available) throw new Error(i18n.t('ffmpegMissing'))
    if (!videoInput || !audioInput || videoInput === audioInput)
      throw new Error(i18n.t('differentFiles'))
    if (!/\.(mp4|mkv)$/i.test(output)) throw new Error(i18n.t('outputFormat'))
    const first = (await ffmpeg.probe({ path: videoInput })) as MediaInfo
    const second = (await ffmpeg.probe({ path: audioInput })) as MediaInfo
    const has = (info: MediaInfo, type: string) =>
      info?.streams?.some((stream) => stream.type === type)
    let durationMs = first.durationMs
    if (!(has(first, 'video') && has(second, 'audio'))) {
      if (!(has(second, 'video') && has(first, 'audio')))
        throw new Error(i18n.t('missingStreams'))
      ;[videoInput, audioInput] = [audioInput, videoInput]
      durationMs = second.durationMs
    }
    const operation = await ffmpeg.mergeStreams({
      videoInput,
      audioInput,
      output,
      expectedDurationMs:
        typeof durationMs === 'number' && Number.isFinite(durationMs)
          ? Math.max(0, durationMs)
          : 0,
    })
    await operation.result
    return { outputPath: output }
  }
)
