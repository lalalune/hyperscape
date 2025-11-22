import { relations } from "drizzle-orm/relations";
import {
  characters,
  chunkActivity,
  equipment,
  inventory,
  playerSessions,
  users,
  agentMappings,
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
  agentMappings: many(agentMappings),
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

export const agentMappingsRelations = relations(agentMappings, ({ one }) => ({
  user: one(users, {
    fields: [agentMappings.accountId],
    references: [users.id],
  }),
  character: one(characters, {
    fields: [agentMappings.characterId],
    references: [characters.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  agentMappings: many(agentMappings),
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
