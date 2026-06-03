# Hyperia Native App

Cross-platform native application for Hyperia built with Tauri v2.

## Supported Platforms

| Platform | Status | Minimum Version |
|----------|--------|-----------------|
| Windows | ✅ | Windows 10/11 |
| macOS | ✅ | macOS 15 (Sequoia) |
| Linux | ✅ | Ubuntu 22.04+ |
| iOS | ✅ | iOS 18.2+ |
| Android | ⚠️ | Android 13+ (API 33) |

> **Note:** This app requires WebGPU support. Android WebView does not currently support WebGPU - the app will display an informative message on unsupported devices.

## Prerequisites

### All Platforms
- [Rust](https://rustup.rs/) (stable)
- [Bun](https://bun.sh/) 1.1.38+
- Node.js 22+

### macOS
- Xcode 15+ (for iOS development)
- Xcode Command Line Tools

### Windows
- [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 Runtime (usually pre-installed on Windows 10/11)

### Linux
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

### iOS Development
- macOS with Xcode 15+
- Apple Developer Account
- iOS device or simulator

### Android Development
- Android Studio
- Android SDK 33+
- Android NDK 27+
- Java 17

## Development

### Desktop Development

```bash
# From workspace root
bun run app:dev

# Or from packages/app
bun run dev
```

### Mobile Development

#### iOS
```bash
# Initialize iOS project (first time only)
bun run app:ios:init

# Run on iOS simulator/device
bun run app:ios:dev

# Build for distribution
bun run app:ios:build
```

#### Android
```bash
# Initialize Android project (first time only)
bun run app:android:init

# Run on Android emulator/device
bun run app:android:dev

# Build for distribution
bun run app:android:build
```

## Building for Production

### Desktop
```bash
# Build for current platform
bun run app:build

# Build with debug info
bun run app:build:debug
```

### Mobile
```bash
# iOS (requires code signing)
bun run app:ios:build

# Android
bun run app:android:build
```

## Project Structure

```
packages/app/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Desktop entry point
│   │   └── lib.rs           # Core app logic + mobile entry
│   ├── capabilities/        # Security permissions
│   ├── icons/               # App icons (all platforms)
│   ├── Cargo.toml           # Rust dependencies
│   ├── tauri.conf.json      # Main Tauri config
│   ├── tauri.ios.conf.json  # iOS-specific config
│   └── tauri.android.conf.json # Android-specific config
├── gen/                     # Generated native projects
│   ├── android/             # Android Studio project
│   └── apple/               # Xcode project
└── package.json
```

## Configuration

### Environment Variables

The app uses the same environment variables as the client:

- `PUBLIC_API_URL` - Game server API URL
- `PUBLIC_WS_URL` - WebSocket server URL
- `PUBLIC_CDN_URL` - CDN URL for assets
- `PUBLIC_PRIVY_APP_ID` - Privy authentication app ID

### Deep Links

The app handles OAuth callbacks via deep links:

- **Desktop:** `hyperia://` URL scheme
- **Mobile:** Universal links to `hyperia.club/auth/*`

Configure redirect URLs in your Privy dashboard.

### Auto-Updater (Desktop)

Desktop builds include auto-update functionality. Configure in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "pubkey": "YOUR_PUBLIC_KEY",
      "endpoints": ["https://releases.hyperia.club/..."]
    }
  }
}
```

Generate signing keys:
```bash
bun tauri signer generate -w ~/.tauri/hyperia.key
```

## Troubleshooting

### WebGPU Not Available

If you see the "WebGPU Required" screen:

- **Windows:** Ensure you have the latest Edge WebView2 runtime
- **macOS:** Requires macOS 15 (Sequoia) or later
- **iOS:** Requires iOS 18.2 or later
- **Android:** WebGPU is not available in Android WebView
- **Linux:** Check webkit2gtk version and GPU drivers

### Build Errors

1. Ensure Rust is up to date: `rustup update stable`
2. Clear build cache: `cd src-tauri && cargo clean`
3. Reinstall dependencies: `bun install`

### iOS Code Signing

Set up provisioning profiles in Xcode and configure:
- `APPLE_CERTIFICATE`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_PROVISIONING_PROFILE`

### Android Signing

Generate a keystore and set:
- `ANDROID_KEYSTORE`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## License

GPL-3.0-only
