import { useMemo } from "react";
import { Buffer } from "buffer";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";

import { getRpcUrl, getWsUrl } from "./lib/config";
import { createHeadlessWalletsFromEnv } from "./lib/headlessWallet";
import { ChainProvider } from "./lib/ChainContext";
import { wagmiConfig } from "./lib/wagmiConfig";
import { App } from "./App";
import { StreamUIApp } from "./StreamUIApp";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@rainbow-me/rainbowkit/styles.css";

const IS_STREAM_UI = import.meta.env.MODE === "stream-ui";

if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

const queryClient = new QueryClient();

export default function AppRoot() {
  const endpoint = getRpcUrl();
  const wsEndpoint = getWsUrl();
  const headlessWallets = useMemo(() => createHeadlessWalletsFromEnv(), []);

  const wallets = useMemo(() => {
    const walletList = [];
    for (const wallet of headlessWallets) {
      walletList.push(wallet.adapter);
    }
    walletList.push(new PhantomWalletAdapter());
    return walletList;
  }, [headlessWallets]);

  const autoConnectWallet = headlessWallets.find((entry) => entry.autoConnect);
  if (autoConnectWallet) {
    localStorage.setItem(
      "walletName",
      JSON.stringify(autoConnectWallet.adapter.name),
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ accentColor: "#eab308", borderRadius: "large" })}
        >
          <ChainProvider>
            <ConnectionProvider
              endpoint={endpoint}
              config={{
                wsEndpoint,
                commitment: "confirmed",
                disableRetryOnRateLimit: true,
              }}
            >
              <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                  {IS_STREAM_UI ? <StreamUIApp /> : <App />}
                </WalletModalProvider>
              </WalletProvider>
            </ConnectionProvider>
          </ChainProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
