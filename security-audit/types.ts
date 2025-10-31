/**
 * Bug Hunting Simulation - Type Definitions
 * Competitive multi-agent security testing framework
 */

export enum BugSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum BugCategory {
  INJECTION = 'Injection',
  XSS = 'Cross-Site Scripting',
  AUTH_BYPASS = 'Authentication Bypass',
  AUTHZ_FAILURE = 'Authorization Failure',
  DATA_EXPOSURE = 'Sensitive Data Exposure',
  BROKEN_ACCESS = 'Broken Access Control',
  SECURITY_MISCONFIG = 'Security Misconfiguration',
  CRYPTO_FAILURE = 'Cryptographic Failure',
  INSECURE_DESIGN = 'Insecure Design',
  VULN_COMPONENTS = 'Vulnerable Components',
  LOGGING_FAILURE = 'Logging and Monitoring Failure',
  SSRF = 'Server-Side Request Forgery',
  TYPE_CONFUSION = 'Type Confusion',
  RACE_CONDITION = 'Race Condition',
  LOGIC_FLAW = 'Logic Flaw',
  DOS = 'Denial of Service',
  MEMORY_CORRUPTION = 'Memory Corruption',
  INFORMATION_LEAK = 'Information Leakage'
}

export interface CVSSScore {
  baseScore: number; // 0-10
  attackVector: 'NETWORK' | 'ADJACENT' | 'LOCAL' | 'PHYSICAL';
  attackComplexity: 'LOW' | 'HIGH';
  privilegesRequired: 'NONE' | 'LOW' | 'HIGH';
  userInteraction: 'NONE' | 'REQUIRED';
  scope: 'UNCHANGED' | 'CHANGED';
  confidentialityImpact: 'NONE' | 'LOW' | 'HIGH';
  integrityImpact: 'NONE' | 'LOW' | 'HIGH';
  availabilityImpact: 'NONE' | 'LOW' | 'HIGH';
  exploitability: number; // 0-10
}

export interface BugReport {
  id: string;
  teamId: string;
  title: string;
  description: string;
  category: BugCategory;
  severity: BugSeverity;
  cvssScore: CVSSScore;
  location: {
    file: string;
    lines: number[];
    snippet: string;
  };
  exploitScenario: string;
  proofOfConcept?: string;
  remediation: string;
  references: string[];
  discoveryMethod: string;
  timeToDiscover: number; // milliseconds
  isValid: boolean;
  isFalsePositive: boolean;
  isUnique: boolean;
  bountyValue: number;
}

export interface TeamStrategy {
  focusAreas: BugCategory[];
  searchPatterns: string[];
  scanDepth: 'SHALLOW' | 'MEDIUM' | 'DEEP';
  priorityFiles: string[];
  learningRate: number;
  explorationRate: number; // For reinforcement learning
}

export interface TeamPerformance {
  teamId: string;
  roundsCompleted: number;
  bugsFound: number;
  validBugs: number;
  falsePositives: number;
  criticalBugs: number;
  highBugs: number;
  mediumBugs: number;
  lowBugs: number;
  totalBountyValue: number;
  averageTimeToDiscover: number;
  falsePositiveRate: number;
  uniqueBugsFound: number;
  cvssAverage: number;
  strategyEvolution: TeamStrategy[];
}

export interface SimulationRound {
  roundNumber: number;
  timestamp: number;
  targetFiles: string[];
  teamsReports: Map<string, BugReport[]>;
  scores: Map<string, number>;
  duration: number;
}

export interface TeamConfig {
  id: string;
  name: string;
  methodology: 'AUTOMATED' | 'MANUAL' | 'FUZZING';
  description: string;
  initialStrategy: TeamStrategy;
}

export interface ReinforcementLearningState {
  successfulPatterns: Map<string, number>;
  unsuccessfulPatterns: Map<string, number>;
  rewardHistory: number[];
  strategyAdjustments: number;
}
