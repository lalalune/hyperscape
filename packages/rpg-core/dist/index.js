"use strict";
/**
 * @hyperscape/rpg-core
 *
 * Core RPG game logic for Hyperfy
 * This plugin provides a complete RPG experience with combat, skills, banking, trading, and more.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRPGPlugin = createRPGPlugin;
const RPGPlugin_1 = require("./RPGPlugin");
// Re-export all public types
__exportStar(require("./types"), exports);
__exportStar(require("./api/RPGPublicAPI"), exports);
__exportStar(require("./api/events"), exports);
__exportStar(require("./api/queries"), exports);
/**
 * Creates and initializes the RPG plugin
 */
function createRPGPlugin(config) {
    return new RPGPlugin_1.RPGPlugin(config);
}
// Default export for convenience
exports.default = createRPGPlugin;
//# sourceMappingURL=index.js.map