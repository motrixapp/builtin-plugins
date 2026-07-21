# 发布内置插件

[English](./releasing.md) | 简体中文

本文供维护者参考，介绍如何正式发布 Motrix 内置插件。构建和测试方法请查看 README 中的[开发](../README.zh-CN.md#开发)一节。

## 背景

这个仓库按照 2026 年 7 月 18 日的“内置插件独立更新”设计，从 `motrix-turbo` 中拆分而来。拆分后，每个内置插件都可以使用自己的版本和 tag 发布，不必再等待整个应用发版。

`motrix-turbo` 通过 `scripts/fetch-builtins.mjs` 下载这里发布的已签名 `.moext` 文件，各插件的 tag 和 sha256 锁定在其 `scripts/builtins.lock.json` 中。

本仓库是内置插件代码的唯一来源。发布新版本后，需要到 `motrix-turbo` 更新 lockfile 中对应插件的记录，应用才会使用新版本。

## 发布步骤

1. 修改 `plugins/<id>/motrix-plugin.json` 中的 `version`。
2. 使用 `<id>@<version>` 格式为这个提交创建 tag，然后推送到远端。例如：

   ```bash
   git tag motrix.url-resolver@1.1.0
   git push origin motrix.url-resolver@1.1.0
   ```

3. 推送 tag 后会触发 `.github/workflows/release.yml`，它分两个 job 执行：

   - **build**（不接触密钥）：检查插件清单中的版本是否与 tag 一致，构建整个工作区并完成类型检查和测试，将对应插件打包为 `.moext` 和 `.metadata.json`，以 workflow artifact 形式移交；
   - **sign**（绑定 `plugin-signing` Environment，需审核人批准后才会运行）：确认 tag 指向的提交已经合入 `main`，只使用 `main` 上的脚本为预构建的 `.moext` 生成独立的 Ed25519 签名，用 `keys/signing-key.pub.pem` 交叉核对签名，然后创建 GitHub Release，附上 `.moext`、`.moext.sig` 和 `.metadata.json`。

Tag 必须符合 `motrix.<name>@<semver>` 格式。格式不对时，`scripts/parse-tag.mjs` 会直接报错，不会继续打包。

## 签名密钥管理

- Ed25519 **私钥**只能存放在 GitHub Actions 的 `MOTRIX_PLUGIN_SIGNING_KEY` secret 中。该 secret 归属 `plugin-signing` Environment，`release.yml` 中的每次发布也都绑定到这个 Environment。不要把私钥提交到仓库、长期保存在开发者电脑上或输出到日志中。
- 能不能发布由 GitHub 上的两项设置决定：针对 `motrix.*@*` 的 protected-tag ruleset（只有 repo admin 能创建、移动或删除 release tag），以及 Environment 的审核人规则（每次发布运行都要先经审核人批准才会执行）。这两项属于 GitHub 配置而非工作流代码；存疑时用 `gh ruleset list` 和 `gh api repos/<owner>/<repo>/environments` 复核，带日期的状态记录见 `release.yml` 中的注释。
- 轮换密钥时，运行 `node scripts/keygen.mjs` 生成一对新密钥。只把新私钥保存到 GitHub secret，用新公钥替换 `keys/signing-key.pub.pem`，然后删除本地生成的私钥文件。
- 对应的**公钥**提交在仓库的 `keys/signing-key.pub.pem` 中，验证插件包时以它为准。`motrix-turbo` 在 `scripts/builtins-signing.pub.pem` 固定了同一把公钥，其 `fetch-builtins.mjs` 在安装前除了核对 lockfile 中的 SHA-256，还会在每个来源验证 `.moext` 的 Ed25519 签名。

## 验证插件包

把 release 中的 `.moext` 和对应的 `.moext.sig` 放在同一个目录，然后运行：

```bash
node scripts/verify.mjs <id>-<version>.moext --pub keys/signing-key.pub.pem
```
