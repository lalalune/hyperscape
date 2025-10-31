/**
 * CVSS v3.1 Calculator
 * Calculates Common Vulnerability Scoring System scores
 */

import { CVSSScore, BugSeverity } from './types';

export class CVSSCalculator {
  /**
   * Calculate CVSS base score from metrics
   */
  static calculateBaseScore(metrics: Omit<CVSSScore, 'baseScore' | 'exploitability'>): CVSSScore {
    // Impact Sub-Score
    const impactScore = this.calculateImpact(
      metrics.scope,
      metrics.confidentialityImpact,
      metrics.integrityImpact,
      metrics.availabilityImpact
    );

    // Exploitability Sub-Score
    const exploitabilityScore = this.calculateExploitability(
      metrics.attackVector,
      metrics.attackComplexity,
      metrics.privilegesRequired,
      metrics.userInteraction,
      metrics.scope
    );

    // Base Score
    let baseScore: number;
    if (impactScore <= 0) {
      baseScore = 0;
    } else if (metrics.scope === 'UNCHANGED') {
      baseScore = Math.min(10, impactScore + exploitabilityScore);
    } else {
      baseScore = Math.min(10, 1.08 * (impactScore + exploitabilityScore));
    }

    // Round to 1 decimal place
    baseScore = Math.round(baseScore * 10) / 10;

    return {
      ...metrics,
      baseScore,
      exploitability: exploitabilityScore
    };
  }

  private static calculateImpact(
    scope: 'UNCHANGED' | 'CHANGED',
    confidentiality: 'NONE' | 'LOW' | 'HIGH',
    integrity: 'NONE' | 'LOW' | 'HIGH',
    availability: 'NONE' | 'LOW' | 'HIGH'
  ): number {
    const impactValues = { NONE: 0, LOW: 0.22, HIGH: 0.56 };

    const isc = 1 - (
      (1 - impactValues[confidentiality]) *
      (1 - impactValues[integrity]) *
      (1 - impactValues[availability])
    );

    if (scope === 'UNCHANGED') {
      return 6.42 * isc;
    } else {
      return 7.52 * (isc - 0.029) - 3.25 * Math.pow(isc - 0.02, 15);
    }
  }

  private static calculateExploitability(
    attackVector: 'NETWORK' | 'ADJACENT' | 'LOCAL' | 'PHYSICAL',
    attackComplexity: 'LOW' | 'HIGH',
    privilegesRequired: 'NONE' | 'LOW' | 'HIGH',
    userInteraction: 'NONE' | 'REQUIRED',
    scope: 'UNCHANGED' | 'CHANGED'
  ): number {
    const avValues = { NETWORK: 0.85, ADJACENT: 0.62, LOCAL: 0.55, PHYSICAL: 0.2 };
    const acValues = { LOW: 0.77, HIGH: 0.44 };
    const prValues = {
      UNCHANGED: { NONE: 0.85, LOW: 0.62, HIGH: 0.27 },
      CHANGED: { NONE: 0.85, LOW: 0.68, HIGH: 0.5 }
    };
    const uiValues = { NONE: 0.85, REQUIRED: 0.62 };

    return 8.22 *
      avValues[attackVector] *
      acValues[attackComplexity] *
      prValues[scope][privilegesRequired] *
      uiValues[userInteraction];
  }

  /**
   * Convert CVSS score to severity rating
   */
  static scoreToSeverity(score: number): BugSeverity {
    if (score >= 9.0) return BugSeverity.CRITICAL;
    if (score >= 7.0) return BugSeverity.HIGH;
    if (score >= 4.0) return BugSeverity.MEDIUM;
    if (score >= 0.1) return BugSeverity.LOW;
    return BugSeverity.INFO;
  }

  /**
   * Calculate bug bounty value based on CVSS score and category
   */
  static calculateBountyValue(cvssScore: number, severity: BugSeverity, isUnique: boolean): number {
    const baseValues = {
      [BugSeverity.CRITICAL]: 10000,
      [BugSeverity.HIGH]: 5000,
      [BugSeverity.MEDIUM]: 2000,
      [BugSeverity.LOW]: 500,
      [BugSeverity.INFO]: 100
    };

    let bounty = baseValues[severity];

    // Scale by CVSS score within severity range
    bounty = bounty * (cvssScore / 10);

    // Bonus for unique findings
    if (isUnique) {
      bounty = bounty * 1.5;
    }

    return Math.round(bounty);
  }
}
