/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from "bn.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  createPrograms,
  enumIs,
  findMatchPda,
  findOracleConfigPda,
  readKeypair,
  requireEnv,
} from "./common";
import { simulateFight } from "./fight";

const args = await yargs(hideBin(process.argv))
  .option("match-id", {
    type: "number",
    demandOption: true,
    describe: "Match id used by fight_oracle",
  })
  .strict()
  .parse();

const oracleAuthority = readKeypair(requireEnv("ORACLE_AUTHORITY_KEYPAIR"));
const { fightOracle } = createPrograms(oracleAuthority);
const oracleProgram: any = fightOracle;

const matchId = new BN(args["match-id"]);
const matchPda = findMatchPda(fightOracle.programId, matchId);
const oracleConfigPda = findOracleConfigPda(fightOracle.programId);

const matchState = await oracleProgram.account.matchResult.fetch(matchPda);
const nowTs = Math.floor(Date.now() / 1000);

let postResultSig: string | null = null;
if (enumIs(matchState.status, "open")) {
  if (nowTs < Number(matchState.betCloseTs)) {
    throw new Error("Bet window still open; refusing to resolve early");
  }

  const fight = simulateFight(BigInt(Date.now()));
  postResultSig = await oracleProgram.methods
    .postResult(
      fight.winner === "A" ? ({ yes: {} } as any) : ({ no: {} } as any),
      new BN(fight.seed.toString()),
      Array.from(fight.replayHash),
    )
    .accounts({
      authority: oracleAuthority.publicKey,
      oracleConfig: oracleConfigPda,
      matchResult: matchPda,
    })
    .rpc();
}

console.log(
  JSON.stringify(
    {
      match: matchPda.toBase58(),
      postResultSig,
    },
    null,
    2,
  ),
);
