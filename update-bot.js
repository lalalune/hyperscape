import fs from "fs";

let content = fs.readFileSync(
  "packages/gold-betting-demo/keeper/src/bot.ts",
  "utf8",
);

// Add imports
content = content.replace(
  `import { type GoldClobMarket } from "../../anchor/target/types/gold_clob_market";`,
  `import { type GoldClobMarket } from "../../anchor/target/types/gold_clob_market";\nimport { type GoldPerpsMarket } from "../../anchor/target/types/gold_perps_market";\nimport { updateRatings, calculateSpotIndex, createInitialRating, type AgentRating } from "./trueskill";\nimport path from "node:path";\nimport fs_node from "node:fs";`,
);

content = content.replace(
  `const marketProgram = goldClobMarket as Program<GoldClobMarket>;`,
  `const marketProgram = goldClobMarket as Program<GoldClobMarket>;\nconst perpsProgram = goldPerpsMarket as Program<GoldPerpsMarket>;`,
);

// Add agent rating persistence logic
const ratingLogic = `
const RATINGS_FILE = path.resolve(__dirname, 'agent_ratings.json');
let agentRatings: Record<string, AgentRating> = {};
if (fs_node.existsSync(RATINGS_FILE)) {
  try {
    agentRatings = JSON.parse(fs_node.readFileSync(RATINGS_FILE, 'utf8'));
  } catch (e) {
    console.error("Failed to load ratings", e);
  }
}

function saveRatings() {
  fs_node.writeFileSync(RATINGS_FILE, JSON.stringify(agentRatings, null, 2));
}

function getRating(agentId: string): AgentRating {
  if (!agentRatings[agentId]) {
    agentRatings[agentId] = createInitialRating();
  }
  return agentRatings[agentId];
}

async function updatePerpsOracle(agentId: string, rating: AgentRating) {
  try {
    const numericAgentId = parseInt(agentId) || 0;
    if (numericAgentId === 0) return;
    
    const spotIndex = calculateSpotIndex(rating);
    const spotIndexScaled = new BN(Math.floor(spotIndex * 1_000_000));
    const muScaled = new BN(Math.floor(rating.mu * 1_000_000));
    const sigmaScaled = new BN(Math.floor(rating.sigma * 1_000_000));

    const oraclePda = PublicKey.findProgramAddressSync(
      [Buffer.from("oracle"), new BN(numericAgentId).toArrayLike(Buffer, "le", 4)],
      perpsProgram.programId
    )[0];

    await runWithRecovery(
      () => perpsProgram.methods
        .updateOracle(numericAgentId, spotIndexScaled, muScaled, sigmaScaled)
        .accounts({
           oracle: oraclePda,
           authority: botKeypair.publicKey,
        })
        .rpc(),
      connection
    );
    console.log('[Keeper] Updated Perps Oracle for agent', agentId, 'to spot', spotIndex);
  } catch(e) {
    console.error("Failed to update perps oracle", e);
  }
}
`;

content = content.replace(
  `const missingKeeperMethods: string[] = [];`,
  ratingLogic + `\nconst missingKeeperMethods: string[] = [];`,
);

// Inject logic into onDuelEnd
const duelEndTarget = `const winnerId = data.winnerId;
    const isAgent1 = winnerId === data.agent1?.id;
    const winnerSide = isAgent1 ? "A" : "B";`;

const newDuelEndLogic = `const winnerId = data.winnerId;
    const isAgent1 = winnerId === data.agent1?.id;
    const winnerSide = isAgent1 ? "A" : "B";

    // Update TrueSkill Ratings
    if (data.agent1?.id && data.agent2?.id) {
       const uA1 = getRating(data.agent1.id.toString());
       const uA2 = getRating(data.agent2.id.toString());
       
       const { winner, loser } = updateRatings(
         isAgent1 ? uA1 : uA2,
         isAgent1 ? uA2 : uA1
       );
       
       agentRatings[data.agent1.id.toString()] = isAgent1 ? winner : loser;
       agentRatings[data.agent2.id.toString()] = isAgent1 ? loser : winner;
       saveRatings();

       // Push to Solana Perps Oracle
       await updatePerpsOracle(data.agent1.id.toString(), agentRatings[data.agent1.id.toString()]);
       await updatePerpsOracle(data.agent2.id.toString(), agentRatings[data.agent2.id.toString()]);
    }
`;

content = content.replace(duelEndTarget, newDuelEndLogic);

fs.writeFileSync("packages/gold-betting-demo/keeper/src/bot.ts", content);
