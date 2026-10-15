# Media Merge for Motrix

[简体中文](README.zh-CN.md)

An official, optional audio/video merger (`motrix.media-merge`), installed separately from Motrix. It combines the
first video track from one file with the first audio track from another, copying
both without re-encoding. Supports MP4 and MKV outputs, including audio-only MP4
inputs. Unambiguously reversed inputs are detected and swapped automatically.

## Requirements

- **Motrix 2.0.0-beta.48 or later, below 3.0.0**, with plugin operations v1, composable UI, selected-file grants and the scoped media capability. Beta.48 is the first released host containing these capabilities. Beta.47 is rejected, including development builds still reporting that version.
- FFmpeg configured in **Settings → Integration → Media Tools**. Re-enable the
  plugin after changing FFmpeg configuration.

## Use

Install a signed release from the [plugin directory](https://motrix.app/plugins/motrix.media-merge/) and enable it. Local archives using the `motrix.*` namespace also require a valid official signature before installation.
Then either select two completed single-file downloads and choose **Merge audio
and video**, or open this plugin's **Operations** tab to select local files.
The tab embeds the same form as the task-menu dialog and retains selections
when switching tabs. Select a new `.mp4` or `.mkv` output filename and click **Merge**.

**Merge another file** clears both inputs, the output location and the previous result,
while retaining the selected MP4/MKV format. Choose the new files explicitly; the
previous task selection is not filled in again.

The host owns progress, cancellation, temporary files and non-overwriting output
publication. Original files remain untouched. The host snapshots selected inputs and publishes the output atomically without replacement. The destination filesystem must support private directories and native no-replace publication; unsupported filesystems are rejected. The Web UI reuses the server file browser to select inputs and a new output
filename, within its download directory policy. Files on the browser’s computer
are not uploaded.

This plugin does not concatenate clips, adjust sync offsets, transcode unsupported
codecs or run automatically after downloads. If MP4 rejects a codec, try MKV.

Inputs must be standalone media files (MP4/MOV, MKV/WebM, AVI, MPEG/TS, FLV,
AAC, MP3, FLAC, Ogg or WAV). Playlists, concat scripts and image sequences are
rejected before probing or merging, including references to local files.
The host requires absolute paths and applies directory policy after resolving
symlinks; relative references inside another file never inherit its authorization.

## Development

Run these commands from the repository root. This plugin uses the shared build, packaging, and signing pipeline. Do not add it to Motrix’s `scripts/builtins.lock.json`.

```sh
pnpm install
pnpm --filter motrix-builtin-media-merge typecheck
pnpm test
pnpm lint
node scripts/pack.mjs motrix.media-merge
```

The plugin declares `contributes.operations` with a private command registered using
`commands.registerOperation`. It requests `ffmpeg`, `files.selected.read` and
`files.selected.write`. These declarations do not grant arbitrary file access:
the host binds opaque selected-file references to one authorized operation.
There is no network permission or download lifecycle hook.

The handler receives `{ videoInput, audioInput, format, output }`, probes the selected
inputs with `context.media.probe`, swaps clearly reversed tracks, and awaits
`context.media.mergeStreams`. It returns the granted output reference; the host
validates and publishes the file. Generic and cross-plugin command calls cannot
invoke this operation. The manifest owns the form, localized labels, entry
points and error messages; no media-specific renderer is required.

Inputs are limited to 8 GiB each and 16 GiB per operation. Snapshot and output
staging require free disk space. Cancelling stops host-owned work before temporary
resources are removed; closing the form keeps the job running. Host restarts
interrupt jobs and never replay a merge automatically.
