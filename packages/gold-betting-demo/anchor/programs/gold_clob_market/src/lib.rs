#![allow(unexpected_cfgs)]
#![allow(deprecated)]

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("AqRu5b1fd67VyR4MgjKPN9EMgQ8wxauDUxyY5pUsGdAW");

#[program]
pub mod gold_clob_market {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury: Pubkey,
        market_maker: Pubkey,
        trade_treasury_fee_bps: u16,
        trade_market_maker_fee_bps: u16,
        winnings_market_maker_fee_bps: u16,
    ) -> Result<()> {
        validate_fee_config(
            trade_treasury_fee_bps,
            trade_market_maker_fee_bps,
            winnings_market_maker_fee_bps,
        )?;

        let config = &mut ctx.accounts.config;
        config.authority = *ctx.accounts.authority.key;
        config.treasury = treasury;
        config.market_maker = market_maker;
        config.trade_treasury_fee_bps = trade_treasury_fee_bps;
        config.trade_market_maker_fee_bps = trade_market_maker_fee_bps;
        config.winnings_market_maker_fee_bps = winnings_market_maker_fee_bps;

        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        treasury: Pubkey,
        market_maker: Pubkey,
        trade_treasury_fee_bps: u16,
        trade_market_maker_fee_bps: u16,
        winnings_market_maker_fee_bps: u16,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.config.authority,
            ctx.accounts.authority.key(),
            ErrorCode::UnauthorizedConfigAuthority
        );
        validate_fee_config(
            trade_treasury_fee_bps,
            trade_market_maker_fee_bps,
            winnings_market_maker_fee_bps,
        )?;

        let config = &mut ctx.accounts.config;
        config.treasury = treasury;
        config.market_maker = market_maker;
        config.trade_treasury_fee_bps = trade_treasury_fee_bps;
        config.trade_market_maker_fee_bps = trade_market_maker_fee_bps;
        config.winnings_market_maker_fee_bps = winnings_market_maker_fee_bps;

        Ok(())
    }

    pub fn initialize_order_book(ctx: Context<InitializeOrderBook>) -> Result<()> {
        let order_book = &mut ctx.accounts.order_book;
        order_book.match_state = ctx.accounts.match_state.key();
        Ok(())
    }

    pub fn initialize_match(ctx: Context<InitializeMatch>, _yes_price: u16) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        match_state.is_open = true;
        match_state.winner = MarketSide::None;
        match_state.next_order_id = 1;
        match_state.vault_bump = ctx.bumps.vault;
        match_state.authority = *ctx.accounts.user.key;
        Ok(())
    }

    pub fn place_order<'info>(
        ctx: Context<'_, '_, 'info, 'info, PlaceOrder<'info>>,
        order_id: u64,
        is_buy: bool,
        price: u16,
        amount: u64,
    ) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        let _order_book = &mut ctx.accounts.order_book;

        require!(match_state.is_open, ErrorCode::MatchClosed);
        require!(order_id == match_state.next_order_id, ErrorCode::InvalidOrderId);
        require!(price > 0 && price < 1000, ErrorCode::InvalidPrice);

        let price_component = if is_buy {
            price as u64
        } else {
            1000u64
                .checked_sub(price as u64)
                .ok_or(ErrorCode::MathOverflow)?
        };
        let cost_full = amount
            .checked_mul(price_component)
            .ok_or(ErrorCode::MathOverflow)?;
            
        require!(cost_full % 1000 == 0, ErrorCode::PrecisionError);
        
        let cost = cost_full
            .checked_div(1000)
            .ok_or(ErrorCode::MathOverflow)?;
        require!(cost > 0, ErrorCode::CostTooLow);

        // Calculate fees
        let trade_treasury_fee = cost
            .checked_mul(ctx.accounts.config.trade_treasury_fee_bps as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)?;
        let trade_market_maker_fee = cost
            .checked_mul(ctx.accounts.config.trade_market_maker_fee_bps as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)?;

        // Transfer treasury fee (native SOL)
        if trade_treasury_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.user.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                trade_treasury_fee,
            )?;
        }

        // Transfer market maker fee (native SOL)
        if trade_market_maker_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.user.to_account_info(),
                        to: ctx.accounts.market_maker.to_account_info(),
                    },
                ),
                trade_market_maker_fee,
            )?;
        }

        // Transfer cost to vault PDA (native SOL)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            cost,
        )?;

        let match_key = match_state.key();
        let vault_bump = match_state.vault_bump;

        let mut account_idx = 0;
        let mut remaining_amount = amount;
        let mut matches_count = 0;
        const MAX_MATCHES_PER_TX: u32 = 50;

        while remaining_amount > 0 && matches_count < MAX_MATCHES_PER_TX && account_idx < ctx.remaining_accounts.len() {
            let maker_order_account = &ctx.remaining_accounts[account_idx];
            let maker_balance_account = &ctx.remaining_accounts[account_idx + 1];
            account_idx += 2;

            if maker_order_account.data_is_empty() { continue; }
            let mut maker_order: Account<Order> = Account::try_from(maker_order_account).map_err(|_| ErrorCode::InvalidRemainingAccount)?;
            
            if maker_order.is_buy == is_buy { continue; }
            if maker_order.filled >= maker_order.amount { continue; }
            if maker_order.match_state != match_state.key() { continue; }
            
            let maker_price = maker_order.price;
            let checks_out = if is_buy {
                maker_price <= price
            } else {
                maker_price >= price
            };
            if !checks_out { continue; }

            let mut maker_balance: Account<UserBalance> = Account::try_from(maker_balance_account).map_err(|_| ErrorCode::InvalidRemainingAccount)?;
            require_keys_eq!(maker_balance.user, maker_order.maker, ErrorCode::InvalidRemainingAccount);

            let maker_remaining = maker_order.amount.checked_sub(maker_order.filled).ok_or(ErrorCode::MathOverflow)?;
            let fill_amount = std::cmp::min(remaining_amount, maker_remaining);

            maker_order.filled = maker_order.filled.checked_add(fill_amount).ok_or(ErrorCode::MathOverflow)?;
            remaining_amount = remaining_amount.checked_sub(fill_amount).ok_or(ErrorCode::MathOverflow)?;

            if is_buy {
                maker_balance.no_shares = maker_balance.no_shares.checked_add(fill_amount).ok_or(ErrorCode::MathOverflow)?;
                let user_balance = &mut ctx.accounts.user_balance;
                user_balance.user = *ctx.accounts.user.key;
                user_balance.match_state = match_state.key();
                user_balance.yes_shares = user_balance.yes_shares.checked_add(fill_amount).ok_or(ErrorCode::MathOverflow)?;

                if price > maker_price {
                    let improvement = fill_amount.checked_mul((price - maker_price) as u64)
                        .ok_or(ErrorCode::MathOverflow)?
                        .checked_div(1000)
                        .ok_or(ErrorCode::MathOverflow)?;
                    if improvement > 0 {
                        // Refund price improvement from vault PDA
                        let seeds: &[&[u8]] = &[b"vault", match_key.as_ref(), &[vault_bump]];
                        let signer_seeds: &[&[&[u8]]] = &[seeds];
                        system_program::transfer(
                            CpiContext::new_with_signer(
                                ctx.accounts.system_program.to_account_info(),
                                system_program::Transfer {
                                    from: ctx.accounts.vault.to_account_info(),
                                    to: ctx.accounts.user.to_account_info(),
                                },
                                signer_seeds,
                            ),
                            improvement,
                        )?;
                    }
                }
            } else {
                maker_balance.yes_shares = maker_balance.yes_shares.checked_add(fill_amount).ok_or(ErrorCode::MathOverflow)?;
                let user_balance = &mut ctx.accounts.user_balance;
                user_balance.user = *ctx.accounts.user.key;
                user_balance.match_state = match_state.key();
                user_balance.no_shares = user_balance.no_shares.checked_add(fill_amount).ok_or(ErrorCode::MathOverflow)?;

                if maker_price > price {
                    let improvement = fill_amount.checked_mul((maker_price - price) as u64)
                        .ok_or(ErrorCode::MathOverflow)?
                        .checked_div(1000)
                        .ok_or(ErrorCode::MathOverflow)?;
                    if improvement > 0 {
                        let seeds: &[&[u8]] = &[b"vault", match_key.as_ref(), &[vault_bump]];
                        let signer_seeds: &[&[&[u8]]] = &[seeds];
                        system_program::transfer(
                            CpiContext::new_with_signer(
                                ctx.accounts.system_program.to_account_info(),
                                system_program::Transfer {
                                    from: ctx.accounts.vault.to_account_info(),
                                    to: ctx.accounts.user.to_account_info(),
                                },
                                signer_seeds,
                            ),
                            improvement,
                        )?;
                    }
                }
            }
            
            maker_order.exit(&crate::ID)?;
            maker_balance.exit(&crate::ID)?;
            matches_count += 1;
        }

        if remaining_amount > 0 {
            let new_order = &mut ctx.accounts.new_order;
            new_order.id = match_state.next_order_id;
            new_order.match_state = match_state.key();
            new_order.maker = *ctx.accounts.user.key;
            new_order.is_buy = is_buy;
            new_order.price = price;
            new_order.amount = amount;
            new_order.filled = amount - remaining_amount;
            
            match_state.next_order_id += 1;
        }

        Ok(())
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, _order_id: u64) -> Result<()> {
        let order = &mut ctx.accounts.order;
        require!(order.maker == *ctx.accounts.user.key, ErrorCode::NotOrderMaker);
        require!(order.filled < order.amount, ErrorCode::AlreadyFilled);

        let remaining = order.amount - order.filled;
        order.filled = order.amount;

        let price_component = if order.is_buy {
            order.price as u64
        } else {
            1000u64
                .checked_sub(order.price as u64)
                .ok_or(ErrorCode::MathOverflow)?
        };
        let cost_full = remaining
            .checked_mul(price_component)
            .ok_or(ErrorCode::MathOverflow)?;
            
        require!(cost_full % 1000 == 0, ErrorCode::PrecisionError);
            
        let cost = cost_full
            .checked_div(1000)
            .ok_or(ErrorCode::MathOverflow)?;

        let match_state = &ctx.accounts.match_state;
        let match_key = match_state.key();
        let bump = match_state.vault_bump;

        let seeds: &[&[u8]] = &[b"vault", match_key.as_ref(), &[bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        // Refund native SOL from vault PDA
        if cost > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.user.to_account_info(),
                    },
                    signer_seeds,
                ),
                cost,
            )?;
        }

        Ok(())
    }

    pub fn resolve_match(ctx: Context<ResolveMatch>, winner: MarketSide) -> Result<()> {
        let match_state = &mut ctx.accounts.match_state;
        require!(match_state.is_open, ErrorCode::MatchClosed);
        require!(
            *ctx.accounts.authority.key == match_state.authority,
            ErrorCode::UnauthorizedResolver
        );
        require!(winner == MarketSide::Yes || winner == MarketSide::No, ErrorCode::InvalidWinner);
        match_state.is_open = false;
        match_state.winner = winner;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let match_state = &ctx.accounts.match_state;
        let user_balance = &mut ctx.accounts.user_balance;
        
        require!(!match_state.is_open, ErrorCode::MatchStillOpen);

        let mut winning_shares: u64 = 0;

        if match_state.winner == MarketSide::Yes {
            winning_shares = user_balance.yes_shares;
            user_balance.yes_shares = 0;
        } else if match_state.winner == MarketSide::No {
            winning_shares = user_balance.no_shares;
            user_balance.no_shares = 0;
        } 
        require!(winning_shares > 0, ErrorCode::NothingToClaim);

        let fee = winning_shares
            .checked_mul(ctx.accounts.config.winnings_market_maker_fee_bps as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::MathOverflow)?;
        let payout = winning_shares
            .checked_sub(fee)
            .ok_or(ErrorCode::MathOverflow)?;

        let match_key = match_state.key();
        let vault_bump = match_state.vault_bump;
        let seeds: &[&[u8]] = &[b"vault", match_key.as_ref(), &[vault_bump]];
        let signer_seeds: &[&[&[u8]]] = &[seeds];

        // Transfer winnings fee to market maker (native SOL)
        if fee > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.market_maker.to_account_info(),
                    },
                    signer_seeds,
                ),
                fee,
            )?;
        }

        // Transfer payout to user (native SOL)
        if payout > 0 {
            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.user.to_account_info(),
                    },
                    signer_seeds,
                ),
                payout,
            )?;
        }

        Ok(())
    }
}



fn validate_fee_config(
    trade_treasury_fee_bps: u16,
    trade_market_maker_fee_bps: u16,
    winnings_market_maker_fee_bps: u16,
) -> Result<()> {
    require!(trade_treasury_fee_bps <= 10_000, ErrorCode::InvalidFeeBps);
    require!(trade_market_maker_fee_bps <= 10_000, ErrorCode::InvalidFeeBps);
    require!(winnings_market_maker_fee_bps <= 10_000, ErrorCode::InvalidFeeBps);
    require!(
        (trade_treasury_fee_bps as u32 + trade_market_maker_fee_bps as u32) <= 10_000,
        ErrorCode::InvalidFeeBps
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + MarketConfig::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, MarketConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, MarketConfig>,
}

#[derive(Accounts)]
pub struct InitializeOrderBook<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub match_state: Account<'info, MatchState>,
    #[account(init, payer = user, space = 8 + OrderBook::INIT_SPACE)]
    pub order_book: Account<'info, OrderBook>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeMatch<'info> {
    #[account(init, payer = user, space = 8 + MatchState::INIT_SPACE)]
    pub match_state: Account<'info, MatchState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, MarketConfig>,

    /// CHECK: PDA vault that holds native SOL
    #[account(
        mut,
        seeds = [b"vault", match_state.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub match_state: Box<Account<'info, MatchState>>,
    #[account(
        mut,
        has_one = match_state @ ErrorCode::OrderBookMismatch,
    )]
    pub order_book: Box<Account<'info, OrderBook>>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserBalance::INIT_SPACE,
        seeds = [b"balance", match_state.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_balance: Box<Account<'info, UserBalance>>,
    #[account(
        init,
        payer = user,
        space = 8 + Order::INIT_SPACE,
        seeds = [b"order", match_state.key().as_ref(), user.key().as_ref(), &order_id.to_le_bytes()],
        bump
    )]
    pub new_order: Box<Account<'info, Order>>,
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub config: Box<Account<'info, MarketConfig>>,

    /// CHECK: Treasury wallet to receive fees
    #[account(
        mut,
        address = config.treasury @ ErrorCode::InvalidFeeAccount,
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Market maker wallet to receive fees
    #[account(
        mut,
        address = config.market_maker @ ErrorCode::InvalidFeeAccount,
    )]
    pub market_maker: UncheckedAccount<'info>,

    /// CHECK: PDA vault that holds native SOL
    #[account(
        mut,
        seeds = [b"vault", match_state.key().as_ref()],
        bump = match_state.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    // remaining_accounts: Maker Orders being matched, Maker Balances being credited
}

#[derive(Accounts)]
pub struct ResolveMatch<'info> {
    #[account(mut)]
    pub match_state: Account<'info, MatchState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub match_state: Box<Account<'info, MatchState>>,
    #[account(
        mut,
        has_one = match_state @ ErrorCode::OrderBookMismatch,
    )]
    pub order_book: Box<Account<'info, OrderBook>>,
    #[account(
        mut,
        seeds = [b"balance", match_state.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_balance: Box<Account<'info, UserBalance>>,
    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub config: Box<Account<'info, MarketConfig>>,

    /// CHECK: Market maker wallet to receive winnings fee
    #[account(
        mut,
        address = config.market_maker @ ErrorCode::InvalidFeeAccount,
    )]
    pub market_maker: UncheckedAccount<'info>,

    /// CHECK: PDA vault that holds native SOL
    #[account(
        mut,
        seeds = [b"vault", match_state.key().as_ref()],
        bump = match_state.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub match_state: Box<Account<'info, MatchState>>,
    #[account(
        mut,
        has_one = match_state @ ErrorCode::OrderBookMismatch,
    )]
    pub order_book: Box<Account<'info, OrderBook>>,
    #[account(
        mut,
        seeds = [b"order", match_state.key().as_ref(), user.key().as_ref(), &order_id.to_le_bytes()],
        bump,
        close = user,
    )]
    pub order: Box<Account<'info, Order>>,

    /// CHECK: PDA vault that holds native SOL
    #[account(
        mut,
        seeds = [b"vault", match_state.key().as_ref()],
        bump = match_state.vault_bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum MarketSide {
    None,
    Yes,
    No,
}

#[account]
#[derive(InitSpace)]
pub struct MatchState {
    pub is_open: bool,
    pub winner: MarketSide,
    pub next_order_id: u64,
    pub vault_bump: u8,
    pub authority: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct MarketConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub market_maker: Pubkey,
    pub trade_treasury_fee_bps: u16,
    pub trade_market_maker_fee_bps: u16,
    pub winnings_market_maker_fee_bps: u16,
}

#[account]
#[derive(InitSpace)]
pub struct OrderBook {
    pub match_state: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct UserBalance {
    pub user: Pubkey,
    pub match_state: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
}

#[account]
#[derive(InitSpace)]
pub struct Order {
    pub id: u64,
    pub match_state: Pubkey,
    pub maker: Pubkey,
    pub is_buy: bool,
    pub price: u16,
    pub amount: u64,
    pub filled: u64,
}



#[error_code]
pub enum ErrorCode {
    #[msg("Match is closed")]
    MatchClosed,
    #[msg("Match is still open")]
    MatchStillOpen,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Order not found")]
    OrderNotFound,
    #[msg("Not the order maker")]
    NotOrderMaker,
    #[msg("Order is already fully filled")]
    AlreadyFilled,
    #[msg("Cost is zero, amount too small")]
    CostTooLow,
    #[msg("Unauthorized to resolve match")]
    UnauthorizedResolver,
    #[msg("Order book does not belong to this match")]
    OrderBookMismatch,
    #[msg("Invalid fee account provided for treasury or market maker")]
    InvalidFeeAccount,
    #[msg("Invalid fee basis points")]
    InvalidFeeBps,
    #[msg("Only config authority can update fee config")]
    UnauthorizedConfigAuthority,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Math precision error")]
    PrecisionError,
    #[msg("Invalid remaining account provided")]
    InvalidRemainingAccount,
    #[msg("Winner must be YES (1) or NO (2)")]
    InvalidWinner,
    #[msg("Provided order ID does not match next_order_id")]
    InvalidOrderId,
}
