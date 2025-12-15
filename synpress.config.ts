import { defineWalletSetup } from "@synthetixio/synpress";
import { defineConfig, devices } from "@playwright/test";

// Client port: VITE_PORT > default 3333
const CLIENT_PORT = parseInt(process.env.VITE_PORT || "3333");
const BASE_URL = process.env.HYPERSCAPE_URL || `http://localhost:${CLIENT_PORT}`;

export default defineConfig({
  testDir: "./tests/wallet",
  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/synpress-hyperscape.json" }],
  ],

  timeout: 180000, // 3 minutes for 3D world operations

  expect: {
    timeout: 15000,
  },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1920, height: 1080 },
    headless: false,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: 'echo "Hyperscape client should be running"',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120000,
  },
});

// Wallet setup for Synpress
const password = "Test1234!";

export const basicSetup = defineWalletSetup(
  password,
  async (context, walletPage) => {
    const { MetaMask } = await import("@synthetixio/synpress/playwright");
    const wallet = new MetaMask(context, walletPage, password);

    // Import Hardhat/Anvil test account #0
    await wallet.importWallet({
      privateKey:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      password,
    });

    // Add local network
    await wallet.addNetwork({
      name: "Localhost",
      rpcUrl: "http://localhost:8545",
      chainId: 1337,
      symbol: "ETH",
    });

    await wallet.switchNetwork("Localhost");
  },
);
