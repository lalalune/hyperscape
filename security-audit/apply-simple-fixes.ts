#!/usr/bin/env tsx
/**
 * Direct Simple Fixes - Apply safe regex transformations
 * Bypasses the complex team system for straightforward fixes
 */

import { promises as fs } from 'fs';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Fix {
  name: string;
  pattern: RegExp;
  replacement: string;
  description: string;
  shouldApply: (content: string) => boolean;
}

const fixes: Fix[] = [
  {
    name: 'Type Coercion (== to ===)',
    pattern: /([^=!<>])={2}(?!=)/g,
    replacement: '$1===',
    description: 'Replace loose equality (==) with strict equality (===)',
    shouldApply: (content) => /([^=!<>])={2}(?!=)/.test(content)
  },
  {
    name: 'Type Inequality (!= to !==)',
    pattern: /([^=!<>])!={1}(?!=)/g,
    replacement: '$1!==',
    description: 'Replace loose inequality (!=) with strict inequality (!==)',
    shouldApply: (content) => /([^=!<>])!={1}(?!=)/.test(content)
  }
];

async function applyFixToFile(filePath: string, fix: Fix): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    if (!fix.shouldApply(content)) {
      return false;
    }

    const fixedContent = content.replace(fix.pattern, fix.replacement);

    if (fixedContent === content) {
      return false;
    }

    // Count changes
    const originalLines = content.split('\n');
    const fixedLines = fixedContent.split('\n');
    let changesCount = 0;

    for (let i = 0; i < originalLines.length; i++) {
      if (originalLines[i] !== fixedLines[i]) {
        changesCount++;
      }
    }

    // Apply fix
    await fs.writeFile(filePath, fixedContent, 'utf-8');

    return true;
  } catch (error) {
    console.error(`    Error: ${error}`);
    return false;
  }
}

async function main() {
  console.log('\n🔧 DIRECT SIMPLE FIXES - Applying Safe Transformations\n');

  // Get all TypeScript files
  const files = await glob('/home/user/hyperscape/packages/*/src/**/*.ts', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/security-audit/**'
    ]
  });

  console.log(`📁 Found ${files.length} TypeScript files\n`);

  // Track results
  const results = new Map<string, number>();
  const modifiedFiles: string[] = [];

  for (const fix of fixes) {
    console.log(`\n📝 Applying: ${fix.name}`);
    console.log(`   ${fix.description}\n`);

    let fixCount = 0;

    for (const filePath of files) {
      const shortPath = filePath.replace('/home/user/hyperscape/', '');
      const applied = await applyFixToFile(filePath, fix);

      if (applied) {
        fixCount++;
        if (!modifiedFiles.includes(filePath)) {
          modifiedFiles.push(filePath);
        }
        console.log(`   ✓ ${shortPath}`);
      }
    }

    results.set(fix.name, fixCount);
    console.log(`\n   Total: ${fixCount} files modified`);
  }

  // Validate TypeScript compilation
  console.log('\n🧪 Validating TypeScript compilation...');
  try {
    const { stdout, stderr } = await execAsync('npx tsc --noEmit', {
      cwd: '/home/user/hyperscape',
      timeout: 30000
    });

    console.log('✅ TypeScript compilation passed!\n');
  } catch (error: any) {
    console.log('❌ TypeScript compilation failed!\n');

    // Show first few errors
    const output = error.stdout || error.stderr || '';
    const errorLines = output.split('\n').slice(0, 10);
    console.log('First 10 errors:');
    errorLines.forEach((line: string) => {
      if (line.trim()) console.log(`  ${line}`);
    });

    console.log('\n⚠️  Rolling back all changes...\n');

    // Rollback all changes
    await execAsync('git restore packages/', {
      cwd: '/home/user/hyperscape'
    });

    console.log('✓ All changes rolled back');
    console.log('\nThe fixes broke TypeScript compilation. Manual review needed.');
    return;
  }

  // Success summary
  console.log('='.repeat(60));
  console.log('📊 FIX SUMMARY');
  console.log('='.repeat(60));

  console.log('\n✅ Fixes Applied:');
  for (const [fixName, count] of results) {
    console.log(`   ${fixName}: ${count} files`);
  }

  console.log(`\n📁 Total Files Modified: ${modifiedFiles.length}`);
  console.log('✅ TypeScript Compilation: PASSED');

  console.log('\n📋 Next Steps:\n');
  console.log('1. Review changes: git diff');
  console.log('2. Test the application');
  console.log('3. Commit: git add . && git commit -m "fix: apply safe type coercion fixes"');
  console.log('4. Push: git push origin HEAD');

  console.log('\n' + '='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Fix application failed:', error);
  process.exit(1);
});
