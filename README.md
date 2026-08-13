# DSH-Desktop

[English](README.md) | [简体中文](README.zh-CN.md)

[![Desktop CI](https://github.com/panpt/DSH-Desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/panpt/DSH-Desktop/actions/workflows/ci.yml)

DSH-Desktop is an independent Windows and macOS desktop host for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps the upstream Harness Web UI and plugin system while providing a bundled runtime, local process management, native menus, desktop updates, and cross-platform packaging.

> This is a development preview, not an official DeepSeek product. DSH-Desktop `0.2.0-beta.1` embeds the exact upstream package `@deepseek-ai/dsh 0.1.0-rc.6`.

## Features

- Windows x64, macOS Intel, and macOS Apple Silicon builds.
- English and Simplified Chinese for the desktop shell, including startup/error pages, menus, version information, and update dialogs.
- Automatic language selection based on the operating system, plus a saved manual choice from the Language menu or startup page.
- A verified Node.js 24 LTS runtime inside the package; users do not need Node.js, pnpm, or Git.
- Harness runs in a separate process on a random `127.0.0.1` port.
- Sandboxed Electron renderer with Node integration disabled and context isolation enabled.
- Isolated Dev, Beta, and Stable update channels per operating system and CPU architecture.
- Windows differential downloads through NSIS blockmaps, with full-package fallback.
- Automated upstream checks and packaged smoke tests on all three supported targets.

The language setting applies only to the DSH-Desktop shell. The embedded DeepSeek Harness interface remains controlled by the upstream project and is not modified or translated by this repository.

## Download

Development packages are available on the [Releases page](https://github.com/panpt/DSH-Desktop/releases). Current preview packages are unsigned; Windows SmartScreen or macOS Gatekeeper may show a warning.

## Architecture

```text
Electron sandboxed renderer
        │ 127.0.0.1 random port
        ▼
DSH web profile (separate bundled Node.js process)
        │
        ├─ Harness plugins / sessions / tools
        └─ Windows ACL or macOS Seatbelt sandbox
```

Application files and user data are separated. Updating the application does not delete Harness settings, sessions, or workspace records.

## Development

Requirements: Node.js 24 and pnpm 11.

```powershell
pnpm install --frozen-lockfile
pnpm verify
pnpm smoke:engine
pnpm start
```

Build the installer for the current platform:

```powershell
pnpm dist
pnpm smoke:packaged
```

Artifacts are written to `release/`.

## Localization

Desktop translations live in:

- `locales/en-US.json`
- `locales/zh-CN.json`

The test suite requires both catalogs to expose the same keys. Missing or unsupported system locales fall back to English. The saved preference is stored in `desktop-settings.json` under the application data directory.

## Updates

Channels are separated by release track, platform, and architecture, for example:

- `beta-win-x64`
- `beta-mac-x64`
- `beta-mac-arm64`

Local builds have no update source. GitHub Actions release builds generate the relevant update metadata. Public distribution requires Windows code signing and Apple Developer ID signing/notarization.

## Data locations

- Windows: `%APPDATA%\DSH-Desktop`
- macOS: `~/Library/Application Support/DSH-Desktop`

Harness data is stored under `harness/`; logs are stored under `logs/`.

## Upstream tracking

The daily workflow checks the latest `@deepseek-ai/dsh` npm release. A new upstream version is installed as an exact version and must pass tests, engine startup, packaging, and packaged application startup on Windows x64, macOS Intel, and macOS Apple Silicon before artifacts are accepted.

Nightly builds may follow upstream automatically. Stable releases should continue to use a reviewed dependency update and explicit approval.

## License and trademarks

DSH-Desktop is licensed under the MIT License. DeepSeek Harness and bundled third-party components retain their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This repository is independent and does not represent an official DeepSeek product.
