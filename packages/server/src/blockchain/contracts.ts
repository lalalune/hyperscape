/**
 * Hyperscape blockchain contract integrations
 * Handles Gold, Items, PlayerTradeEscrow, and Bazaar contracts
 */

import { ethers } from 'ethers';

const GOLD_ABI = [
  'function claimGold(uint256 amount, uint256 nonce, bytes memory signature) external',
  'function burn(uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function getNonce(address player) external view returns (uint256)',
  'function verifyClaim(address player, uint256 amount, uint256 nonce, bytes memory signature) public view returns (bool)'
];

const ITEMS_ABI = [
  'function mintItem(uint256 itemId, uint256 amount, bytes32 instanceId, bytes memory signature) external',
  'function burn(address account, uint256 itemId, uint256 amount) public',
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function getItemMetadata(uint256 itemId) external view returns (tuple(uint256 itemId, string name, bool stackable, int16 attack, int16 defense, int16 strength, uint8 rarity))',
  'function getMintedMetadata(address owner, uint256 itemId) external view returns (tuple(address originalMinter, uint256 mintedAt, bytes32 instanceId))'
];

const BAZAAR_ABI = [
  'function createListing(uint8 assetType, address assetContract, uint256 tokenId, uint256 amount, uint8 currency, address customCurrencyAddress, uint256 price, uint256 duration) external returns (uint256)',
  'function buyListing(uint256 listingId) external payable',
  'function cancelListing(uint256 listingId) external',
  'function getListing(uint256 listingId) external view returns (tuple(uint256 listingId, address seller, uint8 assetType, address assetContract, uint256 tokenId, uint256 amount, uint8 currency, address customCurrencyAddress, uint256 price, uint8 listingType, uint8 status, uint256 createdAt, uint256 expiresAt))'
];

const TRADE_ESCROW_ABI = [
  'function createTrade(address playerB) external returns (uint256 tradeId)',
  'function depositItems(uint256 tradeId, tuple(address tokenContract, uint256 tokenId, uint256 amount, uint8 tokenType)[] memory items) external',
  'function confirmTrade(uint256 tradeId) external',
  'function cancelTrade(uint256 tradeId) external',
  'function getTrade(uint256 tradeId) external view returns (tuple(uint256 tradeId, address playerA, address playerB, bool playerADeposited, bool playerBDeposited, bool playerAConfirmed, bool playerBConfirmed, bool executed, bool cancelled, uint256 createdAt, uint256 expiresAt))'
];

export class HyperscapeContracts {
  private provider: ethers.Provider;
  private goldContract: ethers.Contract | null = null;
  private itemsContract: ethers.Contract | null = null;
  private bazaarContract: ethers.Contract | null = null;
  private escrowContract: ethers.Contract | null = null;

  constructor(rpcUrl: string = process.env.RPC_URL || 'http://localhost:8545') {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const goldAddr = process.env.GOLD_CONTRACT_ADDRESS;
    const itemsAddr = process.env.ITEMS_CONTRACT_ADDRESS;
    const bazaarAddr = process.env.BAZAAR_CONTRACT_ADDRESS;
    const escrowAddr = process.env.TRADE_ESCROW_CONTRACT_ADDRESS;

    if (goldAddr) {
      this.goldContract = new ethers.Contract(goldAddr, GOLD_ABI, this.provider);
    }

    if (itemsAddr) {
      this.itemsContract = new ethers.Contract(itemsAddr, ITEMS_ABI, this.provider);
    }

    if (bazaarAddr) {
      this.bazaarContract = new ethers.Contract(bazaarAddr, BAZAAR_ABI, this.provider);
    }

    if (escrowAddr) {
      this.escrowContract = new ethers.Contract(escrowAddr, TRADE_ESCROW_ABI, this.provider);
    }
  }

  /**
   * Claim Gold tokens from in-game earnings
   */
  async claimGold(
    signer: ethers.Signer,
    amount: bigint,
    nonce: bigint,
    signature: string
  ): Promise<string> {
    if (!this.goldContract) throw new Error('Gold contract not configured');

    const gold = this.goldContract.connect(signer);
    const tx = await gold.claimGold(amount, nonce, signature);
    await tx.wait();

    return tx.hash;
  }

  /**
   * Mint item to NFT
   */
  async mintItem(
    signer: ethers.Signer,
    itemId: number,
    amount: number,
    instanceId: string,
    signature: string
  ): Promise<string> {
    if (!this.itemsContract) throw new Error('Items contract not configured');

    const items = this.itemsContract.connect(signer);
    const tx = await items.mintItem(itemId, amount, instanceId, signature);
    await tx.wait();

    return tx.hash;
  }

  /**
   * Create marketplace listing
   */
  async createMarketplaceListing(
    signer: ethers.Signer,
    assetType: number,
    assetContract: string,
    tokenId: number,
    amount: number,
    currency: number,
    price: bigint,
    duration: number
  ): Promise<string> {
    if (!this.bazaarContract) throw new Error('Bazaar contract not configured');

    const bazaar = this.bazaarContract.connect(signer);
    const tx = await bazaar.createListing(
      assetType,
      assetContract,
      tokenId,
      amount,
      currency,
      ethers.ZeroAddress,
      price,
      duration
    );
    await tx.wait();

    return tx.hash;
  }

  /**
   * Buy marketplace listing
   */
  async buyListing(
    signer: ethers.Signer,
    listingId: number,
    paymentAmount?: bigint
  ): Promise<string> {
    if (!this.bazaarContract) throw new Error('Bazaar contract not configured');

    const bazaar = this.bazaarContract.connect(signer);
    const tx = await bazaar.buyListing(listingId, { value: paymentAmount || 0 });
    await tx.wait();

    return tx.hash;
  }

  /**
   * Create P2P trade
   */
  async createTrade(
    signer: ethers.Signer,
    playerB: string
  ): Promise<number> {
    if (!this.escrowContract) throw new Error('Trade escrow not configured');

    const escrow = this.escrowContract.connect(signer);
    const tx = await escrow.createTrade(playerB);
    const receipt = await tx.wait();

    // Extract tradeId from event
    const event = receipt.logs.find((log: any) => log.topics[0] === ethers.id('TradeCreated(uint256,address,address)'));
    if (!event) throw new Error('TradeCreated event not found');

    return parseInt(event.topics[1], 16);
  }

  /**
   * Get Gold balance
   */
  async getGoldBalance(address: string): Promise<string> {
    if (!this.goldContract) return '0';

    const balance = await this.goldContract.balanceOf(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get item balance
   */
  async getItemBalance(address: string, itemId: number): Promise<string> {
    if (!this.itemsContract) return '0';

    const balance = await this.itemsContract.balanceOf(address, itemId);
    return balance.toString();
  }

  /**
   * Get active marketplace listings
   */
  async getActiveListings(limit: number = 20): Promise<any[]> {
    if (!this.bazaarContract) return [];

    const listings = [];
    for (let i = 1; i <= limit; i++) {
      try {
        const listing = await this.bazaarContract.getListing(i);
        if (listing.status === 0) { // ACTIVE
          listings.push(listing);
        }
      } catch {
        break;
      }
    }

    return listings;
  }
}

export const hyperscapeContracts = new HyperscapeContracts();

