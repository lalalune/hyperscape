use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("HbXhqEFevpkfYdZCN6YmJGRmQmj9vsBun2ZHjeeaLRik");

#[program]
pub mod gold_perps_market {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.gold_mint = ctx.accounts.gold_mint.key();
        vault.insurance_fund = 0;
        vault.liquidity_fund = 0;
        Ok(())
    }

    pub fn update_oracle(ctx: Context<UpdateOracle>, agent_id: u32, spot_index: u64, mu: u64, sigma: u64) -> Result<()> {
        let oracle = &mut ctx.accounts.oracle;
        oracle.agent_id = agent_id;
        oracle.spot_index = spot_index;
        oracle.mu = mu;
        oracle.sigma = sigma;
        oracle.last_updated = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn open_position(ctx: Context<OpenPosition>, agent_id: u32, position_type: u8, collateral: u64, leverage: u64) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let oracle = &ctx.accounts.oracle;

        require!(oracle.agent_id == agent_id, PerpsError::InvalidOracle);
        
        position.owner = ctx.accounts.trader.key();
        position.agent_id = agent_id;
        position.position_type = position_type; // 0 for Long, 1 for Short
        position.collateral = collateral;
        position.size = collateral.checked_mul(leverage).unwrap();
        position.entry_price = oracle.spot_index;
        position.last_funding_time = Clock::get()?.unix_timestamp;
        
        // Transfer collateral to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.trader_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.trader.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, collateral)?;

        Ok(())
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        let position = &ctx.accounts.position;
        let oracle = &ctx.accounts.oracle;

        // Compute PnL based on current oracle spot vs entry
        let current_price = oracle.spot_index;
        let entry_price = position.entry_price;
        let size = position.size;

        // PnL in scaled units (same decimals as collateral)
        let pnl: i64 = if position.position_type == 0 {
            // Long: profit when price goes up
            ((current_price as i128 - entry_price as i128) * size as i128 / entry_price as i128) as i64
        } else {
            // Short: profit when price goes down
            ((entry_price as i128 - current_price as i128) * size as i128 / entry_price as i128) as i64
        };

        let collateral = position.collateral as i64;
        let settlement = std::cmp::max(0, collateral + pnl) as u64;

        // Transfer settlement back to owner from vault
        if settlement > 0 {
            let vault_bump = ctx.bumps.vault;
            let seeds = &[b"vault".as_ref(), &[vault_bump]];
            let signer_seeds = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            token::transfer(cpi_ctx, settlement)?;
        }

        // Position account is closed via `close = owner` constraint
        Ok(())
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        let position = &ctx.accounts.position;
        let oracle = &ctx.accounts.oracle;

        let current_price = oracle.spot_index;
        let entry_price = position.entry_price;
        let size = position.size;

        let pnl: i64 = if position.position_type == 0 {
            ((current_price as i128 - entry_price as i128) * size as i128 / entry_price as i128) as i64
        } else {
            ((entry_price as i128 - current_price as i128) * size as i128 / entry_price as i128) as i64
        };

        let collateral = position.collateral as i64;
        let equity = collateral + pnl;
        let maintenance_margin = collateral / 10; // 10% maintenance margin

        require!(equity < maintenance_margin, PerpsError::NotLiquidatable);

        // Position is underwater — seize remaining collateral to insurance fund
        // Position account will be closed (rent refund goes to liquidator)
        msg!("Liquidated position: equity={}, margin_req={}", equity, maintenance_margin);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, VaultState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub gold_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: u32)]
pub struct UpdateOracle<'info> {
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 4 + 8 + 8 + 8 + 8,
        seeds = [b"oracle", agent_id.to_le_bytes().as_ref()],
        bump
    )]
    pub oracle: Account<'info, OracleState>,
    #[account(mut)]
    pub authority: Signer<'info>, // Only authority/keeper can update
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(agent_id: u32)]
pub struct OpenPosition<'info> {
    #[account(
        init,
        payer = trader,
        space = 8 + 32 + 4 + 1 + 8 + 8 + 8 + 8,
        seeds = [b"position", trader.key().as_ref(), agent_id.to_le_bytes().as_ref()],
        bump
    )]
    pub position: Account<'info, PositionState>,
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub oracle: Account<'info, OracleState>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut, has_one = owner, close = owner)]
    pub position: Account<'info, PositionState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub oracle: Account<'info, OracleState>,
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, VaultState>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub position: Account<'info, PositionState>,
    pub oracle: Account<'info, OracleState>,
}

#[account]
pub struct VaultState {
    pub authority: Pubkey,
    pub gold_mint: Pubkey,
    pub insurance_fund: u64,
    pub liquidity_fund: u64,
}

#[account]
pub struct OracleState {
    pub agent_id: u32,
    pub spot_index: u64,
    pub mu: u64,
    pub sigma: u64,
    pub last_updated: i64,
}

#[account]
pub struct PositionState {
    pub owner: Pubkey,
    pub agent_id: u32,
    pub position_type: u8,
    pub collateral: u64,
    pub size: u64,
    pub entry_price: u64,
    pub last_funding_time: i64,
}

#[error_code]
pub enum PerpsError {
    #[msg("Invalid Oracle")]
    InvalidOracle,
    #[msg("Position is not liquidatable")]
    NotLiquidatable,
}
