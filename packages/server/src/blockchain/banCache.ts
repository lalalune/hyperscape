/**
 * Ban Cache for Hyperscape
 * Event-driven ban list with zero-latency checks
 */

import { ethers, type EventLog } from "ethers";

const BAN_MANAGER_ADDRESS = process.env.BAN_MANAGER_ADDRESS || "";
const HYPERSCAPE_APP_ID = ethers.keccak256(ethers.toUtf8Bytes("hyperscape"));

const BAN_MANAGER_ABI = [
  "event NetworkBanApplied(uint256 indexed agentId, string reason, address indexed bannedBy)",
  "event NetworkBanRemoved(uint256 indexed agentId, address indexed removedBy)",
  "event AppBanApplied(uint256 indexed agentId, bytes32 indexed appId, string reason, address indexed bannedBy)",
  "event AppBanRemoved(uint256 indexed agentId, bytes32 indexed appId, address indexed removedBy)",
  "function isAccessAllowed(uint256 agentId, bytes32 appId) view returns (bool)",
];

export class BanCache {
  private contract: ethers.Contract | null = null;
  private banned = new Set<number>();
  private initialized = false;

  constructor(provider: ethers.Provider) {
    if (
      BAN_MANAGER_ADDRESS &&
      BAN_MANAGER_ADDRESS !== "0x0000000000000000000000000000000000000000"
    ) {
      this.contract = new ethers.Contract(
        BAN_MANAGER_ADDRESS,
        BAN_MANAGER_ABI,
        provider,
      );
    }
  }

  async initialize(): Promise<void> {
    if (!this.contract) {
      this.initialized = true;
      return;
    }

    const currentBlock = await this.contract.runner!.provider!.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 100000);

    // Query past bans
    const networkBans = await this.contract.queryFilter(
      "NetworkBanApplied",
      fromBlock,
    );
    const appBans = await this.contract.queryFilter("AppBanApplied", fromBlock);

    for (const event of networkBans) {
      const eventLog = event as EventLog;
      if (eventLog.args) {
        this.banned.add(Number(eventLog.args[0])); // agentId is first indexed arg
      }
    }

    for (const event of appBans) {
      const eventLog = event as EventLog;
      if (eventLog.args) {
        const appId = eventLog.args[1]; // appId is second indexed arg
        if (appId === HYPERSCAPE_APP_ID) {
          this.banned.add(Number(eventLog.args[0])); // agentId is first indexed arg
        }
      }
    }

    this.initialized = true;
  }

  startListening(): void {
    if (!this.contract) return;

    this.contract.on("NetworkBanApplied", (agentId: bigint) => {
      this.banned.add(Number(agentId));
      console.log(`[BAN-CACHE] Network ban applied: Agent #${agentId}`);
    });

    this.contract.on("AppBanApplied", (agentId: bigint, appId: string) => {
      if (appId === HYPERSCAPE_APP_ID) {
        this.banned.add(Number(agentId));
        console.log(`[BAN-CACHE] App ban applied: Agent #${agentId}`);
      }
    });

    this.contract.on("NetworkBanRemoved", (agentId: bigint) => {
      this.banned.delete(Number(agentId));
    });
  }

  isBanned(agentId: number): boolean {
    return this.banned.has(agentId);
  }
}
