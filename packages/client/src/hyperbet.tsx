/**
 * HyperBet entry point — standalone betting page for Twitch/YouTube viewers.
 * Wraps in SolanaWalletProvider only (no Privy/game auth needed).
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { SolanaWalletProvider } from "./auth/SolanaWalletProvider";
import { HyperBetScreen } from "./screens/HyperBetScreen";

import "@solana/wallet-adapter-react-ui/styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <SolanaWalletProvider>
      <HyperBetScreen />
    </SolanaWalletProvider>
  </React.StrictMode>,
);
