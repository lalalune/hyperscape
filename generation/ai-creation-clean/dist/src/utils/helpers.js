"use strict";
/**
 * Utility helpers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.sleep = sleep;
exports.retry = retry;
exports.formatBytes = formatBytes;
exports.createProgressBar = createProgressBar;
exports.parseAssetType = parseAssetType;
exports.parseBuildingType = parseBuildingType;
exports.parseWeaponType = parseWeaponType;
/**
 * Generate a unique ID
 */
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
async function retry(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * Create a progress bar string
 */
function createProgressBar(current, total, width = 30) {
    const percentage = current / total;
    const filled = Math.round(width * percentage);
    const empty = width - filled;
    return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${Math.round(percentage * 100)}%`;
}
/**
 * Parse asset type from description
 */
function parseAssetType(description) {
    const weaponKeywords = ['sword', 'axe', 'bow', 'staff', 'dagger', 'mace', 'spear', 'shield', 'scimitar', 'crossbow', 'wand'];
    const armorKeywords = ['helmet', 'armor', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet', 'cape', 'plate', 'mail'];
    const consumableKeywords = ['potion', 'food', 'scroll', 'elixir', 'bread', 'meat', 'fish', 'rune'];
    const toolKeywords = ['pickaxe', 'hatchet', 'fishing', 'hammer', 'knife', 'chisel', 'tinderbox'];
    const buildingKeywords = ['bank', 'store', 'shop', 'house', 'temple', 'castle', 'tower', 'guild', 'inn'];
    const resourceKeywords = ['ore', 'bar', 'log', 'plank', 'gem', 'stone', 'coal'];
    const characterKeywords = ['goblin', 'guard', 'merchant', 'warrior', 'mage', 'dragon', 'skeleton', 'zombie'];
    const lowerDesc = description.toLowerCase();
    if (weaponKeywords.some(kw => lowerDesc.includes(kw)))
        return 'weapon';
    if (armorKeywords.some(kw => lowerDesc.includes(kw)))
        return 'armor';
    if (consumableKeywords.some(kw => lowerDesc.includes(kw)))
        return 'consumable';
    if (toolKeywords.some(kw => lowerDesc.includes(kw)))
        return 'tool';
    if (buildingKeywords.some(kw => lowerDesc.includes(kw)))
        return 'building';
    if (resourceKeywords.some(kw => lowerDesc.includes(kw)))
        return 'resource';
    if (characterKeywords.some(kw => lowerDesc.includes(kw)))
        return 'character';
    return 'decoration';
}
/**
 * Parse building type from description
 */
function parseBuildingType(description) {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('bank'))
        return 'bank';
    if (lowerDesc.includes('store') || lowerDesc.includes('shop'))
        return 'store';
    if (lowerDesc.includes('house') || lowerDesc.includes('home'))
        return 'house';
    if (lowerDesc.includes('temple') || lowerDesc.includes('church'))
        return 'temple';
    if (lowerDesc.includes('castle'))
        return 'castle';
    if (lowerDesc.includes('guild'))
        return 'guild';
    if (lowerDesc.includes('inn') || lowerDesc.includes('tavern'))
        return 'inn';
    if (lowerDesc.includes('tower'))
        return 'tower';
    return 'house'; // default
}
/**
 * Parse weapon type from description
 */
function parseWeaponType(description) {
    const lowerDesc = description.toLowerCase();
    const weaponTypes = ['sword', 'axe', 'bow', 'staff', 'shield', 'dagger', 'mace', 'spear', 'crossbow', 'wand', 'scimitar', 'battleaxe', 'longsword'];
    for (const weapon of weaponTypes) {
        if (lowerDesc.includes(weapon))
            return weapon;
    }
    return undefined;
}
//# sourceMappingURL=helpers.js.map