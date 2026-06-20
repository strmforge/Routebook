# Release Checklist / 发布检查

Use this checklist before publishing a new Routebook release.

每次发布路书前，都按这份清单过一遍。

## Source / 源码

- [ ] `README.md` is up to date.
- [ ] `package.json` version is updated.
- [ ] `package-lock.json` is synced.
- [ ] `docs/wiki/` has current Wiki drafts.
- [ ] README screenshots are refreshed with `npm run screenshots`.
- [ ] No `models.json`, `config.json`, or `windows/` data is committed.
- [ ] No local machine paths, LAN IPs, API keys, or private notes are present.

## Checks / 检查

```bash
npm run smoke
npm audit --audit-level=high
node --check server.js
node --check desktop/main.js
node --check desktop/preload.js
node --check scripts/capture-screenshots.js
```

## Build / 打包

```bash
rm -rf release
npm run dist -- --mac --arm64 --win --x64 --linux --x64 --publish never
```

Clean release-only helper files before uploading:

```bash
rm -rf release/mac release/mac-arm64 release/linux-unpacked release/linux-arm64-unpacked release/win-unpacked release/win-arm64-unpacked
rm -f release/*.blockmap release/builder-debug.yml
```

Generate SHA256 checksums:

```bash
shasum -a 256 release/* > release/SHA256SUMS.txt
```

## Release Assets / 发布文件

Recommended assets:

- Windows installer: `路书 Setup <version>.exe`
- Windows portable zip: `路书-<version>-win.zip`
- macOS Intel DMG: `路书-<version>.dmg`
- macOS Apple Silicon DMG: `路书-<version>-arm64.dmg`
- Linux x64 AppImage: `路书-<version>.AppImage`
- Linux arm64 AppImage: `路书-<version>-arm64.AppImage`
- `SHA256SUMS.txt`

## Manual Check / 手动检查

- [ ] Open desktop app locally.
- [ ] Open Model settings.
- [ ] Confirm presets are visible.
- [ ] Open Settings.
- [ ] Export backup.
- [ ] Create two windows and confirm histories do not mix.
- [ ] Confirm the app icon appears in the window and installer metadata.

## GitHub Decoration / 仓库装修

- [ ] Add repository description: `Question-first planning app for turning rough ideas into plans and AI task briefs.`
- [ ] Add topics: `planning`, `desktop-app`, `electron`, `openai-compatible`, `ai-tools`, `local-first`.
- [ ] Upload release assets to GitHub Releases instead of committing binaries.
- [ ] Copy `docs/wiki/*.md` to GitHub Wiki.
- [ ] Pin the first public release in the repository sidebar.
