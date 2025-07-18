import { System } from '@hyperfy/sdk';
import type { World } from '../types';
interface ItemStack {
    itemId: number;
    quantity: number;
    metadata?: any;
}
interface ItemValue {
    stack: ItemStack;
    value: number;
}
interface PlayerEntity extends Entity {
    type: 'player';
    username: string;
    displayName: string;
    accountType: 'normal' | 'ironman' | 'hardcore' | 'ultimate';
    playTime: number;
    membershipStatus: boolean;
}
export interface BankTab {
    items: (ItemStack | null)[];
    name?: string;
}
export interface BankAccount {
    playerId: string;
    tabs: BankTab[];
    pin?: string;
    pinAttempts: number;
    lastPinAttempt?: number;
    totalSlots: number;
    usedSlots: number;
}
export declare class BankingSystem extends System {
    private static readonly DEFAULT_BANK_SIZE;
    private static readonly SLOTS_PER_TAB;
    private static readonly DEFAULT_TABS;
    private static readonly MAX_PIN_ATTEMPTS;
    private static readonly PIN_LOCKOUT_TIME;
    private bankAccounts;
    private bankBooths;
    private playerBankOpen;
    private itemRegistry;
    private pendingSaves;
    private saveTimer?;
    constructor(world: World);
    private setupEventListeners;
    /**
     * Start auto-save timer
     */
    private startAutoSave;
    /**
     * Handle player connect event
     */
    private handlePlayerConnect;
    /**
     * Handle player disconnect event
     */
    private handlePlayerDisconnect;
    /**
     * Load player bank from persistence
     */
    private loadPlayerBank;
    /**
     * Save player bank to persistence
     */
    private savePlayerBank;
    /**
     * Save all pending banks
     */
    private savePendingBanks;
    /**
     * Mark player for saving
     */
    private markForSave;
    private initializeBankBooths;
    registerBankBooth(boothId: string): void;
    private getOrCreateAccount;
    openBank(player: PlayerEntity, bankBoothId: string): boolean;
    closeBank(player: PlayerEntity): void;
    isBankOpen(playerId: string): boolean;
    depositItem(player: PlayerEntity, inventorySlot: number, quantity?: number): boolean;
    depositAll(player: PlayerEntity): void;
    withdrawItem(player: PlayerEntity, tabIndex: number, slotIndex: number, quantity?: number): boolean;
    withdrawAll(player: PlayerEntity, tabIndex: number, slotIndex: number): boolean;
    searchBank(player: PlayerEntity, searchTerm: string): ItemStack[];
    moveItem(player: PlayerEntity, fromTab: number, fromSlot: number, toTab: number, toSlot: number): boolean;
    setTabName(player: PlayerEntity, tabIndex: number, name: string): boolean;
    setPin(player: PlayerEntity, pin: string): boolean;
    verifyPin(player: PlayerEntity, pin: string): boolean;
    removePin(player: PlayerEntity, currentPin: string): boolean;
    private isPinVerified;
    private findItemInBank;
    private getBankData;
    getBankValue(player: PlayerEntity): number;
    getTotalItems(player: PlayerEntity): number;
    update(_deltaTime: number): void;
    serialize(): any;
    deserialize(data: any): void;
    /**
     * Calculate bank value (for death costs)
     */
    calculateBankValue(entityId: string): number;
    /**
     * Get most valuable items (for death mechanics)
     */
    getMostValuableItems(entityId: string, count: number): ItemValue[];
}
export {};
//# sourceMappingURL=BankingSystem.d.ts.map