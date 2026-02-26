/**
 * SQLite persistence for the keeper service.
 *
 * Strategy: load-on-start + write-through.
 * All existing in-memory Maps are populated from the DB at startup.
 * Every mutation calls one of the save* functions below so data survives
 * restarts. Rate-limit buckets, parsers and SSE clients remain ephemeral.
 */
import { Database } from "bun:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.KEEPER_DB_PATH?.trim()
  ? process.env.KEEPER_DB_PATH.trim()
  : path.resolve(__dirname, "..", "keeper.sqlite");

export type DbBetRecord = {
  id: string;
  bettorWallet: string;
  chain: "SOLANA" | "BSC" | "BASE";
  sourceAsset: string;
  sourceAmount: number;
  goldAmount: number;
  feeBps: number;
  txSignature: string;
  marketPda: string | null;
  inviteCode: string | null;
  externalBetRef: string | null;
  recordedAt: number;
};

export type DbWalletPoints = {
  selfPoints: number;
  winPoints: number;
  referralPoints: number;
  stakingPoints: number;
};

// ── DB singleton ──────────────────────────────────────────────────────────────

const db = new Database(DB_PATH, { create: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");
db.run("PRAGMA foreign_keys = ON");

// ── Schema ────────────────────────────────────────────────────────────────────

db.run(`CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  bettor_wallet TEXT NOT NULL,
  chain TEXT NOT NULL,
  source_asset TEXT NOT NULL,
  source_amount REAL NOT NULL DEFAULT 0,
  gold_amount REAL NOT NULL DEFAULT 0,
  fee_bps INTEGER NOT NULL DEFAULT 0,
  tx_signature TEXT NOT NULL DEFAULT '',
  market_pda TEXT,
  invite_code TEXT,
  external_bet_ref TEXT,
  recorded_at INTEGER NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS wallet_display (
  normalized_wallet TEXT PRIMARY KEY,
  display_name TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS wallet_points (
  wallet TEXT PRIMARY KEY,
  self_points REAL NOT NULL DEFAULT 0,
  win_points REAL NOT NULL DEFAULT 0,
  referral_points REAL NOT NULL DEFAULT 0,
  staking_points REAL NOT NULL DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS wallet_canonical (
  wallet TEXT PRIMARY KEY,
  canonical TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS identity_members (
  canonical TEXT NOT NULL,
  member TEXT NOT NULL,
  PRIMARY KEY (canonical, member)
)`);

db.run(`CREATE TABLE IF NOT EXISTS invite_codes (
  wallet TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE
)`);

db.run(`CREATE TABLE IF NOT EXISTS referrals (
  wallet TEXT PRIMARY KEY,
  referrer_wallet TEXT NOT NULL,
  invite_code TEXT NOT NULL
)`);

db.run(`CREATE TABLE IF NOT EXISTS invited_wallets (
  referrer TEXT NOT NULL,
  invitee TEXT NOT NULL,
  PRIMARY KEY (referrer, invitee)
)`);

db.run(`CREATE TABLE IF NOT EXISTS referral_fees (
  wallet TEXT PRIMARY KEY,
  fee_share_gold REAL NOT NULL DEFAULT 0,
  treasury_fees REAL NOT NULL DEFAULT 0
)`);

// ── Prepared statements ───────────────────────────────────────────────────────

const insertBet = db.prepare(`INSERT OR IGNORE INTO bets
  (id, bettor_wallet, chain, source_asset, source_amount, gold_amount,
   fee_bps, tx_signature, market_pda, invite_code, external_bet_ref, recorded_at)
  VALUES ($id, $bettorWallet, $chain, $sourceAsset, $sourceAmount, $goldAmount,
          $feeBps, $txSignature, $marketPda, $inviteCode, $externalBetRef, $recordedAt)`);

const upsertWalletDisplay =
  db.prepare(`INSERT INTO wallet_display (normalized_wallet, display_name)
  VALUES ($normalized, $display)
  ON CONFLICT(normalized_wallet) DO UPDATE SET display_name = excluded.display_name`);

const upsertWalletPoints = db.prepare(`INSERT INTO wallet_points
  (wallet, self_points, win_points, referral_points, staking_points)
  VALUES ($wallet, $selfPoints, $winPoints, $referralPoints, $stakingPoints)
  ON CONFLICT(wallet) DO UPDATE SET
    self_points = excluded.self_points,
    win_points = excluded.win_points,
    referral_points = excluded.referral_points,
    staking_points = excluded.staking_points`);

const upsertWalletCanonical =
  db.prepare(`INSERT INTO wallet_canonical (wallet, canonical)
  VALUES ($wallet, $canonical)
  ON CONFLICT(wallet) DO UPDATE SET canonical = excluded.canonical`);

const insertIdentityMember =
  db.prepare(`INSERT OR IGNORE INTO identity_members (canonical, member)
  VALUES ($canonical, $member)`);

const deleteIdentityMembersForCanonical = db.prepare(
  `DELETE FROM identity_members WHERE canonical = $canonical`,
);

const upsertInviteCode = db.prepare(`INSERT INTO invite_codes (wallet, code)
  VALUES ($wallet, $code)
  ON CONFLICT(wallet) DO UPDATE SET code = excluded.code`);

const upsertReferral =
  db.prepare(`INSERT INTO referrals (wallet, referrer_wallet, invite_code)
  VALUES ($wallet, $referrerWallet, $inviteCode)
  ON CONFLICT(wallet) DO UPDATE SET
    referrer_wallet = excluded.referrer_wallet,
    invite_code = excluded.invite_code`);

const insertInvitedWallet =
  db.prepare(`INSERT OR IGNORE INTO invited_wallets (referrer, invitee)
  VALUES ($referrer, $invitee)`);

const upsertReferralFees =
  db.prepare(`INSERT INTO referral_fees (wallet, fee_share_gold, treasury_fees)
  VALUES ($wallet, $feeShareGold, $treasuryFees)
  ON CONFLICT(wallet) DO UPDATE SET
    fee_share_gold = excluded.fee_share_gold,
    treasury_fees = excluded.treasury_fees`);

// ── Load (hydrate in-memory state from DB at startup) ─────────────────────────

export type HydratedState = {
  bets: DbBetRecord[];
  walletDisplay: Map<string, string>;
  pointsByWallet: Map<string, DbWalletPoints>;
  canonicalByWallet: Map<string, string>;
  identityMembers: Map<string, Set<string>>;
  inviteCodeByWallet: Map<string, string>;
  walletByInviteCode: Map<string, string>;
  referredByWallet: Map<string, { wallet: string; code: string }>;
  invitedWalletsByWallet: Map<string, Set<string>>;
  referralFeeShareGoldByWallet: Map<string, number>;
  treasuryFeesFromReferralsByWallet: Map<string, number>;
};

export function loadAll(betLimit = 5000): HydratedState {
  const bets = (
    db
      .prepare(
        `SELECT id, bettor_wallet, chain, source_asset, source_amount, gold_amount,
          fee_bps, tx_signature, market_pda, invite_code, external_bet_ref, recorded_at
         FROM bets ORDER BY recorded_at DESC LIMIT ?`,
      )
      .all(betLimit) as Array<Record<string, unknown>>
  ).map(
    (row): DbBetRecord => ({
      id: String(row.id),
      bettorWallet: String(row.bettor_wallet),
      chain: String(row.chain) as DbBetRecord["chain"],
      sourceAsset: String(row.source_asset),
      sourceAmount: Number(row.source_amount),
      goldAmount: Number(row.gold_amount),
      feeBps: Number(row.fee_bps),
      txSignature: String(row.tx_signature),
      marketPda: row.market_pda != null ? String(row.market_pda) : null,
      inviteCode: row.invite_code != null ? String(row.invite_code) : null,
      externalBetRef:
        row.external_bet_ref != null ? String(row.external_bet_ref) : null,
      recordedAt: Number(row.recorded_at),
    }),
  );

  const walletDisplay = new Map<string, string>();
  for (const row of db
    .prepare("SELECT normalized_wallet, display_name FROM wallet_display")
    .all() as Array<Record<string, string>>) {
    walletDisplay.set(row.normalized_wallet, row.display_name);
  }

  const pointsByWallet = new Map<string, DbWalletPoints>();
  for (const row of db
    .prepare(
      "SELECT wallet, self_points, win_points, referral_points, staking_points FROM wallet_points",
    )
    .all() as Array<Record<string, unknown>>) {
    pointsByWallet.set(String(row.wallet), {
      selfPoints: Number(row.self_points),
      winPoints: Number(row.win_points),
      referralPoints: Number(row.referral_points),
      stakingPoints: Number(row.staking_points),
    });
  }

  const canonicalByWallet = new Map<string, string>();
  for (const row of db
    .prepare("SELECT wallet, canonical FROM wallet_canonical")
    .all() as Array<Record<string, string>>) {
    canonicalByWallet.set(row.wallet, row.canonical);
  }

  const identityMembers = new Map<string, Set<string>>();
  for (const row of db
    .prepare("SELECT canonical, member FROM identity_members")
    .all() as Array<Record<string, string>>) {
    const set = identityMembers.get(row.canonical) ?? new Set<string>();
    set.add(row.member);
    identityMembers.set(row.canonical, set);
  }

  const inviteCodeByWallet = new Map<string, string>();
  const walletByInviteCode = new Map<string, string>();
  for (const row of db
    .prepare("SELECT wallet, code FROM invite_codes")
    .all() as Array<Record<string, string>>) {
    inviteCodeByWallet.set(row.wallet, row.code);
    walletByInviteCode.set(row.code, row.wallet);
  }

  const referredByWallet = new Map<string, { wallet: string; code: string }>();
  for (const row of db
    .prepare("SELECT wallet, referrer_wallet, invite_code FROM referrals")
    .all() as Array<Record<string, string>>) {
    referredByWallet.set(row.wallet, {
      wallet: row.referrer_wallet,
      code: row.invite_code,
    });
  }

  const invitedWalletsByWallet = new Map<string, Set<string>>();
  for (const row of db
    .prepare("SELECT referrer, invitee FROM invited_wallets")
    .all() as Array<Record<string, string>>) {
    const set = invitedWalletsByWallet.get(row.referrer) ?? new Set<string>();
    set.add(row.invitee);
    invitedWalletsByWallet.set(row.referrer, set);
  }

  const referralFeeShareGoldByWallet = new Map<string, number>();
  const treasuryFeesFromReferralsByWallet = new Map<string, number>();
  for (const row of db
    .prepare("SELECT wallet, fee_share_gold, treasury_fees FROM referral_fees")
    .all() as Array<Record<string, unknown>>) {
    referralFeeShareGoldByWallet.set(
      String(row.wallet),
      Number(row.fee_share_gold),
    );
    treasuryFeesFromReferralsByWallet.set(
      String(row.wallet),
      Number(row.treasury_fees),
    );
  }

  console.log(
    `[db] loaded ${bets.length} bets, ${walletDisplay.size} wallets, ${pointsByWallet.size} point records from ${DB_PATH}`,
  );

  return {
    bets,
    walletDisplay,
    pointsByWallet,
    canonicalByWallet,
    identityMembers,
    inviteCodeByWallet,
    walletByInviteCode,
    referredByWallet,
    invitedWalletsByWallet,
    referralFeeShareGoldByWallet,
    treasuryFeesFromReferralsByWallet,
  };
}

// ── Save helpers (called after each mutation) ─────────────────────────────────

export function saveBet(bet: DbBetRecord): void {
  insertBet.run({
    $id: bet.id,
    $bettorWallet: bet.bettorWallet,
    $chain: bet.chain,
    $sourceAsset: bet.sourceAsset,
    $sourceAmount: bet.sourceAmount,
    $goldAmount: bet.goldAmount,
    $feeBps: bet.feeBps,
    $txSignature: bet.txSignature,
    $marketPda: bet.marketPda,
    $inviteCode: bet.inviteCode,
    $externalBetRef: bet.externalBetRef,
    $recordedAt: bet.recordedAt,
  });
}

export function saveWalletDisplay(normalized: string, display: string): void {
  upsertWalletDisplay.run({ $normalized: normalized, $display: display });
}

export function saveWalletPoints(wallet: string, points: DbWalletPoints): void {
  upsertWalletPoints.run({
    $wallet: wallet,
    $selfPoints: points.selfPoints,
    $winPoints: points.winPoints,
    $referralPoints: points.referralPoints,
    $stakingPoints: points.stakingPoints,
  });
}

export function saveWalletCanonical(wallet: string, canonical: string): void {
  upsertWalletCanonical.run({ $wallet: wallet, $canonical: canonical });
}

/** Replace all members for a canonical identity (used after a merge). */
export function saveIdentityMembers(
  canonical: string,
  members: Set<string>,
): void {
  const doSave = db.transaction(() => {
    deleteIdentityMembersForCanonical.run({ $canonical: canonical });
    for (const member of members) {
      insertIdentityMember.run({ $canonical: canonical, $member: member });
    }
  });
  doSave();
}

export function saveInviteCode(wallet: string, code: string): void {
  upsertInviteCode.run({ $wallet: wallet, $code: code });
}

export function saveReferral(
  wallet: string,
  referrerWallet: string,
  inviteCode: string,
): void {
  upsertReferral.run({
    $wallet: wallet,
    $referrerWallet: referrerWallet,
    $inviteCode: inviteCode,
  });
}

export function saveInvitedWallet(referrer: string, invitee: string): void {
  insertInvitedWallet.run({ $referrer: referrer, $invitee: invitee });
}

export function saveReferralFees(
  wallet: string,
  feeShareGold: number,
  treasuryFees: number,
): void {
  upsertReferralFees.run({
    $wallet: wallet,
    $feeShareGold: feeShareGold,
    $treasuryFees: treasuryFees,
  });
}
