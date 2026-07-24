#!/usr/bin/env node
/**
 * Lint script: Detect console.log in production source files.
 * 
 * Allowed patterns:
 * - Test files (*.test.ts, *.spec.ts)
 * - Files with "// allow:console" comment
 * - __tests__ directory
 * 
 * Fails if any unallowed console.log is found.
 */

import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { resolve, relative } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PATTERN = 'src/**/*.{ts,tsx}';

// Patterns that indicate allowed console usage
const ALLOWED_PATTERNS = [
  /\/\/\s*allow:console/i,
  /\/\/\s*ALLOW:console/i,
];

async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for console.log, console.warn, console.error, console.info, console.debug
    const consoleMatches = [
      ...line.matchAll(/console\.(log|warn|error|info|debug)\s*\(/g),
    ];

    if (consoleMatches.length === 0) {
      continue;
    }

    // Check if this line has an allowed pattern
    const isAllowed = ALLOWED_PATTERNS.some((pattern) => pattern.test(line));

    if (!isAllowed) {
      violations.push({
        line: lineNum,
        content: line.trim(),
        file: relative(ROOT, filePath),
      });
    }
  }

  return violations;
}

async function main() {
  const files = await glob(PATTERN, {
    cwd: ROOT,
    absolute: true,
    ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
  });

  let totalViolations = 0;
  const allViolations = [];

  for (const file of files) {
    const violations = await checkFile(file);
    if (violations.length > 0) {
      totalViolations += violations.length;
      allViolations.push(...violations);
    }
  }

  if (totalViolations > 0) {
    console.error(`Found ${totalViolations} unallowed console.log statement(s):\n`);
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.content}`);
    }
    console.error('\nFix: Remove console.log for production code, or add "// allow:console" if justified.');
    process.exit(1);
  } else {
    console.log('No unallowed console.log statements found.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
