"use strict";
// Core RPG Type Definitions
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
exports.HotspotType = exports.RoomType = exports.MinigameStatus = exports.MinigameType = exports.ClanRank = exports.OfferStatus = exports.OfferType = exports.GravestoneTier = exports.SpawnerType = exports.NPCState = exports.NPCBehavior = exports.ZoneType = exports.NPCType = exports.WeaponType = exports.EquipmentSlot = exports.SpellType = exports.AttackType = exports.CombatStyle = void 0;
// Core type re-exports
__exportStar(require("../types"), exports);
// Combat types
var CombatStyle;
(function (CombatStyle) {
    CombatStyle["ACCURATE"] = "accurate";
    CombatStyle["AGGRESSIVE"] = "aggressive";
    CombatStyle["DEFENSIVE"] = "defensive";
    CombatStyle["CONTROLLED"] = "controlled";
    CombatStyle["RAPID"] = "rapid";
    CombatStyle["LONGRANGE"] = "longrange";
})(CombatStyle || (exports.CombatStyle = CombatStyle = {}));
var AttackType;
(function (AttackType) {
    AttackType["MELEE"] = "melee";
    AttackType["RANGED"] = "ranged";
    AttackType["MAGIC"] = "magic";
})(AttackType || (exports.AttackType = AttackType = {}));
var SpellType;
(function (SpellType) {
    SpellType["WIND_STRIKE"] = "wind_strike";
    SpellType["WATER_STRIKE"] = "water_strike";
    SpellType["EARTH_STRIKE"] = "earth_strike";
    SpellType["FIRE_STRIKE"] = "fire_strike";
    SpellType["WIND_BOLT"] = "wind_bolt";
    SpellType["WATER_BOLT"] = "water_bolt";
    SpellType["EARTH_BOLT"] = "earth_bolt";
    SpellType["FIRE_BOLT"] = "fire_bolt";
    SpellType["WIND_BLAST"] = "wind_blast";
    SpellType["WATER_BLAST"] = "water_blast";
    SpellType["EARTH_BLAST"] = "earth_blast";
    SpellType["FIRE_BLAST"] = "fire_blast";
    SpellType["WIND_WAVE"] = "wind_wave";
    SpellType["WATER_WAVE"] = "water_wave";
    SpellType["EARTH_WAVE"] = "earth_wave";
    SpellType["FIRE_WAVE"] = "fire_wave";
    SpellType["WIND_SURGE"] = "wind_surge";
    SpellType["WATER_SURGE"] = "water_surge";
    SpellType["EARTH_SURGE"] = "earth_surge";
    SpellType["FIRE_SURGE"] = "fire_surge";
    SpellType["CONFUSE"] = "confuse";
    SpellType["WEAKEN"] = "weaken";
    SpellType["CURSE"] = "curse";
    SpellType["BIND"] = "bind";
    SpellType["SNARE"] = "snare";
    SpellType["ENTANGLE"] = "entangle";
    SpellType["STUN"] = "stun";
    SpellType["CHARGE"] = "charge";
    SpellType["BONES_TO_BANANAS"] = "bones_to_bananas";
    SpellType["TELEKINETIC_GRAB"] = "telekinetic_grab";
    SpellType["SUPERHEAT_ITEM"] = "superheat_item";
    SpellType["ENCHANT_CROSSBOW_BOLT"] = "enchant_crossbow_bolt";
    SpellType["CHARGE_WATER_ORB"] = "charge_water_orb";
    SpellType["CHARGE_EARTH_ORB"] = "charge_earth_orb";
    SpellType["CHARGE_FIRE_ORB"] = "charge_fire_orb";
    SpellType["CHARGE_AIR_ORB"] = "charge_air_orb";
})(SpellType || (exports.SpellType = SpellType = {}));
// Item and Equipment types
var EquipmentSlot;
(function (EquipmentSlot) {
    EquipmentSlot["HEAD"] = "head";
    EquipmentSlot["CAPE"] = "cape";
    EquipmentSlot["AMULET"] = "amulet";
    EquipmentSlot["WEAPON"] = "weapon";
    EquipmentSlot["BODY"] = "body";
    EquipmentSlot["SHIELD"] = "shield";
    EquipmentSlot["LEGS"] = "legs";
    EquipmentSlot["GLOVES"] = "gloves";
    EquipmentSlot["BOOTS"] = "boots";
    EquipmentSlot["RING"] = "ring";
    EquipmentSlot["AMMO"] = "ammo";
})(EquipmentSlot || (exports.EquipmentSlot = EquipmentSlot = {}));
var WeaponType;
(function (WeaponType) {
    WeaponType["DAGGER"] = "dagger";
    WeaponType["SWORD"] = "sword";
    WeaponType["SCIMITAR"] = "scimitar";
    WeaponType["MACE"] = "mace";
    WeaponType["AXE"] = "axe";
    WeaponType["SPEAR"] = "spear";
    WeaponType["HALBERD"] = "halberd";
    WeaponType["BOW"] = "bow";
    WeaponType["CROSSBOW"] = "crossbow";
    WeaponType["STAFF"] = "staff";
    WeaponType["WAND"] = "wand";
})(WeaponType || (exports.WeaponType = WeaponType = {}));
// NPC types
var NPCType;
(function (NPCType) {
    NPCType["MONSTER"] = "monster";
    NPCType["QUEST_GIVER"] = "quest_giver";
    NPCType["SHOP"] = "shop";
    NPCType["BANKER"] = "banker";
    NPCType["SKILL_MASTER"] = "skill_master";
    NPCType["SHOPKEEPER"] = "shopkeeper";
    NPCType["GUARD"] = "guard";
    NPCType["BOSS"] = "boss";
    NPCType["ANIMAL"] = "animal";
    NPCType["CITIZEN"] = "citizen";
})(NPCType || (exports.NPCType = NPCType = {}));
var ZoneType;
(function (ZoneType) {
    ZoneType["LUMBRIDGE"] = "lumbridge";
    ZoneType["VARROCK"] = "varrock";
    ZoneType["FALADOR"] = "falador";
    ZoneType["DRAYNOR"] = "draynor";
    ZoneType["EDGEVILLE"] = "edgeville";
    ZoneType["WILDERNESS"] = "wilderness";
    ZoneType["TUTORIAL_ISLAND"] = "tutorial_island";
    ZoneType["BARBARIAN_VILLAGE"] = "barbarian_village";
    ZoneType["FISHING_GUILD"] = "fishing_guild";
    ZoneType["KARAMJA"] = "karamja";
    ZoneType["CAMELOT"] = "camelot";
})(ZoneType || (exports.ZoneType = ZoneType = {}));
var NPCBehavior;
(function (NPCBehavior) {
    NPCBehavior["AGGRESSIVE"] = "aggressive";
    NPCBehavior["PASSIVE"] = "passive";
    NPCBehavior["FRIENDLY"] = "friendly";
    NPCBehavior["SHOP"] = "shop";
    NPCBehavior["QUEST"] = "quest";
    NPCBehavior["BANKER"] = "banker";
    NPCBehavior["DEFENSIVE"] = "defensive";
    NPCBehavior["WANDER"] = "wander";
    NPCBehavior["PATROL"] = "patrol";
    NPCBehavior["FOLLOW"] = "follow";
})(NPCBehavior || (exports.NPCBehavior = NPCBehavior = {}));
var NPCState;
(function (NPCState) {
    NPCState["IDLE"] = "idle";
    NPCState["COMBAT"] = "combat";
    NPCState["FLEEING"] = "fleeing";
    NPCState["DEAD"] = "dead";
    NPCState["WANDERING"] = "wandering";
    NPCState["PATROLLING"] = "patrolling";
    NPCState["RETURNING"] = "returning";
})(NPCState || (exports.NPCState = NPCState = {}));
// Spawning System Types
var SpawnerType;
(function (SpawnerType) {
    SpawnerType["NPC"] = "npc";
    SpawnerType["RESOURCE"] = "resource";
    SpawnerType["CHEST"] = "chest";
    SpawnerType["BOSS"] = "boss";
    SpawnerType["EVENT"] = "event";
})(SpawnerType || (exports.SpawnerType = SpawnerType = {}));
var GravestoneTier;
(function (GravestoneTier) {
    GravestoneTier["BASIC"] = "basic";
    GravestoneTier["WOODEN"] = "wooden";
    GravestoneTier["STONE"] = "stone";
    GravestoneTier["ORNATE"] = "ornate";
    GravestoneTier["ANGEL"] = "angel";
    GravestoneTier["MYSTIC"] = "mystic";
    GravestoneTier["ROYAL"] = "royal";
})(GravestoneTier || (exports.GravestoneTier = GravestoneTier = {}));
// Grand Exchange types
var OfferType;
(function (OfferType) {
    OfferType["BUY"] = "buy";
    OfferType["SELL"] = "sell";
})(OfferType || (exports.OfferType = OfferType = {}));
var OfferStatus;
(function (OfferStatus) {
    OfferStatus["PENDING"] = "pending";
    OfferStatus["PARTIAL"] = "partial";
    OfferStatus["COMPLETE"] = "complete";
    OfferStatus["CANCELLED"] = "cancelled";
    OfferStatus["ACTIVE"] = "active";
    OfferStatus["EXPIRED"] = "expired";
    OfferStatus["COLLECTED"] = "collected";
})(OfferStatus || (exports.OfferStatus = OfferStatus = {}));
// Clan System types
var ClanRank;
(function (ClanRank) {
    ClanRank["RECRUIT"] = "recruit";
    ClanRank["CORPORAL"] = "corporal";
    ClanRank["SERGEANT"] = "sergeant";
    ClanRank["LIEUTENANT"] = "lieutenant";
    ClanRank["CAPTAIN"] = "captain";
    ClanRank["GENERAL"] = "general";
    ClanRank["ADMIN"] = "admin";
    ClanRank["DEPUTY_OWNER"] = "deputy_owner";
    ClanRank["OWNER"] = "owner";
})(ClanRank || (exports.ClanRank = ClanRank = {}));
// Minigame types
var MinigameType;
(function (MinigameType) {
    MinigameType["CASTLE_WARS"] = "castle_wars";
    MinigameType["PEST_CONTROL"] = "pest_control";
    MinigameType["FIGHT_CAVES"] = "fight_caves";
    MinigameType["BARROWS"] = "barrows";
})(MinigameType || (exports.MinigameType = MinigameType = {}));
var MinigameStatus;
(function (MinigameStatus) {
    MinigameStatus["WAITING"] = "waiting";
    MinigameStatus["STARTING"] = "starting";
    MinigameStatus["IN_PROGRESS"] = "in_progress";
    MinigameStatus["ENDING"] = "ending";
    MinigameStatus["COMPLETED"] = "completed";
})(MinigameStatus || (exports.MinigameStatus = MinigameStatus = {}));
var RoomType;
(function (RoomType) {
    RoomType["GARDEN"] = "garden";
    RoomType["PARLOUR"] = "parlour";
    RoomType["KITCHEN"] = "kitchen";
    RoomType["DINING_ROOM"] = "dining_room";
    RoomType["WORKSHOP"] = "workshop";
    RoomType["BEDROOM"] = "bedroom";
    RoomType["HALL"] = "hall";
    RoomType["GAMES_ROOM"] = "games_room";
    RoomType["COMBAT_ROOM"] = "combat_room";
    RoomType["QUEST_HALL"] = "quest_hall";
    RoomType["STUDY"] = "study";
    RoomType["COSTUME_ROOM"] = "costume_room";
    RoomType["CHAPEL"] = "chapel";
    RoomType["PORTAL_CHAMBER"] = "portal_chamber";
    RoomType["FORMAL_GARDEN"] = "formal_garden";
    RoomType["THRONE_ROOM"] = "throne_room";
    RoomType["OUBLIETTE"] = "oubliette";
    RoomType["DUNGEON"] = "dungeon";
    RoomType["TREASURE_ROOM"] = "treasure_room";
})(RoomType || (exports.RoomType = RoomType = {}));
var HotspotType;
(function (HotspotType) {
    HotspotType["DECORATION"] = "decoration";
    HotspotType["SEATING"] = "seating";
    HotspotType["TABLE"] = "table";
    HotspotType["STORAGE"] = "storage";
    HotspotType["LIGHTING"] = "lighting";
    HotspotType["RUG"] = "rug";
    HotspotType["ALTAR"] = "altar";
    HotspotType["PORTAL"] = "portal";
    HotspotType["GUARD"] = "guard";
    HotspotType["TROPHY"] = "trophy";
    HotspotType["SKILL"] = "skill";
    HotspotType["GAMES"] = "games";
    HotspotType["GLORY"] = "glory";
})(HotspotType || (exports.HotspotType = HotspotType = {}));
// Export visual types
__exportStar(require("./visual.types"), exports);
//# sourceMappingURL=index.js.map