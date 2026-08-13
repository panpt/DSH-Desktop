# DSH-Desktop

[English](README.md) | [简体中文](README.zh-CN.md)

[![桌面端 CI](https://github.com/panpt/DSH-Desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/panpt/DSH-Desktop/actions/workflows/ci.yml)

DSH-Desktop 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的独立 Windows/macOS 桌面宿主。它保留上游 Harness Web UI 和插件体系，同时提供内置运行时、本地进程管理、原生菜单、桌面更新与跨平台打包。

> 当前为开发预览版，不是 DeepSeek 官方产品。DSH-Desktop `0.2.0-beta.1` 固定内置上游 `@deepseek-ai/dsh 0.1.0-rc.6`。

## 功能

- 支持 Windows x64、macOS Intel 和 macOS Apple Silicon。
- 桌面外壳支持英文和简体中文，包括启动/错误页面、菜单、版本信息和更新对话框。
- 根据操作系统语言自动选择，并可通过“语言”菜单或启动页手动切换；选择结果会持久保存。
- 安装包内置经过校验的 Node.js 24 LTS，用户无需安装 Node.js、pnpm 或 Git。
- Harness 在独立进程中运行，只监听随机的 `127.0.0.1` 端口。
- Electron Renderer 启用沙箱和上下文隔离，并禁用 Node 集成。
- Dev、Beta、Stable 更新频道按操作系统和 CPU 架构隔离。
- Windows 通过 NSIS blockmap 进行差分下载，失败时回退到完整安装包。
- 自动检查上游，并在三个受支持目标上进行打包后启动测试。

语言设置只作用于 DSH-Desktop 桌面外壳。内置 DeepSeek Harness 界面仍由上游项目控制，本仓库不会修改或翻译其内部界面。

## 下载

开发版本位于 [Releases 页面](https://github.com/panpt/DSH-Desktop/releases)。当前预览包尚未签名，Windows SmartScreen 或 macOS Gatekeeper 可能显示安全提醒。

## 架构

```text
Electron 沙箱渲染进程
        │ 127.0.0.1 随机端口
        ▼
DSH Web 模式（独立的内置 Node.js 进程）
        │
        ├─ Harness 插件 / 会话 / 工具
        └─ Windows ACL 或 macOS Seatbelt 沙箱
```

程序文件和用户数据相互分离。更新桌面程序不会删除 Harness 配置、会话或工作区记录。

## 本地开发

需要 Node.js 24 和 pnpm 11：

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm smoke:engine
pnpm start
```

构建当前平台安装包：

```powershell
pnpm dist
pnpm smoke:packaged
```

产物位于 `release/`。

## 多语言

桌面端翻译文件位于：

- `locales/en-US.json`
- `locales/zh-CN.json`

测试会确保两份语言目录使用完全相同的键。无法识别的系统语言默认回退到英文。手动语言偏好保存在应用数据目录下的 `desktop-settings.json`。

## 更新

更新频道按发布阶段、平台和架构隔离，例如：

- `beta-win-x64`
- `beta-mac-x64`
- `beta-mac-arm64`

本地构建没有更新源；GitHub Actions 发布包会生成对应的更新元数据。公开分发前仍需配置 Windows 代码签名，以及 Apple Developer ID 签名和公证。

## 数据位置

- Windows：`%APPDATA%\DSH-Desktop`
- macOS：`~/Library/Application Support/DSH-Desktop`

Harness 数据位于 `harness/`，日志位于 `logs/`。

## 跟随上游

每日工作流会检查最新的 `@deepseek-ai/dsh` npm 版本。新的上游版本会以精确版本安装，并且必须在 Windows x64、macOS Intel 和 macOS Apple Silicon 上通过测试、引擎启动、打包和成品启动测试，之后才接受产物。

Nightly 可以自动跟随上游；稳定版仍应采用经过审查的依赖升级和人工批准流程。

## 许可证与商标

DSH-Desktop 使用 MIT License。DeepSeek Harness 以及安装包内的第三方组件保留各自许可证，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

本仓库是独立桌面封装，不代表 DeepSeek 官方产品。
