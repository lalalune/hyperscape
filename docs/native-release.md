# Native Release and Distribution

This repository publishes signed native app artifacts via `.github/workflows/build-app.yml` and exposes downloads via GitHub Pages at:

- <https://playhyperia.github.io/hyperia/>

## Release trigger

Create and push a semantic version tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

That tag builds desktop + iOS + Android artifacts and publishes a GitHub Release.

## Required GitHub secrets (release mode)

### Desktop (macOS signing + notarization)

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD` (or `APPLE_APP_SPECIFIC_PASSWORD`)
- `APPLE_TEAM_ID`

### Desktop (Windows signing)

- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

### iOS signing

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_PROVISIONING_PROFILE`

### Android signing

- `ANDROID_KEYSTORE` (base64-encoded keystore)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### Updater signature

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## Download portal deployment

`downloads/index.html` is deployed by `.github/workflows/deploy-downloads.yml` on:

- `release.published`
- pushes to `main` that change `downloads/**`
- manual `workflow_dispatch`
