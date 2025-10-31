/**
 * Team 1: Automated Scanning & Pattern Recognition
 * Uses regex patterns, AST analysis, and automated vulnerability detection
 */

import { promises as fs } from 'fs';
import path from 'path';
import { BugReport, BugCategory, BugSeverity, TeamStrategy } from './types';
import { CVSSCalculator } from './cvss-calculator';

export class AutomatedScanningTeam {
  teamId = 'TEAM_AUTOMATED';
  name = 'Pattern Recognition Squad';
  private strategy: TeamStrategy;
  private discoveredBugs: BugReport[] = [];

  // Security vulnerability patterns
  private readonly VULNERABILITY_PATTERNS = [
    {
      name: 'SQL Injection',
      pattern: /\.query\s*\(\s*[`'"]\s*SELECT.*?\$\{.*?\}/gi,
      category: BugCategory.INJECTION,
      severity: BugSeverity.CRITICAL,
    },
    {
      name: 'Command Injection',
      pattern: /exec\s*\(\s*[`'"].*?\$\{.*?\}|spawn\s*\(\s*[^,]+,\s*\[.*?\$\{/gi,
      category: BugCategory.INJECTION,
      severity: BugSeverity.CRITICAL,
    },
    {
      name: 'Hardcoded Credentials',
      pattern: /(password|secret|api[_-]?key|token)\s*[:=]\s*[`'"][^`'"]{8,}[`'"]/gi,
      category: BugCategory.CRYPTO_FAILURE,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'Unsafe Eval',
      pattern: /eval\s*\(|Function\s*\(.*?\)\s*\(/gi,
      category: BugCategory.INJECTION,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'Insecure Random',
      pattern: /Math\.random\s*\(\s*\)/gi,
      category: BugCategory.CRYPTO_FAILURE,
      severity: BugSeverity.MEDIUM,
    },
    {
      name: 'Missing Input Validation',
      pattern: /(req\.body|req\.query|req\.params)\.[\w]+(?!.*(?:validate|sanitize|check))/gi,
      category: BugCategory.BROKEN_ACCESS,
      severity: BugSeverity.MEDIUM,
    },
    {
      name: 'Type Coercion',
      pattern: /==(?!=)|!=(?!=)/g,
      category: BugCategory.TYPE_CONFUSION,
      severity: BugSeverity.LOW,
    },
    {
      name: 'Unvalidated Redirect',
      pattern: /redirect\s*\(\s*(?:req\.|window\.|location\.)/gi,
      category: BugCategory.BROKEN_ACCESS,
      severity: BugSeverity.MEDIUM,
    },
    {
      name: 'Console Logging Sensitive Data',
      pattern: /console\.(log|info|debug)\s*\(.*?(password|token|secret|key|credential)/gi,
      category: BugCategory.DATA_EXPOSURE,
      severity: BugSeverity.MEDIUM,
    },
    {
      name: 'Missing Error Handling',
      pattern: /async\s+function.*?\{(?:(?!catch|try).)*?\}/gs,
      category: BugCategory.LOGGING_FAILURE,
      severity: BugSeverity.LOW,
    },
    {
      name: 'Dangerous innerHTML',
      pattern: /\.innerHTML\s*=|\.outerHTML\s*=/gi,
      category: BugCategory.XSS,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'Unsafe Deserialization',
      pattern: /JSON\.parse\s*\(\s*(?:req\.|request\.|user)/gi,
      category: BugCategory.INSECURE_DESIGN,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'Missing Authentication Check',
      pattern: /(router|app)\.(get|post|put|delete)\s*\([^)]+(?!.*(?:auth|isAuthenticated|requireAuth))/gi,
      category: BugCategory.AUTH_BYPASS,
      severity: BugSeverity.CRITICAL,
    },
    {
      name: 'Path Traversal',
      pattern: /(readFile|writeFile|unlink)\s*\(.*?(?:req\.|\.\.\/)/gi,
      category: BugCategory.BROKEN_ACCESS,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'Prototype Pollution',
      pattern: /\[.*?\]\s*=|Object\.assign\s*\(\s*\{\s*\}/gi,
      category: BugCategory.INSECURE_DESIGN,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'SSRF Vulnerability',
      pattern: /(fetch|axios|request)\s*\(\s*(?:req\.|user\.|params\.)/gi,
      category: BugCategory.SSRF,
      severity: BugSeverity.HIGH,
    },
    {
      name: 'Race Condition',
      pattern: /async.*?(?:await.*?){2,}(?:.*?=.*?){2,}/gs,
      category: BugCategory.RACE_CONDITION,
      severity: BugSeverity.MEDIUM,
    },
    {
      name: 'Missing CORS Configuration',
      pattern: /cors\s*\(\s*\{?\s*origin\s*:\s*['"]\*['"]/gi,
      category: BugCategory.SECURITY_MISCONFIG,
      severity: BugSeverity.MEDIUM,
    }
  ];

  constructor(initialStrategy: TeamStrategy) {
    this.strategy = initialStrategy;
  }

  /**
   * Scan target files for vulnerabilities using pattern matching
   */
  async scanFiles(targetFiles: string[]): Promise<BugReport[]> {
    const startTime = Date.now();
    const reports: BugReport[] = [];

    for (const file of targetFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileReports = await this.scanFileContent(file, content);
        reports.push(...fileReports);
      } catch (error) {
        console.error(`[${this.teamId}] Error scanning ${file}:`, error);
      }
    }

    const endTime = Date.now();
    console.log(`[${this.teamId}] Scanned ${targetFiles.length} files in ${endTime - startTime}ms, found ${reports.length} potential issues`);

    this.discoveredBugs.push(...reports);
    return reports;
  }

  private async scanFileContent(filePath: string, content: string): Promise<BugReport[]> {
    const reports: BugReport[] = [];
    const lines = content.split('\n');

    for (const pattern of this.VULNERABILITY_PATTERNS) {
      const matches = content.matchAll(pattern.pattern);

      for (const match of matches) {
        if (!match.index) continue;

        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;

        // Extract context
        const startLine = Math.max(0, lineNumber - 2);
        const endLine = Math.min(lines.length, lineNumber + 2);
        const snippet = lines.slice(startLine, endLine).join('\n');

        const report = this.createBugReport(
          filePath,
          pattern.name,
          pattern.category,
          pattern.severity,
          lineNumber,
          snippet,
          match[0]
        );

        reports.push(report);
      }
    }

    return reports;
  }

  private createBugReport(
    file: string,
    title: string,
    category: BugCategory,
    severity: BugSeverity,
    lineNumber: number,
    snippet: string,
    matchedPattern: string
  ): BugReport {
    const cvssScore = this.estimateCVSS(severity, category);
    const bountyValue = CVSSCalculator.calculateBountyValue(cvssScore.baseScore, severity, true);

    return {
      id: `${this.teamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      teamId: this.teamId,
      title,
      description: `Detected ${title} pattern at line ${lineNumber}`,
      category,
      severity,
      cvssScore,
      location: {
        file,
        lines: [lineNumber],
        snippet
      },
      exploitScenario: this.generateExploitScenario(category, matchedPattern),
      proofOfConcept: matchedPattern,
      remediation: this.generateRemediation(category),
      references: this.getReferences(category),
      discoveryMethod: 'Automated Pattern Matching',
      timeToDiscover: 0,
      isValid: true,
      isFalsePositive: false,
      isUnique: true,
      bountyValue
    };
  }

  private estimateCVSS(severity: BugSeverity, category: BugCategory): any {
    const criticalMetrics = {
      attackVector: 'NETWORK' as const,
      attackComplexity: 'LOW' as const,
      privilegesRequired: 'NONE' as const,
      userInteraction: 'NONE' as const,
      scope: 'CHANGED' as const,
      confidentialityImpact: 'HIGH' as const,
      integrityImpact: 'HIGH' as const,
      availabilityImpact: 'HIGH' as const
    };

    const highMetrics = {
      attackVector: 'NETWORK' as const,
      attackComplexity: 'LOW' as const,
      privilegesRequired: 'LOW' as const,
      userInteraction: 'NONE' as const,
      scope: 'UNCHANGED' as const,
      confidentialityImpact: 'HIGH' as const,
      integrityImpact: 'HIGH' as const,
      availabilityImpact: 'NONE' as const
    };

    const mediumMetrics = {
      attackVector: 'NETWORK' as const,
      attackComplexity: 'LOW' as const,
      privilegesRequired: 'LOW' as const,
      userInteraction: 'REQUIRED' as const,
      scope: 'UNCHANGED' as const,
      confidentialityImpact: 'LOW' as const,
      integrityImpact: 'LOW' as const,
      availabilityImpact: 'NONE' as const
    };

    const lowMetrics = {
      attackVector: 'LOCAL' as const,
      attackComplexity: 'HIGH' as const,
      privilegesRequired: 'HIGH' as const,
      userInteraction: 'REQUIRED' as const,
      scope: 'UNCHANGED' as const,
      confidentialityImpact: 'LOW' as const,
      integrityImpact: 'NONE' as const,
      availabilityImpact: 'NONE' as const
    };

    let metrics;
    switch (severity) {
      case BugSeverity.CRITICAL:
        metrics = criticalMetrics;
        break;
      case BugSeverity.HIGH:
        metrics = highMetrics;
        break;
      case BugSeverity.MEDIUM:
        metrics = mediumMetrics;
        break;
      default:
        metrics = lowMetrics;
    }

    return CVSSCalculator.calculateBaseScore(metrics);
  }

  private generateExploitScenario(category: BugCategory, pattern: string): string {
    const scenarios: Record<string, string> = {
      [BugCategory.INJECTION]: `Attacker could inject malicious code through user input, potentially executing arbitrary commands or queries.`,
      [BugCategory.XSS]: `Attacker could inject malicious scripts that execute in victim's browser, stealing session tokens or performing actions on behalf of the user.`,
      [BugCategory.AUTH_BYPASS]: `Attacker could access protected resources without proper authentication, compromising system security.`,
      [BugCategory.CRYPTO_FAILURE]: `Weak cryptography or exposed secrets could allow attackers to decrypt sensitive data or impersonate legitimate users.`,
      [BugCategory.DATA_EXPOSURE]: `Sensitive information could be leaked to unauthorized parties through logs, error messages, or insecure storage.`,
      [BugCategory.BROKEN_ACCESS]: `Attackers could access or modify data they shouldn't have access to, violating access control policies.`,
      [BugCategory.SSRF]: `Attacker could make the server perform requests to arbitrary URLs, potentially accessing internal services.`,
      [BugCategory.RACE_CONDITION]: `Concurrent operations could lead to inconsistent state, allowing attackers to exploit timing vulnerabilities.`
    };

    return scenarios[category] || `Vulnerability could be exploited to compromise system security.`;
  }

  private generateRemediation(category: BugCategory): string {
    const remediations: Record<string, string> = {
      [BugCategory.INJECTION]: `Use parameterized queries, input validation, and proper escaping. Never concatenate user input into queries or commands.`,
      [BugCategory.XSS]: `Sanitize all user input, use Content Security Policy, and encode output properly. Use textContent instead of innerHTML.`,
      [BugCategory.AUTH_BYPASS]: `Implement proper authentication middleware, validate sessions, and enforce authentication on all protected routes.`,
      [BugCategory.CRYPTO_FAILURE]: `Use strong encryption algorithms, never hardcode secrets, use environment variables, and implement proper key management.`,
      [BugCategory.DATA_EXPOSURE]: `Remove sensitive data from logs, implement proper error handling, and use secure storage mechanisms.`,
      [BugCategory.BROKEN_ACCESS]: `Implement role-based access control, validate user permissions, and follow principle of least privilege.`,
      [BugCategory.SSRF]: `Whitelist allowed URLs, validate and sanitize input, and use DNS rebinding protection.`,
      [BugCategory.RACE_CONDITION]: `Use proper locking mechanisms, transactions, and atomic operations.`
    };

    return remediations[category] || `Follow security best practices and implement proper validation.`;
  }

  private getReferences(category: BugCategory): string[] {
    return [
      'https://owasp.org/Top10/',
      `https://cwe.mitre.org/`,
      'https://portswigger.net/web-security'
    ];
  }

  updateStrategy(newStrategy: Partial<TeamStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  getStrategy(): TeamStrategy {
    return this.strategy;
  }

  getDiscoveredBugs(): BugReport[] {
    return this.discoveredBugs;
  }
}
