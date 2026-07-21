# 发布内置插件

[English](./releasing.md) | 简体中文

本文供维护者参考，介绍如何正式发布 Motrix 内置插件。构建和测试方法请查看 README 中的[开发](../README.zh-CN.md#开发)一节。

## 背景

这个仓库按照 2026 年 7 月 18 日的“内置插件独立更新”设计，从 `motrix-turbo` 中拆分而来。拆分后，每个内置插件都可以使用自己的版本和 tag 发布，不必再等待整个应用发版。

拉取流程切换完成后，`motrix-turbo` 会运行 `scripts/fetch-builtins.mjs`，按照 lockfile 中锁定的版本下载这里发布的已签名 `.moext` 文件。

在 `motrix-turbo` 完成这项切换之前，`motrix-turbo/builtin-plugins/` 中的插件副本仍是应用打包时使用的版本。修改插件时需要同步两个仓库，避免内容不一致。

## 发布步骤

1. 修改 `plugins/<id>/motrix-plugin.json` 中的 `version`。
2. 使用 `<id>@<version>` 格式为这个提交创建 tag，然后推送到远端。例如：

   ```bash
   git tag motrix.url-resolver@1.1.0
   git push origin motrix.url-resolver@1.1.0
   ```

3. 推送 tag 后会触发 `.github/workflows/release.yml`。工作流会：

   - 检查插件清单中的版本是否与 tag 一致；
   - 构建整个工作区，并完成类型检查和测试；
   - 将对应插件打包为 `.moext`，同时生成 `.metadata.json`；
   - 为 `.moext` 生成独立的 Ed25519 签名；
   - 创建 GitHub Release，并附上 `.moext`、`.moext.sig` 和 `.metadata.json`。

Tag 必须符合 `motrix.<name>@<semver>` 格式。格式不对时，`scripts/parse-tag.mjs` 会直接报错，不会继续打包。

## 签名密钥管理

- Ed25519 **私钥**只能存放在 GitHub Actions 的 `MOTRIX_PLUGIN_SIGNING_KEY` secret 中。该 secret 归属 `plugin-signing` Environment，`release.yml` 中的每次发布也都绑定到这个 Environment。不要把私钥提交到仓库、长期保存在开发者电脑上或输出到日志中。
- 能不能发布由 GitHub 上的两项设置决定：Environment 的审核人规则，以及针对 `motrix.*@*` 的 protected-tag ruleset。这两项都需要手动配置，工作流既不能代你启用，也不能确认它们是否生效。确认之前不要假定保护已经开启；当前状态以 `release.yml` 中的注释为准。在两项保护确认生效前，任何能推送 release tag 的人实际上都能发布带官方签名的插件。
- 轮换密钥时，运行 `node scripts/keygen.mjs` 生成一对新密钥。只把新私钥保存到 GitHub secret，然后删除本地生成的密钥文件。
- 对应的**公钥**将固定在 `motrix-turbo` 中。插件拉取功能完成后，`motrix-turbo` 会在安装更新前验证每个 `.moext` 的签名。目前用于搭建流程的 `fetch-builtins.mjs` 只会根据 lockfile 检查文件的 SHA-256；客户端暂时还不会验证签名。

## 验证插件包

把 release 中的 `.moext` 和对应的 `.moext.sig` 放在同一个目录，然后运行：

```bash
node scripts/verify.mjs <id>-<version>.moext --pub <signing-public-key.pem>
```

## npm 发布前的临时配置

在 `@motrix/plugin-api` 发布到 npm 之前，`pnpm-workspace.yaml` 中保留了下面这项临时 override：

```yaml
overrides:
  '@motrix/plugin-api': 'file:../plugin-sdk/packages/plugin-api'
```

这项配置要求 `plugin-sdk` 位于当前仓库的同级目录，与拆分前 `motrix-app/` 工作区的目录结构一致。

`@motrix/plugin-api` 发布后，应删除这项 override，并把三个插件 `devDependencies` 中的版本改为 npm 上已经发布的 `^x.y.z` 范围。
