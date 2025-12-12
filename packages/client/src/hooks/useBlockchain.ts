/**
 * Blockchain hooks for Hyperscape client
 * Manages wallet connection and contract interactions
 */

import { useState, useCallback } from "react";
import { ethers } from "ethers";

export function useBlockchain() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask not installed");
    }

    try {
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const network = await browserProvider.getNetwork();
      const providerSigner = await browserProvider.getSigner();
      const signerAddress = await providerSigner.getAddress();

      setProvider(browserProvider);
      setSigner(providerSigner);
      setAddress(signerAddress);
      setChainId(Number(network.chainId));
      setIsConnected(true);

      // Listen for changes
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          setAddress(accounts[0]);
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    } catch (error) {
      console.error("Connection failed:", error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
  }, []);

  const claimGold = useCallback(
    async (amount: string, nonce: string, signature: string) => {
      if (!signer) throw new Error("Wallet not connected");

      const goldAddr = process.env.VITE_GOLD_CONTRACT_ADDRESS;
      if (!goldAddr) throw new Error("Gold contract not configured");

      const gold = new ethers.Contract(
        goldAddr,
        [
          "function claimGold(uint256 amount, uint256 nonce, bytes memory signature) external",
        ],
        signer,
      );

      const tx = await gold.claimGold(
        ethers.parseEther(amount),
        nonce,
        signature,
      );

      await tx.wait();
      return tx.hash;
    },
    [signer],
  );

  const mintItem = useCallback(
    async (
      itemId: number,
      amount: number,
      instanceId: string,
      signature: string,
    ) => {
      if (!signer) throw new Error("Wallet not connected");

      const itemsAddr = process.env.VITE_ITEMS_CONTRACT_ADDRESS;
      if (!itemsAddr) throw new Error("Items contract not configured");

      const items = new ethers.Contract(
        itemsAddr,
        [
          "function mintItem(uint256 itemId, uint256 amount, bytes32 instanceId, bytes memory signature) external",
        ],
        signer,
      );

      const tx = await items.mintItem(itemId, amount, instanceId, signature);
      await tx.wait();

      return tx.hash;
    },
    [signer],
  );

  return {
    provider,
    signer,
    address,
    chainId,
    isConnected,
    connect,
    disconnect,
    claimGold,
    mintItem,
  };
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}
