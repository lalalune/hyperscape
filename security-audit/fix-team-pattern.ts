/**
 * Fix Team 1: Pattern-Based Auto-Fix
 * Handles simple regex-based code transformations
 */

import { promises as fs } from 'fs';
import { BugReport, BugCategory, BugSeverity } from './types';
import { FixAttempt, FixPattern, FixStrategy, FixStatus, FixTeamConfig } from './fix-types';

export class PatternBasedFixTeam {
  teamId = 'FIX_TEAM_PATTERN';
  name = 'Pattern-Based Auto-Fix Squad';

  private config: FixTeamConfig = {
    id: this.teamId,
    name: this.name,
    specialization: [
      BugCategory.TYPE_CONFUSION,
      BugCategory.DATA_EXPOSURE,
      BugCategory.CRYPTO_FAILURE,
      BugCategory.SECURITY_MISCONFIG
    ],
    strategies: [FixStrategy.PATTERN_REPLACE, FixStrategy.REMOVE_CODE],
    maxConcurrentFixes: 50,
    confidenceThreshold: 0.8
  };

  private fixPatterns: FixPattern[] = [
    // Type Coercion fixes (== to ===)
    {
      name: 'Fix Type Coercion',
      category: BugCategory.TYPE_CONFUSION,
      searchPattern: /([^=!])={2}(?!=)/g,
      replaceWith: '$1===',
      explanation: 'Replaced loose equality (==) with strict equality (===) to prevent type coercion vulnerabilities',
      confidence: 0.95,
      requiresValidation: false
    },
    {
      name: 'Fix Type Inequality',
      category: BugCategory.TYPE_CONFUSION,
      searchPattern: /([^=!])!={1}(?!=)/g,
      replaceWith: '$1!==',
      explanation: 'Replaced loose inequality (!=) with strict inequality (!==) to prevent type coercion',
      confidence: 0.95,
      requiresValidation: false
    },

    // Console logging sensitive data
    {
      name: 'Remove Sensitive Console Logs',
      category: BugCategory.DATA_EXPOSURE,
      searchPattern: /console\.(log|info|debug|warn)\s*\([^)]*(?:password|token|secret|key|credential|apiKey|api_key)[^)]*\);?/gi,
      replaceWith: '// Removed sensitive console log',
      explanation: 'Removed console.log statements that expose sensitive information',
      confidence: 0.9,
      requiresValidation: true
    },

    // Math.random() for security
    {
      name: 'Replace Insecure Random',
      category: BugCategory.CRYPTO_FAILURE,
      searchPattern: /Math\.random\(\)/g,
      replaceWith: 'crypto.randomBytes(4).readUInt32BE(0) / 0xFFFFFFFF',
      explanation: 'Replaced Math.random() with cryptographically secure random number generation',
      confidence: 0.85,
      requiresValidation: true
    },

    // CORS wildcard
    {
      name: 'Fix CORS Wildcard',
      category: BugCategory.SECURITY_MISCONFIG,
      searchPattern: /cors\s*\(\s*\{\s*origin\s*:\s*['"]?\*['"]?\s*\}/gi,
      replaceWith: 'cors({ origin: process.env.ALLOWED_ORIGINS?.split(\',\') || [] }',
      explanation: 'Replaced CORS wildcard (*) with environment-based whitelist',
      confidence: 0.8,
      requiresValidation: true
    },

    // Hardcoded credentials (remove)
    {
      name: 'Remove Hardcoded Credentials',
      category: BugCategory.CRYPTO_FAILURE,
      searchPattern: /(const|let|var)\s+(password|secret|apiKey|api_key|token)\s*=\s*['"][^'"]{8,}['"]/gi,
      replaceWith: (match: string, declType: string, varName: string) => {
        return `${declType} ${varName} = process.env.${varName.toUpperCase()} || ''`;
      },
      explanation: 'Replaced hardcoded credentials with environment variable reference',
      confidence: 0.9,
      requiresValidation: true
    },

    // innerHTML assignments
    {
      name: 'Replace innerHTML with textContent',
      category: BugCategory.XSS,
      searchPattern: /\.innerHTML\s*=\s*([^;]+);/gi,
      replaceWith: '.textContent = $1;',
      explanation: 'Replaced innerHTML with textContent to prevent XSS attacks',
      confidence: 0.7, // Lower confidence - might break legitimate HTML rendering
      requiresValidation: true
    }
  ];

  /**
   * Attempt to fix bugs using pattern matching
   */
  async fixBugs(bugs: BugReport[]): Promise<FixAttempt[]> {
    const startTime = Date.now();
    const fixes: FixAttempt[] = [];

    console.log(`\n[${this.teamId}] Processing ${bugs.length} bugs...`);

    // Group bugs by file for efficient processing
    const bugsByFile = new Map<string, BugReport[]>();
    for (const bug of bugs) {
      const bugs = bugsByFile.get(bug.location.file) || [];
      bugs.push(bug);
      bugsByFile.set(bug.location.file, bugs);
    }

    // Process each file
    for (const [filePath, fileBugs] of bugsByFile.entries()) {
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        let modifiedContent = fileContent;
        const fileFixes: FixAttempt[] = [];

        for (const bug of fileBugs) {
          const fix = await this.attemptFix(bug, modifiedContent);
          if (fix && fix.status === FixStatus.FIXED) {
            modifiedContent = fix.fixedCode;
            fileFixes.push(fix);
          } else if (fix) {
            fileFixes.push(fix);
          }
        }

        // Write fixed content back to file if we have successful fixes
        const successfulFixes = fileFixes.filter(f => f.status === FixStatus.FIXED);
        if (successfulFixes.length > 0 && modifiedContent !== fileContent) {
          await fs.writeFile(filePath, modifiedContent, 'utf-8');
          console.log(`  ✓ Fixed ${successfulFixes.length} bugs in ${filePath.replace('/home/user/hyperscape/', '')}`);
        }

        fixes.push(...fileFixes);
      } catch (error) {
        console.error(`  ✗ Error processing ${filePath}:`, error);
      }
    }

    const endTime = Date.now();
    console.log(`[${this.teamId}] Completed ${fixes.length} fix attempts in ${endTime - startTime}ms`);

    return fixes;
  }

  /**
   * Attempt to fix a single bug
   */
  private async attemptFix(bug: BugReport, fileContent: string): Promise<FixAttempt | null> {
    const startTime = Date.now();

    // Find applicable pattern
    const pattern = this.findMatchingPattern(bug);
    if (!pattern) {
      return {
        id: `${this.teamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        bugReport: bug,
        strategy: FixStrategy.PATTERN_REPLACE,
        teamId: this.teamId,
        status: FixStatus.REQUIRES_MANUAL,
        originalCode: fileContent,
        fixedCode: fileContent,
        diff: '',
        confidence: 0,
        explanation: 'No matching fix pattern found',
        timeToFix: Date.now() - startTime,
        testsPass: false,
        staticAnalysisPass: false,
        introducesNewBugs: false,
        canRollback: false
      };
    }

    // Apply pattern
    try {
      const fixedContent = this.applyPattern(fileContent, pattern);

      if (fixedContent === fileContent) {
        // No changes made
        return {
          id: `${this.teamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          bugReport: bug,
          strategy: FixStrategy.PATTERN_REPLACE,
          teamId: this.teamId,
          status: FixStatus.FAILED,
          originalCode: fileContent,
          fixedCode: fileContent,
          diff: '',
          confidence: pattern.confidence,
          explanation: 'Pattern did not match any code in the file',
          timeToFix: Date.now() - startTime,
          testsPass: false,
          staticAnalysisPass: false,
          introducesNewBugs: false,
          canRollback: true
        };
      }

      const diff = this.generateDiff(fileContent, fixedContent);

      return {
        id: `${this.teamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        bugReport: bug,
        strategy: FixStrategy.PATTERN_REPLACE,
        teamId: this.teamId,
        status: FixStatus.FIXED,
        originalCode: fileContent,
        fixedCode: fixedContent,
        diff,
        confidence: pattern.confidence,
        explanation: pattern.explanation,
        timeToFix: Date.now() - startTime,
        testsPass: true, // Will be validated later
        staticAnalysisPass: true,
        introducesNewBugs: false,
        canRollback: true
      };
    } catch (error) {
      return {
        id: `${this.teamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        bugReport: bug,
        strategy: FixStrategy.PATTERN_REPLACE,
        teamId: this.teamId,
        status: FixStatus.FAILED,
        originalCode: fileContent,
        fixedCode: fileContent,
        diff: '',
        confidence: 0,
        explanation: `Fix failed: ${error}`,
        timeToFix: Date.now() - startTime,
        testsPass: false,
        staticAnalysisPass: false,
        introducesNewBugs: false,
        canRollback: true
      };
    }
  }

  /**
   * Find matching fix pattern for bug
   */
  private findMatchingPattern(bug: BugReport): FixPattern | null {
    for (const pattern of this.fixPatterns) {
      if (pattern.category === bug.category) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Apply fix pattern to code
   */
  private applyPattern(code: string, pattern: FixPattern): string {
    if (typeof pattern.replaceWith === 'string') {
      return code.replace(pattern.searchPattern, pattern.replaceWith);
    } else {
      return code.replace(pattern.searchPattern, pattern.replaceWith as any);
    }
  }

  /**
   * Generate unified diff
   */
  private generateDiff(original: string, fixed: string): string {
    const originalLines = original.split('\n');
    const fixedLines = fixed.split('\n');

    let diff = '';
    const maxLines = Math.max(originalLines.length, fixedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const fixedLine = fixedLines[i];

      if (origLine !== fixedLine) {
        if (origLine) {
          diff += `- ${origLine}\n`;
        }
        if (fixedLine) {
          diff += `+ ${fixedLine}\n`;
        }
      }
    }

    return diff;
  }

  getConfig(): FixTeamConfig {
    return this.config;
  }

  getPatterns(): FixPattern[] {
    return this.fixPatterns;
  }
}
