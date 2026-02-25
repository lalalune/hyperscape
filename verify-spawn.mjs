import { getDuelArenaConfig } from "./packages/shared/dist/data/duel-manifest.js";
const config = getDuelArenaConfig();
console.log("Duel Arena Config BaseModel offset:", config.baseY);
console.log("Lobby Spawn Point:", config.lobbySpawnPoint);

if (config.baseY === 0.42 && config.lobbySpawnPoint.y === 0.42) {
  console.log("SUCCESS: Heights match the client visual layer (0.42).");
} else {
  console.error("FAIL: Heights do not match 0.42. Was: " + config.baseY);
  process.exit(1);
}
