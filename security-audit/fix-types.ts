/**
 * Auto-Fix Framework - Type Definitions
 * Automated vulnerability remediation system
 */

import { BugReport, BugCategory, BugSeverity } from './types';

export enum FixStrategy {
  PATTERN_REPLACE = 'PATTERN_REPLACE',
  AST_REFACTOR = 'AST_REFACTOR',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  WRAP_WITH_VALIDATION = 'WRAP_WITH_VALIDATION',
  ADD_SANITIZATION = 'ADD_SANITIZATION',
  REMOVE_CODE = 'REMOVE_CODE',
  REPLACE_API = 'REPLACE_API'
}

export enum FixStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  FIXED = 'FIXED',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
  REQUIRES_MANUAL = 'REQUIRES_MANUAL',
  ROLLED_BACK = 'ROLLED_BACK'
}

export interface FixAttempt {
  id: string;
  bugReport: BugReport;
  strategy: FixStrategy;
  teamId: string;
  status: FixStatus;

  // Fix details
  originalCode: string;
  fixedCode: string;
  diff: string;

  // Metadata
  confidence: number; // 0-1 score
  explanation: string;
  timeToFix: number; // milliseconds

  // Validation
  testsPass: boolean;
  staticAnalysisPass: boolean;
  introducesNewBugs: boolean;

  // Rollback
  canRollback: boolean;
  rollbackReason?: string;
}

export interface FileFix {
  filePath: string;
  originalContent: string;
  fixedContent: string;
  fixes: FixAttempt[];
  totalChanges: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface FixBatch {
  id: string;
  category: BugCategory;
  severity: BugSeverity;
  fixes: FixAttempt[];
  status: FixStatus;
  estimatedRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FixTeamConfig {
  id: string;
  name: string;
  specialization: BugCategory[];
  strategies: FixStrategy[];
  maxConcurrentFixes: number;
  confidenceThreshold: number; // Only apply fixes above this confidence
}

export interface FixTeamPerformance {
  teamId: string;
  totalAttempts: number;
  successfulFixes: number;
  failedFixes: number;
  averageConfidence: number;
  averageTimeToFix: number;
  testsPassedRate: number;
  rollbackRate: number;
}

export interface ValidationResult {
  passed: boolean;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  newBugsIntroduced: BugReport[];
  staticAnalysisErrors: string[];
  performanceImpact?: {
    before: number;
    after: number;
    percentChange: number;
  };
}

export interface FixReport {
  timestamp: number;
  totalBugsFixed: number;
  totalBugsFailed: number;
  totalBugsManual: number;

  byTeam: Map<string, FixTeamPerformance>;
  bySeverity: Map<BugSeverity, number>;
  byCategory: Map<BugCategory, number>;

  filesModified: FileFix[];
  validationResults: ValidationResult;

  prDetails: {
    title: string;
    description: string;
    branch: string;
    commitSha?: string;
  };
}

/**
 * Pattern-based fix rule
 */
export interface FixPattern {
  name: string;
  category: BugCategory;
  searchPattern: RegExp;
  replaceWith: string | ((match: string, ...groups: string[]) => string);
  explanation: string;
  confidence: number;
  requiresValidation: boolean;
}

/**
 * AST-based fix rule
 */
export interface ASTFixRule {
  name: string;
  category: BugCategory;
  nodeType: string; // e.g., 'BinaryExpression', 'CallExpression'
  condition: (node: any) => boolean;
  transform: (node: any, code: string) => string;
  explanation: string;
  confidence: number;
}
