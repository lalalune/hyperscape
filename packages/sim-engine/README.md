# Hyperia Duel Index + Perp Simulator

This package is a research simulator for target-state market design. It is not a proof that the currently deployed Solana perps program implements every protection modeled here.

For launch-readiness checks against the current `gold_perps_market` contract, use the chain-faithful script in `/Users/shawwalters/eliza-workspace/hyperbet/packages/hyperbet-solana/anchor/scripts/simulate-gold-perps-risk.ts`.

Important parity gaps versus the current on-chain perps program:

- no portfolio margin on-chain; current contract is isolated per market
- no partial liquidation target/buffer on-chain; current contract fully liquidates
- no ADL on-chain
- no on-chain anti-bot order/notional/imbalance throttles
- no on-chain risk-governor state machine or oracle-lag hardening
- no on-chain global/per-market dynamic OI ladder beyond the explicit cap configured in `gold_perps_market`

Self-contained simulator for:

- nonstationary duel skill/rating dynamics
- simplex index publishing with per-minute logit caps
- thin-liquidity perp clearinghouse stress (40x config, IM/MM/liquidations/insurance/ADL)
- fee-sweep analysis for MM sustainability with 50/50 fee split

## Run

From `packages/sim-engine`:

```bash
bun run simulate
```

Single scenario:

```bash
bun run simulate --scenario baseline
bun run simulate --scenario slow-growth
bun run simulate --scenario entrants
bun run simulate --scenario thin
bun run simulate --scenario fee-driven
bun run simulate --scenario hype-crash
bun run simulate --scenario hype-falloff
bun run simulate --scenario hype-runaway
bun run simulate --scenario mev
bun run simulate --scenario mev-guarded
bun run simulate --scenario mev-hardened
bun run simulate --scenario mev-oracle-lag
bun run simulate --scenario sybil-swarm
bun run simulate --scenario mev-oracle-lag-hardened
bun run simulate --scenario sybil-swarm-hardened
```

Fee sweep only:

```bash
bun run simulate --fee-sweep
```

`--fee-sweep` prints three sweeps:

- `thin-liquidity`: MM still earns spread/impact edge
- `fee-driven MM`: spread edge forced near zero so fee carry is required
- `guarded MEV`: same attack profile with dynamic risk controls enabled

JSON output:

```bash
bun run simulate --json
```

Benchmarks:

```bash
bun run benchmark
```

Adversarial fuzz (mixed MEV/sybil/oracle-lag attacks):

```bash
bun run fuzz -- --runs 120 --seed 4242
```

Typecheck:

```bash
bun run typecheck
```

Risk governor policy export:

```bash
bun run risk-policy
```

Generated artifacts:

- `packages/sim-engine/benchmark-report.md`
- `packages/sim-engine/benchmark-report.json`
- `packages/sim-engine/risk-governor-policy.md`
- `packages/sim-engine/risk-governor-policy.json`
- `packages/sim-engine/attack-fuzz-report.json`

## Core Formulas

### 1. Rating update (uncertainty-weighted)

For winner `w` and loser `l`:

- `E_w = sigmoid((mu_w - mu_l) / s)`
- `K_i = K_base * clamp(sigma_i / sigma_ref, 0.25, 2.0)`
- `mu_w <- mu_w + K_w * (1 - E_w)`
- `mu_l <- mu_l + K_l * (0 - (1 - E_w))`
- `sigma_i <- clamp(sigma_i * shrink_per_duel, sigma_floor, sigma_ceil)`
- inactivity: `sigma` increases with elapsed minutes
- patch/meta event: global `sigma += patch_sigma_shock`

### 2. Rating -> simplex index

- score per agent: `z_i = beta * (mu_i - uncertainty_penalty * sigma_i)`
- share: `p_i = exp(z_i) / sum_j exp(z_j)` (always sums to 1)
- perp underlying transform: `x_i = log(p_i / (1 - p_i))`

### 3. Epoch cap in logit space

At each publish step, move from previous score vector `z_prev` toward raw `z_raw`:

- `z(alpha) = z_prev + alpha * (z_raw - z_prev)`, `alpha in [0,1]`
- choose largest `alpha` such that:
  `max_i |logit(softmax(z(alpha))_i) - x_prev_i| <= kappa`
- solved by binary search per epoch

### 4. Perp margin + liquidation

- initial margin ratio `IM = 2.5%`
- maintenance ratio `MM = 1.75%`
- account equity: `equity = collateral + unrealized_pnl`
- account notional: `sum |position_i|`
- leverage checks are portfolio-aware across all marked markets (not only active market)
- opening orders are rejected if projected post-fill equity/notional falls below IM (includes immediate spread/impact markout + fees)
- liquidate when `equity / notional < MM`
- partial liquidation target: `MM + buffer`
- liquidation penalty: `penalty = closed_notional * 0.75%` -> insurance

If post-liquidation equity < 0:

1. insurance fund absorbs losses
2. if still shortfall and ADL enabled, haircut profitable accounts
3. residual is uncovered bad debt

### 5. MEV / toxic-flow guardrails

State machine with hysteresis:

- states: `NORMAL -> TOXIC -> STRESS`
- escalation is immediate, de-escalation obeys `minStateDurationMinutes`
- triggers use enter/exit thresholds for:
  - toxicity
  - informed flow share
  - MM drawdown ratio
  - insurance coverage ratio

When state moves above `NORMAL`, controls tighten execution:

- market toxicity exceeds threshold (`|true_price - index_price|`)
- MM drawdown ratio breaches stress trigger

Control actions:

- widen spread, reduce depth
- reduce max leverage + per-market OI caps
- add fee surcharge during protection mode
- throttle attack flow intensity
- boost MM hedge-rate while stressed

### 6. Anti-Bot Flow Controls

- per-order max quantity cap
- per-trader max orders per minute
- per-trader max admitted notional per minute
- per-market max orders/notional per minute
- per-market signed net-imbalance cap per minute
- blocked/reduced attempts tracked in `blockedByRateLimit`

### 7. Inventory-skew execution

- execution price includes an inventory-skew premium
- when a trade increases MM absolute inventory, taker pays extra slippage
- this directly penalizes one-way flow that tries to farm MM carry

### 8. Oracle-lag hardening

- regime-level `oracleLagMinutes` can delay tradable marks
- lag-aware tightening scales down leverage/OI/order/notional/imbalance caps
- lag-aware fee and spread surcharges increase during stale-mark windows

### 9. OI / onboarding controls

- global OI cap
- per-market OI cap:
  `cap_i = per_market_floor + per_market_scale * p_i`
- new listing phase applies multiplier (lower cap), and leverage ramp from listing max to mature max over stabilization window

### 10. Optional Trader Churn

- supports optional bankrupt-trader re-admission after cooldown with fresh collateral
- disabled by default in benchmark scenarios to avoid injecting external capital into baseline solvency comparisons
- respawn counts are reported in clearinghouse metrics

## Output

Simulation prints:

- duel/ranking stability stats
- entrant Day1/Day7 win-rate transition
- top share concentration
- liquidations/bankruptcies
- MM equity path
- insurance usage + uncovered bad debt
- blocked order-rate and imbalance throttles
- minimum fee (bps) passing solvency checks in thin-liquidity sweep
