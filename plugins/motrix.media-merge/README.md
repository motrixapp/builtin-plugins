# Media Merge for Motrix

[简体中文](README.zh-CN.md)

An official, optional audio/video merger (`motrix.media-merge`), installed separately from Motrix. It combines the
first video track from one file with the first audio track from another, copying
both without re-encoding. Supports MP4 and MKV outputs, including audio-only MP4
inputs. Unambiguously reversed inputs are detected and swapped automatically.

## Requirements

- Motrix `>=2.0.0-beta.47 <3.0.0` with the **manual media merge interface**. The host change is [Motrix PR #2308](https://github.com/agalwood/Motrix/pull/2308); confirm the minimum release contains it before publishing the plugin. The `.moext` alone does not add the interface to an older build.
- FFmpeg configured in **Settings → Integration → Media Tools**. Re-enable the
  plugin after changing FFmpeg configuration.

## Use

After the signed release is published, install it from the [plugin directory](https://motrix.app/plugins/motrix.media-merge/) and enable it. For local builds, select `dist/artifacts/motrix.media-merge-0.1.0.moext` on the Plugins page.
Then either select two completed single-file downloads and choose **Merge audio
and video**, or open this plugin's **Operations** tab to select local files.
The tab embeds the same form as the task-menu dialog and retains selections
when switching tabs. Select a new `.mp4` or `.mkv` output filename and click **Merge**.

The host owns progress, cancellation, temporary files and non-overwriting output
publication. Original files remain untouched. The destination filesystem must
support hard links. The Web UI reuses the server file browser to select inputs and a new output
filename, within its download directory policy. Files on the browser’s computer
are not uploaded.

This plugin does not concatenate clips, adjust sync offsets, transcode unsupported
codecs or run automatically after downloads. If MP4 rejects a codec, try MKV.

## Development

Run these commands from the repository root. This plugin uses the shared build, packaging, and signing pipeline. Do not add it to Motrix’s `scripts/builtins.lock.json`.

```sh
pnpm install
pnpm --filter motrix-builtin-media-merge typecheck
pnpm test
pnpm lint
node scripts/pack.mjs motrix.media-merge
```

The only requested permission is `ffmpeg`. The plugin has no network permission
and registers no task lifecycle hooks. It exposes the existing public-command
contract `motrix.media-merge.mergeStreams` with `{ videoInput, audioInput,
output }` and returns `{ outputPath }` after the operation succeeds. Both the
launch call and its `result` are awaited for compatibility with the asynchronous
QuickJS handle transport.
