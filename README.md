# DSH-Desktop

`DSH-Desktop` 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Windows/macOS 桌面宿主。它保留官方 Web UI 和插件体系，并负责本机引擎生命周期、独立 Node.js 运行时、自动更新、跨平台打包与进程清理。

> 当前为开发预览版。桌面端固定使用 `@deepseek-ai/dsh 0.1.0-rc.6`；Nightly 流水线可以检测上游 npm 新版本并构建新的 Dev 桌面包，但客户端不会在运行时直接执行不受控的 `@latest`。

## 架构

```text
Electron sandboxed renderer
        │ 127.0.0.1 random port
        ▼
DSH web profile (separate Node.js process)
        │
        ├─ Harness plugins / sessions / tools
        └─ Windows ACL or macOS Seatbelt sandbox
```

- Electron Renderer 禁用 Node 集成，启用 Context Isolation 和 Chromium Sandbox。
- Harness 只监听 `127.0.0.1` 的随机端口。
- 安装包内携带经过 SHA-256 校验的 Node.js 24 LTS，终端用户无需安装 Node、pnpm 或 Git。
- 桌面程序关闭或更新前会停止 Harness 及其子进程。
- 程序文件和用户数据分离；覆盖更新不会删除配置、会话或工作区记录。

## 本地开发

需要 Node.js 24 和 pnpm 11：

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm smoke:engine
pnpm start
```

生成当前平台安装包：

```powershell
pnpm dist
```

输出位于 `release/`。

## 更新策略

更新频道按平台和架构隔离：

- `dev-win-x64`
- `dev-mac-x64`
- `dev-mac-arm64`

Windows 使用 NSIS + blockmap 差分下载；差分不可用时自动回退到完整包。macOS 使用签名后的 ZIP/DMG 覆盖更新。macOS 自动更新必须完成 Developer ID 签名；公开发布还应完成 Apple notarization。

本地构建没有 GitHub 更新源。GitHub Actions 打包时会根据 `GITHUB_REPOSITORY` 自动生成 `app-update.yml`。正式发布前需要配置 Windows/macOS 代码签名机密。

## 数据位置

- Windows：`%APPDATA%\DSH-Desktop`
- macOS：`~/Library/Application Support/DSH-Desktop`

日志在上述目录的 `logs/` 子目录，Harness 数据在 `harness/` 子目录。

## 上游跟随

`.github/workflows/upstream-nightly.yml` 每天检查 `@deepseek-ai/dsh` 的 npm 最新版本。当该版本尚无对应 Nightly Release 时，它会在 Windows x64、macOS Intel 和 macOS Apple Silicon 上分别安装这个精确版本、运行测试并打包预发布版本。稳定版应改为升级 PR + 人工批准流程。

## 商标与归属

本项目是独立桌面封装，不代表 DeepSeek 官方产品。DeepSeek Harness 的版权和许可证归其各自权利人所有；详见 `THIRD_PARTY_NOTICES.md`。

