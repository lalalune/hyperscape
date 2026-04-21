import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { __solanaArenaOperatorTestInternals as internals } from "../../../../src/systems/DuelScheduler/SolanaArenaOperator.js";

const hex32 = (byte: string): string => byte.repeat(32);

describe("SolanaArenaOperator serialization", () => {
  it("serializes report_result with the expected Anchor/Borsh byte layout", () => {
    const reporter = Keypair.generate().publicKey;
    const oracleConfig = Keypair.generate().publicKey;
    const duelState = Keypair.generate().publicKey;
    const programId = Keypair.generate().publicKey;
    const metadataUri = "ipfs://result";
    const seed = 0x0102030405060708n;
    const duelEndTs = 1_777_777_777n;

    const instruction = internals.buildReportResultInstruction({
      reporter,
      oracleConfig,
      duelState,
      programId,
      duelKeyBytes: internals.hexToBytes32(hex32("01")),
      winner: internals.MARKET_SIDE.A,
      seed,
      replayHash: internals.hexToBytes32(hex32("02")),
      resultHash: internals.hexToBytes32(hex32("03")),
      duelEndTs,
      metadataUri,
    });

    const data = instruction.data;
    expect(instruction.programId.equals(programId)).toBe(true);
    expect(instruction.keys.map((key) => key.pubkey.toBase58())).toEqual([
      reporter.toBase58(),
      oracleConfig.toBase58(),
      duelState.toBase58(),
    ]);
    expect(data.subarray(0, 8)).toEqual(internals.REPORT_RESULT_DISCRIMINATOR);
    expect(data.subarray(8, 40)).toEqual(Buffer.alloc(32, 0x01));
    expect(data.readUInt8(40)).toBe(internals.MARKET_SIDE.A);
    expect(data.readBigUInt64LE(41)).toBe(seed);
    expect(data.subarray(49, 81)).toEqual(Buffer.alloc(32, 0x02));
    expect(data.subarray(81, 113)).toEqual(Buffer.alloc(32, 0x03));
    expect(data.readBigInt64LE(113)).toBe(duelEndTs);
    expect(data.readUInt32LE(121)).toBe(Buffer.byteLength(metadataUri));
    expect(data.subarray(125).toString("utf8")).toBe(metadataUri);
    expect(data.length).toBe(125 + Buffer.byteLength(metadataUri));
  });

  it("serializes upsert_duel with deterministic key ordering and timestamps", () => {
    const reporter = Keypair.generate().publicKey;
    const oracleConfig = Keypair.generate().publicKey;
    const duelState = Keypair.generate().publicKey;
    const programId = Keypair.generate().publicKey;
    const metadataUri = "ipfs://duel";

    const instruction = internals.buildUpsertDuelInstruction({
      reporter,
      oracleConfig,
      duelState,
      programId,
      duelKeyBytes: internals.hexToBytes32(hex32("0a")),
      participantAHash: internals.hexToBytes32(hex32("0b")),
      participantBHash: internals.hexToBytes32(hex32("0c")),
      betOpenTs: 11n,
      betCloseTs: 22n,
      duelStartTs: 33n,
      metadataUri,
      status: internals.DUEL_STATUS.BettingOpen,
    });

    const data = instruction.data;
    expect(instruction.keys.map((key) => key.pubkey.toBase58())).toEqual([
      reporter.toBase58(),
      oracleConfig.toBase58(),
      duelState.toBase58(),
      SystemProgram.programId.toBase58(),
    ]);
    expect(data.subarray(0, 8)).toEqual(internals.UPSERT_DUEL_DISCRIMINATOR);
    expect(data.subarray(8, 40)).toEqual(Buffer.alloc(32, 0x0a));
    expect(data.subarray(40, 72)).toEqual(Buffer.alloc(32, 0x0b));
    expect(data.subarray(72, 104)).toEqual(Buffer.alloc(32, 0x0c));
    expect(data.readBigInt64LE(104)).toBe(11n);
    expect(data.readBigInt64LE(112)).toBe(22n);
    expect(data.readBigInt64LE(120)).toBe(33n);
    expect(data.readUInt32LE(128)).toBe(Buffer.byteLength(metadataUri));
    expect(data.subarray(132, 132 + metadataUri.length).toString("utf8")).toBe(
      metadataUri,
    );
    expect(data.readUInt8(132 + metadataUri.length)).toBe(
      internals.DUEL_STATUS.BettingOpen,
    );
  });

  it("rejects malformed proof hex instead of silently truncating", () => {
    expect(() => internals.hexToBytes32("abc")).toThrow(/32-byte/);
    expect(() => internals.hexToBytes32(hex32("gg"))).toThrow(/32-byte/);
  });

  it("parses reporter keypairs without byte coercion", () => {
    const keypair = Keypair.generate();
    const parsed = internals.parseKeypair(
      JSON.stringify([...keypair.secretKey]),
    );

    expect(parsed.publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
    expect(() =>
      internals.parseKeypair(JSON.stringify([256, ...Array(63).fill(0)])),
    ).toThrow(/integers in \[0, 255\]/);
    expect(() =>
      internals.parseKeypair(JSON.stringify(Array(63).fill(1))),
    ).toThrow(/64 bytes/);
  });

  it("hashes participant IDs to stable 32-byte digests", () => {
    const first = internals.hashParticipant("agent-a");
    const second = internals.hashParticipant("agent-a");
    const other = internals.hashParticipant("agent-b");

    expect(first).toHaveLength(32);
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
    expect(Buffer.from(first).equals(Buffer.from(other))).toBe(false);
  });
});
