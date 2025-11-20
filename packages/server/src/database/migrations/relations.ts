import { relations } from "drizzle-orm/relations";
import {
  characters,
  chunkActivity,
  equipment,
  inventory,
  playerSessions,
  npcKills,
  playerDeaths,
} from "./schema";

export const chunkActivityRelations = relations(chunkActivity, ({ one }) => ({
  character: one(characters, {
    fields: [chunkActivity.playerId],
    references: [characters.id],
  }),
}));

export const charactersRelations = relations(characters, ({ many }) => ({
  chunkActivities: many(chunkActivity),
  equipment: many(equipment),
  inventories: many(inventory),
  playerSessions: many(playerSessions),
  npcKills: many(npcKills),
  playerDeaths: many(playerDeaths),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  character: one(characters, {
    fields: [equipment.playerId],
    references: [characters.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  character: one(characters, {
    fields: [inventory.playerId],
    references: [characters.id],
  }),
}));

export const playerSessionsRelations = relations(playerSessions, ({ one }) => ({
  character: one(characters, {
    fields: [playerSessions.playerId],
    references: [characters.id],
  }),
}));

export const npcKillsRelations = relations(npcKills, ({ one }) => ({
  character: one(characters, {
    fields: [npcKills.playerId],
    references: [characters.id],
  }),
}));

export const playerDeathsRelations = relations(playerDeaths, ({ one }) => ({
  character: one(characters, {
    fields: [playerDeaths.playerId],
    references: [characters.id],
  }),
}));
