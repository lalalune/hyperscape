/**
 * IdentityRegistry Client for Hyperscape
 * Handles player and character registration to ERC-8004 registry
 */

import { ethers } from 'ethers';

const IDENTITY_REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS || '';
const HYPERSCAPE_APP_ID = ethers.keccak256(ethers.toUtf8Bytes('hyperscape'));

const REGISTRY_ABI = [
  'function register(address entity, string name, string[] tags, string tokenURI) payable returns (uint256)',
  'function agents(uint256) view returns (uint256, address, uint8, address, uint256, uint256, uint256, bool, bool)',
  'function setMetadata(uint256 agentId, string key, bytes value) external',
  'function getMetadata(uint256 agentId, string key) view returns (bytes)',
];

export class RegistryClient {
  private contract: ethers.Contract;
  private signer: ethers.Wallet;
  private provider: ethers.Provider;
  
  // Cache to avoid duplicate registrations
  private registeredAgents = new Map<string, number>();
  
  constructor(provider: ethers.Provider, privateKey: string) {
    this.provider = provider;
    this.signer = new ethers.Wallet(privateKey, provider);
    this.contract = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, REGISTRY_ABI, this.signer);
  }
  
  async registerPlayer(playerAddress: string): Promise<number> {
    const tx = await this.contract.register(
      playerAddress,
      `Hyperscape Player`,
      ['games', 'rpg', 'hyperscape', 'player'],
      ''  // TokenURI
    );
    
    const receipt = await tx.wait();
    const event = receipt.logs.find((log: ethers.Log) => log.topics[0] === ethers.id('Registered(uint256,address,uint256,uint256,string)'));
    if (!event) throw new Error('Registered event not found');
    const agentId = Number(ethers.toBigInt(event.topics[1]));
    
    return agentId;
  }
  
  /**
   * Register character as sub-agent linked to player
   * @param playerAddress Player's wallet address
   * @param characterName In-game character name
   * @param playerAgentId Parent player's agent ID
   * @param characterData Additional character metadata (class, level, etc.)
   * @returns Character agent ID
   */
  async registerCharacter(
    playerAddress: string,
    characterName: string,
    playerAgentId: number,
    characterData?: { class?: string; level?: number; race?: string }
  ): Promise<number> {
    console.log(`[RegistryClient] Registering character "${characterName}" for player agent #${playerAgentId}`);

    const tx = await this.contract.register(
      playerAddress,
      characterName,
      ['games', 'rpg', 'hyperscape', 'character'],
      '' // TokenURI - could point to character avatar
    );

    const receipt = await tx.wait();
    const event = receipt.logs.find((log: ethers.Log) => log.topics[0] === ethers.id('Registered(uint256,address,uint256,uint256,string)'));
    if (!event) throw new Error('Registered event not found');
    const characterAgentId = Number(ethers.toBigInt(event.topics[1]));

    // Link to parent player
    await this.linkCharacterToPlayer(characterAgentId, playerAgentId);

    // Store character-specific metadata
    if (characterData) {
      if (characterData.class) {
        await this.contract.setMetadata(
          characterAgentId,
          'character.class',
          ethers.AbiCoder.defaultAbiCoder().encode(['string'], [characterData.class])
        );
      }
      if (characterData.level !== undefined) {
        await this.contract.setMetadata(
          characterAgentId,
          'character.level',
          ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [characterData.level])
        );
      }
      if (characterData.race) {
        await this.contract.setMetadata(
          characterAgentId,
          'character.race',
          ethers.AbiCoder.defaultAbiCoder().encode(['string'], [characterData.race])
        );
      }
    }

    console.log(`[RegistryClient] Character registered as agent #${characterAgentId}`);
    return characterAgentId;
  }

  /**
   * Get all characters for a player
   * @param playerAgentId Player's agent ID
   * @returns Array of character agent IDs
   */
  async getPlayerCharacters(playerAgentId: number): Promise<number[]> {
    try {
      const metadata = await this.contract.getMetadata(playerAgentId, 'characters');
      if (metadata && metadata !== '0x') {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256[]'], metadata);
        return decoded[0].map((id: bigint) => Number(id));
      }
    } catch (error) {
      console.error('[RegistryClient] Error getting player characters:', error);
    }
    return [];
  }

  /**
   * Add character to player's character list
   */
  async addCharacterToPlayer(playerAgentId: number, characterAgentId: number): Promise<void> {
    const existingCharacters = await this.getPlayerCharacters(playerAgentId);
    const updatedCharacters = [...existingCharacters, characterAgentId];

    await this.contract.setMetadata(
      playerAgentId,
      'characters',
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256[]'], [updatedCharacters])
    );
  }
  
  async isPlayerBanned(agentId: number): Promise<boolean> {
    const agent = await this.contract.agents(agentId);
    return agent[7];  // isBanned field
  }
  
  async getPlayerTier(agentId: number): Promise<number> {
    const agent = await this.contract.agents(agentId);
    return agent[2];  // tier field
  }
  
  /**
   * Check if player is already registered and return agentId
   * Returns 0 if not registered
   */
  async getAgentIdByAddress(playerAddress: string): Promise<number> {
    // Check cache first
    if (this.registeredAgents.has(playerAddress.toLowerCase())) {
      return this.registeredAgents.get(playerAddress.toLowerCase())!;
    }
    
    try {
      // Query registry for existing agent
      // This is a simplified check - in production would query events or indexer
      const agentId = await this.contract.addressToAgentId?.(playerAddress);
      if (agentId && agentId > 0) {
        this.registeredAgents.set(playerAddress.toLowerCase(), Number(agentId));
        return Number(agentId);
      }
    } catch (error) {
      console.error('[RegistryClient] Error checking agent ID:', error);
    }
    
    return 0;
  }
  
  /**
   * Auto-register player on first login if not already registered
   * Returns existing or newly created agentId
   */
  async ensurePlayerRegistered(playerAddress: string, playerName?: string): Promise<number> {
    // Check if already registered
    const existingAgentId = await this.getAgentIdByAddress(playerAddress);
    if (existingAgentId > 0) {
      console.log(`[RegistryClient] Player ${playerAddress} already registered as Agent #${existingAgentId}`);
      return existingAgentId;
    }
    
    // Register new player
    console.log(`[RegistryClient] Auto-registering new player: ${playerAddress}`);
    const agentId = await this.registerPlayer(playerAddress);
    
    // Cache the result
    this.registeredAgents.set(playerAddress.toLowerCase(), agentId);
    
    return agentId;
  }
  
  /**
   * Link character to parent player in metadata
   */
  async linkCharacterToPlayer(characterAgentId: number, playerAgentId: number): Promise<void> {
    await this.contract.setMetadata(
      characterAgentId,
      'parentPlayer',
      ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [playerAgentId])
    );
  }
  
  /**
   * Get parent player ID for a character
   */
  async getParentPlayer(characterAgentId: number): Promise<number> {
    try {
      const metadata = await this.contract.getMetadata(characterAgentId, 'parentPlayer');
      if (metadata && metadata !== '0x') {
        const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], metadata);
        return Number(decoded[0]);
      }
    } catch (error) {
      console.error('[RegistryClient] Error getting parent player:', error);
    }
    return 0;
  }
}


