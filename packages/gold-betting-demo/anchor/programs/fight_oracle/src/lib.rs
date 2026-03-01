#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;

declare_id!("6tpRysBFd1yXRipYEYwAw9jxEoVHk15kVXfkDGFLMqcD");

pub const ORACLE_CONFIG_SEED: &[u8] = b"oracle_config";
pub const MATCH_SEED: &[u8] = b"match";

#[program]
pub mod fight_oracle {
    use super::*;

    pub fn initialize_oracle(ctx: Context<InitializeOracle>) -> Result<()> {
        let oracle_config = &mut ctx.accounts.oracle_config;

        if oracle_config.authority != Pubkey::default() {
            require_keys_eq!(
                oracle_config.authority,
                ctx.accounts.authority.key(),
                ErrorCode::Unauthorized
            );
            return Ok(());
        }

        oracle_config.authority = ctx.accounts.authority.key();
        oracle_config.bump = ctx.bumps.oracle_config;
        Ok(())
    }

    pub fn create_match(
        ctx: Context<CreateMatch>,
        match_id: u64,
        bet_window_seconds: i64,
        metadata_uri: String,
    ) -> Result<()> {
        require!(bet_window_seconds > 0, ErrorCode::InvalidBetWindow);

        let now = Clock::get()?.unix_timestamp;
        let close_ts = now
            .checked_add(bet_window_seconds)
            .ok_or(ErrorCode::MathOverflow)?;

        let match_result = &mut ctx.accounts.match_result;
        match_result.match_id = match_id;
        match_result.oracle_config = ctx.accounts.oracle_config.key();
        match_result.open_ts = now;
        match_result.bet_close_ts = close_ts;
        match_result.status = MatchStatus::Open;
        match_result.winner = None;
        match_result.seed = None;
        match_result.replay_hash = [0_u8; 32];
        match_result.resolved_ts = None;
        match_result.metadata_uri = metadata_uri;
        match_result.bump = ctx.bumps.match_result;

        emit!(MatchCreated {
            match_id,
            open_ts: now,
            bet_close_ts: close_ts,
        });

        Ok(())
    }

    pub fn post_result(
        ctx: Context<PostResult>,
        winner: MarketSide,
        seed: u64,
        replay_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let match_result = &mut ctx.accounts.match_result;

        require!(
            match_result.status == MatchStatus::Open,
            ErrorCode::MatchAlreadyResolved
        );
        require!(
            now >= match_result.bet_close_ts,
            ErrorCode::BetWindowStillOpen
        );

        match_result.status = MatchStatus::Resolved;
        match_result.winner = Some(winner);
        match_result.seed = Some(seed);
        match_result.replay_hash = replay_hash;
        match_result.resolved_ts = Some(now);

        emit!(MatchResolved {
            match_id: match_result.match_id,
            winner,
            seed,
            resolved_ts: now,
            replay_hash,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeOracle<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + OracleConfig::INIT_SPACE,
        seeds = [ORACLE_CONFIG_SEED],
        bump,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(match_id: u64)]
pub struct CreateMatch<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ORACLE_CONFIG_SEED],
        bump = oracle_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + MatchResult::INIT_SPACE,
        seeds = [MATCH_SEED, &match_id.to_le_bytes()],
        bump,
    )]
    pub match_result: Account<'info, MatchResult>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PostResult<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [ORACLE_CONFIG_SEED],
        bump = oracle_config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub oracle_config: Account<'info, OracleConfig>,

    #[account(
        mut,
        has_one = oracle_config,
        seeds = [MATCH_SEED, &match_result.match_id.to_le_bytes()],
        bump = match_result.bump,
    )]
    pub match_result: Account<'info, MatchResult>,
}

#[account]
#[derive(InitSpace)]
pub struct OracleConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct MatchResult {
    pub match_id: u64,
    pub oracle_config: Pubkey,
    pub open_ts: i64,
    pub bet_close_ts: i64,
    pub status: MatchStatus,
    pub winner: Option<MarketSide>,
    pub seed: Option<u64>,
    pub replay_hash: [u8; 32],
    pub resolved_ts: Option<i64>,
    #[max_len(200)]
    pub metadata_uri: String,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq, InitSpace)]
pub enum MatchStatus {
    Open,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Eq, PartialEq, InitSpace)]
pub enum MarketSide {
    Yes,
    No,
}

#[event]
pub struct MatchCreated {
    pub match_id: u64,
    pub open_ts: i64,
    pub bet_close_ts: i64,
}

#[event]
pub struct MatchResolved {
    pub match_id: u64,
    pub winner: MarketSide,
    pub seed: u64,
    pub resolved_ts: i64,
    pub replay_hash: [u8; 32],
}

#[error_code]
pub enum ErrorCode {
    #[msg("Only the oracle authority can call this instruction")]
    Unauthorized,
    #[msg("The betting window must be positive")]
    InvalidBetWindow,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("The betting window is still open")]
    BetWindowStillOpen,
    #[msg("Match has already been resolved")]
    MatchAlreadyResolved,
}
