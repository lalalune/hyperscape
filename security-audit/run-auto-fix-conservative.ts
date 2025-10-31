#!/usr/bin/env tsx
/**
 * Conservative Auto-Fix Runner
 * Only applies high-confidence, low-risk fixes and validates incrementally
 */

import { promises as fs } from 'fs';
import { PatternBasedFixTeam } from './fix-team-pattern';
import { AutomatedScanningTeam } from './team-automated';
import { BugCategory, BugSeverity } from './types';
import { FixAttempt, FixStatus } from './fix-types';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('\n🔧 CONSERVATIVE AUTO-FIX - High Confidence Fixes Only\n');

  // Scan for vulnerabilities
  console.log('📡 Scanning for vulnerabilities...\n');

  const scanner = new AutomatedScanningTeam({
    focusAreas: [BugCategory.TYPE_CONFUSION],
    searchPatterns: ['**/src/**/*.ts'],
    scanDepth: 'MEDIUM',
    priorityFiles: [],
    learningRate: 0.1,
    explorationRate: 0.3
  });

  const files = await glob('/home/user/hyperscape/packages/*/src/**/*.ts', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts']
  });

  console.log(`📁 Scanning ${files.length} files for type coercion issues...\n`);

  const bugs = await scanner.scanFiles(files.slice(0, 20)); // Start with just 20 files
  const typeCoercionBugs = bugs.filter(
    b => b.isValid &&
    !b.isFalsePositive &&
    b.title === 'Type Coercion' &&
    b.severity === BugSeverity.LOW
  );

  console.log(`✓ Found ${typeCoercionBugs.length} type coercion issues\n`);

  if (typeCoercionBugs.length === 0) {
    console.log('No type coercion issues found. Exiting.');
    return;
  }

  // Apply fixes file by file with validation
  const patternTeam = new PatternBasedFixTeam();
  const successfulFixes: FixAttempt[] = [];
  const failedFiles: string[] = [];

  // Group by file
  const bugsByFile = new Map<string, typeof typeCoercionBugs>();
  for (const bug of typeCoercionBugs) {
    const fileBugs = bugsByFile.get(bug.location.file) || [];
    fileBugs.push(bug);
    bugsByFile.set(bug.location.file, fileBugs);
  }

  console.log(`📝 Processing ${bugsByFile.size} files incrementally...\n`);

  for (const [filePath, fileBugs] of bugsByFile.entries()) {
    const shortPath = filePath.replace('/home/user/hyperscape/', '');
    console.log(`\n  Fixing ${shortPath} (${fileBugs.length} issues)...`);

    try {
      // Read original content
      const originalContent = await fs.readFile(filePath, 'utf-8');

      // Apply fixes
      const fixes = await patternTeam.fixBugs(fileBugs);
      const successfulFileFixes = fixes.filter(f => f.status === FixStatus.FIXED);

      if (successfulFileFixes.length === 0) {
        console.log(`    ⚠ No fixes could be applied`);
        continue;
      }

      // Check if TypeScript still compiles
      console.log(`    🧪 Validating...`);
      try {
        await execAsync('npx tsc --noEmit', {
          cwd: '/home/user/hyperscape',
          timeout: 15000
        });

        // Success! Keep the changes
        successfulFixes.push(...successfulFileFixes);
        console.log(`    ✓ Fixed ${successfulFileFixes.length} issues (TypeScript compilation passed)`);
      } catch (error) {
        // TypeScript failed - rollback
        await fs.writeFile(filePath, originalContent, 'utf-8');
        failedFiles.push(shortPath);
        console.log(`    ✗ Rolled back (TypeScript compilation failed)`);
      }
    } catch (error) {
      console.error(`    ✗ Error processing file:`, error);
      failedFiles.push(shortPath);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 CONSERVATIVE AUTO-FIX SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n✅ Successfully Fixed: ${successfulFixes.length}`);
  console.log(`❌ Failed/Rolled Back: ${typeCoercionBugs.length - successfulFixes.length}`);
  console.log(`📁 Files Modified: ${bugsByFile.size - failedFiles.length}`);
  console.log(`📁 Files Rolled Back: ${failedFiles.length}`);

  if (successfulFixes.length > 0) {
    const totalBountyFixed = successfulFixes.reduce((sum, f) => sum + f.bugReport.bountyValue, 0);
    console.log(`\n💰 Bug Bounty Value Fixed: $${totalBountyFixed.toLocaleString()}`);

    console.log('\n📋 Next Steps:\n');
    console.log('1. Review changes with: git diff');
    console.log('2. Run tests to ensure nothing broke');
    console.log('3. Commit changes: git add . && git commit -m "fix: apply type coercion fixes"');
    console.log('4. Push to remote: git push origin HEAD');
  } else {
    console.log('\n⚠ No fixes could be safely applied.');
    console.log('Consider reviewing the failed files manually.');
  }

  if (failedFiles.length > 0) {
    console.log('\n⚠️ Files that failed validation:');
    failedFiles.forEach(file => console.log(`  - ${file}`));
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Auto-fix failed:', error);
  process.exit(1);
});
