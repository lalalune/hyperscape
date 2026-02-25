export interface AgentRating {
  mu: number; // perceived skill
  sigma: number; // uncertainty
  gamesPlayed: number;
}

const INITIAL_MU = 1000.0;
const INITIAL_SIGMA = 300.0;
const MIN_SIGMA = 50.0;

export function createInitialRating(): AgentRating {
  return {
    mu: INITIAL_MU,
    sigma: INITIAL_SIGMA,
    gamesPlayed: 0,
  };
}

/**
 * Updates ratings for a 1v1 match.
 * Uses a simplified Glicko/Elo approach with explicit uncertainty tracking.
 */
export function updateRatings(
  winner: AgentRating,
  loser: AgentRating,
): { winner: AgentRating; loser: AgentRating } {
  // Expected win probability for winner (standard Logistic distribution scaled by 400)
  const Q = Math.log(10) / 400;

  // Adjusted for sigma (high sigma = less confidence in the rating delta)
  const g = (sigma: number) =>
    1.0 / Math.sqrt(1.0 + (3.0 * Q * Q * sigma * sigma) / (Math.PI * Math.PI));

  const expectedWin =
    1.0 /
    (1.0 + Math.pow(10.0, (-g(loser.sigma) * (winner.mu - loser.mu)) / 400.0));
  const expectedLoss =
    1.0 /
    (1.0 + Math.pow(10.0, (-g(winner.sigma) * (loser.mu - winner.mu)) / 400.0));

  // Determine K based on uncertainty (high sigma = high K, learns faster)
  const kWinner = Math.max(32, winner.sigma * 0.5);
  const kLoser = Math.max(32, loser.sigma * 0.5);

  const newWinnerMu = winner.mu + kWinner * (1.0 - expectedWin);
  const newLoserMu = loser.mu + kLoser * (0.0 - expectedLoss);

  // Decrease sigma as more games are played
  const decayFactor = 0.95;
  const newWinnerSigma = Math.max(MIN_SIGMA, winner.sigma * decayFactor);
  const newLoserSigma = Math.max(MIN_SIGMA, loser.sigma * decayFactor);

  return {
    winner: {
      mu: newWinnerMu,
      sigma: newWinnerSigma,
      gamesPlayed: winner.gamesPlayed + 1,
    },
    loser: {
      mu: newLoserMu,
      sigma: newLoserSigma,
      gamesPlayed: loser.gamesPlayed + 1,
    },
  };
}

/**
 * Calculate the Spot Index Price for an agent's perpetual futures contract.
 * We want to penalize uncertainty so new models don't start at a high price
 * until they've proven themselves.
 *
 * Index = max(1.0, (Mu - (PenaltyMultiplier * Sigma)) / ScalingFactor)
 */
export function calculateSpotIndex(rating: AgentRating): number {
  // We use 3 standard deviations for a conservative lower bound (TrueSkill style risk-adjustment)
  const riskAdjustedSkill = rating.mu - 3.0 * rating.sigma;

  // Base scaling to map to a reasonable price index (e.g., around 10.0 or 100.0)
  // E.g., at 1000 Mu and 50 Sigma -> 1000 - 150 = 850.
  // We map 0-2000 range to a $10 - $200 price range approx.
  let price = Math.max(1.0, riskAdjustedSkill / 10.0);

  // Round to 2 decimal places for neatness
  return Math.round(price * 100) / 100;
}
