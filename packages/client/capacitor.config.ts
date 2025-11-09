import type { CapacitorConfig } from "@capacitor/cli";

// For development: Set your local machine's IP address
// Find it with: `ipconfig getifaddr en0` (Mac WiFi) or `hostname -I` (Linux)
// For iOS simulator: use 'localhost'
// For Android emulator: use '10.0.2.2'
// For physical devices: use your machine's local IP (e.g., '192.168.1.100')
const DEV_SERVER_URL = process.env.CAP_SERVER_URL || undefined;

const config: CapacitorConfig = {
  appId: "com.hyperscape.app",
  appName: "Hyperscape",
  webDir: "build/public",
  server: DEV_SERVER_URL
    ? {
        // Development mode - connect to your dev server
        url: DEV_SERVER_URL,
        cleartext: true, // Allow HTTP for local development
      }
    : {
        // Production mode - serve from bundled assets
        androidScheme: "https",
        iosScheme: "https",
        cleartext: false,
      },
  ios: {
    contentInset: "always",
    // Prevent keyboard from pushing content up
    scrollEnabled: false,
    // Handle safe area for notches
    limitsNavigationsToAppBoundDomains: false,
    // Allow Privy OAuth redirects
    scheme: "hyperscape",
  },
  android: {
    // Use AndroidX libraries
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: "APK",
    },
    // Enable clear text traffic for local dev
    allowMixedContent: true,
    // WebView settings for better 3D performance
    backgroundColor: "#000000",
  },
  plugins: {
    // Configure keyboard plugin
    Keyboard: {
      resize: "body",
      style: "dark",
      resizeOnFullScreen: true,
    },
    // Configure status bar
    StatusBar: {
      style: "dark",
      backgroundColor: "#000000",
    },
    // Configure splash screen
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      showSpinner: true,
      spinnerColor: "#ffffff",
    },
  },
};

export default config;
