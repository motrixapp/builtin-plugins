# Motrix 内置插件

[English](./README.md) | 简体中文

**[Motrix](https://motrix.app) 官方自带的三个插件，开箱即用。**

---

Motrix 2 自带三个插件，分别用来重命名下载好的文件、从下载页面中找到真正的文件链接，以及解析支持的媒体页面。每个插件都可以在 Motrix 的 **Plugins** 页面中调整设置或停用。

这个仓库存放插件源码和发布脚本。下面先介绍各个插件的功能和用法；如果你准备参与开发，可以直接跳到[开发](#开发)。

## 快速了解

| 插件 | 适合用在…… |
|------|------------|
| 📝 [文件名模板](#-文件名模板) | 想让下载好的文件自动使用统一的命名格式 |
| 🔗 [页面抓取](#-页面抓取) | 下载链接打开后是一个网页，而不是文件本身 |
| 🎬 [URL 解析器](#-url-解析器) | 手里有受支持的媒体页面链接，想直接下载其中的文件 |

## 📝 文件名模板

*插件 ID：`motrix.filename-template`*

下载完成后，插件会按照你设置的模板重命名文件。文件放入下载目录前就会改好名字，因此目录中只会出现最终文件名。

模板可以使用以下占位符：

| 占位符 | 替换为 |
|--------|--------|
| `{{title}}` | 不含扩展名的原文件名 |
| `{{ext}}` | 文件扩展名 |
| `{{date}}` | `YYYY-MM-DD` 格式的当天日期 |
| `{{id}}` | 下载任务 ID |

例如，把模板设为 `{{date}} {{title}}.{{ext}}` 后，`vacation-photos.zip` 会保存为：

```text
2026-07-21 vacation-photos.zip
```

默认模板是 `{{title}}.{{ext}}`，也就是保持原文件名不变。

**设置**

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 文件名模板 | `{{title}}.{{ext}}` | 下载完成后使用的文件名模板 |

**补充说明**

- 支持 HTTP、FTP 和 BitTorrent 下载。
- 文件名中不能使用的字符（`/ \ < > : " | ? *`）会替换为 `_`，文件名最长为 200 个字符。

## 🔗 页面抓取

*插件 ID：`motrix.scraper-hook`*

有些所谓的“下载链接”其实只是一个 HTML 页面，真正的文件链接藏在页面里。直接下载这种链接，最后得到的往往只是一个没用的 `.html` 文件。

新建 HTTP 下载时，如果插件发现链接指向 HTML 页面，就会查找页面中的第一个压缩包或安装包链接。目前支持 `.zip`、`.tar.gz`、`.tgz`、`.rar`、`.7z`、`.exe`、`.dmg`、`.iso` 和 `.pkg`。找到后，Motrix 会改为下载对应的文件。

**示例**

```text
添加的链接：    https://example.com/downloads.html
实际下载链接：  https://example.com/files/app-2.3.1.dmg
```

**设置**

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 启用 | 开 | 是否扫描下载页面 |
| 最大页面大小 | 512 KiB | 允许扫描的最大 HTML 页面（4 KiB–2 MiB） |

**补充说明**

- 直接指向文件的链接不会受到影响。只有服务器表明目标是 HTML 页面时，插件才会扫描。
- 如果页面无法打开，或者页面中没有支持的文件链接，Motrix 会继续使用原链接下载。
- 插件会在 **Logs** 中记录每次链接变更及其原因。

## 🎬 URL 解析器

*插件 ID：`motrix.url-resolver`*

这个插件提供一套通用的 URL 解析能力，供各个网站的媒体解析插件使用。网站插件可以把媒体页面链接换成真正需要下载的文件链接。

插件内置了一个 **Wikimedia Commons** 解析器作为示例。粘贴 `https://commons.wikimedia.org/wiki/File:…` 这样的页面链接后，Motrix 会下载 Wikimedia 上的原始文件，而不是保存网页。

其他网站的解析器需要单独安装。它们可以共用这里的设置，例如首选清晰度。如果已安装的解析器都不支持某个 URL，Motrix 会保持原链接不变。

**设置**

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| 首选清晰度 | `720p` | 网站解析器优先请求的清晰度（`1080p`、`720p` 或 `480p`） |

## 在 Motrix 中使用

三个插件都已预装并默认启用。

1. **找到插件：** 点击左侧边栏中的 **Plugins**。
2. **启用或停用：** 使用插件卡片或详情页上的 **Enabled** 开关。
3. **修改设置：** 打开插件，进入 **Settings**，修改后点击 **Apply**。点击 **Reset** 可以恢复默认值。
4. **查看记录：** 在详情页中打开 **Logs**，可以看到最近的重命名、链接变更和解析记录。

Motrix 会自动授予内置插件所需的权限。你可以在只读的 **Access** 页面中查看这些权限。内置插件可以停用，但不能卸载。

---

## 开发

下面的内容面向贡献者和维护者。

这些插件会随 Motrix 一起安装，但每个插件都有自己的版本和发布节奏。为某个插件推送符合格式的 tag 后，GitHub Actions 会自动完成构建、测试、打包和签名，再把插件包发布到 GitHub Releases。这样一来，Motrix 不必等到下次应用发版就能更新插件。

### 目录结构

| 路径 | 说明 |
|------|------|
| `plugins/motrix.filename-template/` | 按用户设置的模板重命名下载好的文件 |
| `plugins/motrix.scraper-hook/` | 在 Motrix 解析下载任务前，从 HTML 页面中查找文件直链 |
| `plugins/motrix.url-resolver/` | 通用 URL 解析器，并附带 Wikimedia Commons 示例 |
| `shared/esbuild.base.mjs` | 三个插件共同使用的 `buildPlugin()` 构建配置 |
| `scripts/pack.mjs` | 构建插件并生成 `dist/artifacts/<id>-<version>.moext`，同时生成 `<id>-<version>.metadata.json`（包含 `id`、`version`、`file`、`sha256` 和 `size`） |
| `scripts/keygen.mjs` | 在首次配置签名或轮换密钥时生成 Ed25519 密钥对 |
| `scripts/sign.mjs` | 为 `.moext` 文件生成独立的 Ed25519 签名 `<file>.sig`，内容使用 base64 编码 |
| `scripts/verify.mjs` | 使用对应的公钥验证签名 |
| `scripts/parse-tag.mjs` | 读取 release tag（`motrix.<id>@<version>`）并返回插件 ID 和版本号 |
| `tests/` | 使用 Vitest 测试打包、tag 解析以及签名和验签 |
| `.github/workflows/ci.yml` | 在 push 和 pull request 时执行构建、类型检查和测试 |
| `.github/workflows/release.yml` | 推送 release tag 后，检查并发布对应插件 |

每个 `plugins/<id>/` 目录的基本结构都一样：`motrix-plugin.json` 是插件清单，`src/` 存放 TypeScript 源码，`locales/` 存放多语言文案，另外还有 `esbuild.config.mjs` 和 `tsconfig.json`。

### 常用命令

```bash
pnpm install               # 安装工作区依赖
pnpm -r build              # 构建所有插件的 dist/plugin.js
pnpm -r typecheck          # 对所有插件做类型检查，不生成文件
pnpm test                  # 运行 Vitest 测试
pnpm lint                  # 运行 Biome 检查（lint 与格式）
node scripts/pack.mjs      # 把所有插件打包到 dist/artifacts/*.moext
node scripts/pack.mjs <id> # 只打包一个插件，例如 motrix.url-resolver
```

打包脚本会先运行所选插件的 `pnpm build`，因此不需要提前执行 `pnpm -r build`。

### 发布

每个插件都有自己的 release tag，格式为 `motrix.<name>@<semver>`，例如 `motrix.url-resolver@1.1.0`。

推送 tag 后，发布工作流会构建、测试、打包并签名对应的插件，然后创建一条 GitHub Release，其中包括：

- `.moext` 插件包；
- 独立的 Ed25519 签名 `.moext.sig`；
- 记录插件包 SHA-256 哈希值和大小的 `.metadata.json` 文件。

可以使用 Motrix 的插件签名公钥验证下载好的插件包：

```bash
node scripts/verify.mjs <id>-<version>.moext --pub keys/signing-key.pub.pem
```

完整的发布步骤、签名密钥管理规则和首次发布准备，请查看[内置插件发布指南](./docs/releasing.zh-CN.md)。
