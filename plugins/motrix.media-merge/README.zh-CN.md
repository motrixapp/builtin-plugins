# Motrix 音视频合并插件

[English](README.md)

官方按需安装插件（`motrix.media-merge`），默认不随 Motrix 安装。将一个文件的第一条视频轨和另一个
文件的第一条音频轨合并，直接复制媒体轨道，不重新编码。支持 MP4、MKV 输出，也支持
仅包含音轨的 MP4 输入。输入顺序明确反转时会自动识别并交换。

## 使用要求

- Motrix `>=2.0.0-beta.47 <3.0.0`，且包含 **手动媒体合并界面**。当前宿主功能见 [Motrix PR #2308](https://github.com/agalwood/Motrix/pull/2308)；正式发布插件前必须确认最低版本已包含该功能。单独安装 `.moext` 不会为旧版本补上界面。
- 在 **设置 → 集成 → 媒体工具** 中配置 FFmpeg。修改 FFmpeg 配置后请重新启用插件。

## 使用方法

正式签名包发布后，可从 [插件目录](https://motrix.app/zh/plugins/motrix.media-merge/) 安装并启用。也可以在插件页面选择本仓库构建的 `dist/artifacts/motrix.media-merge-0.1.0.moext`。随后可以选中两个
已完成的单文件下载任务，选择 **合并音频和视频**；也可以进入本插件详情的 **操作**
页，直接选择本地文件。操作页和任务菜单弹窗共用表单，切换 Tab 会保留选择。填写新的 `.mp4` 或 `.mkv` 输出文件名后点击 **合并**。

进度、取消、临时文件和不覆盖的输出保存由宿主管理。源文件保持不变，目标文件系统需
支持硬链接。Web UI 复用服务器文件浏览器选择输入和新的输出文件名，并受服务器下载目录策略约束；
不会上传浏览器所在电脑的文件。

本插件不做片段首尾拼接、音画偏移调整或不兼容编码的转码，也不在下载后自动执行。
若 MP4 不支持当前编码，可尝试 MKV。

## 开发

在仓库根目录执行以下命令。插件使用仓库统一的构建、打包和签名发布流程；不要将它加入 Motrix 的 `scripts/builtins.lock.json`。

```sh
pnpm install
pnpm --filter motrix-builtin-media-merge typecheck
pnpm test
pnpm lint
node scripts/pack.mjs motrix.media-merge
```

仅申请 `ffmpeg` 权限，不申请网络权限，也不注册下载任务生命周期 Hook。插件通过既有
公开命令机制暴露 `motrix.media-merge.mergeStreams`，接收 `{ videoInput,
audioInput, output }`，操作成功后返回 `{ outputPath }`。启动调用和操作句柄的
`result` 都会被等待，以兼容 QuickJS 异步句柄传输。
