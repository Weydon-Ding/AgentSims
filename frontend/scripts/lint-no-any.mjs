#!/usr/bin/env node
/**
 * Lint script: Detect unallowed 'any' types in TypeScript source files.
 * 
 * Allowed patterns:
 * - Comments containing "allow:any" or "ALLOW:any"
 * - Type definitions in node_modules (excluded by glob)
 * 
 * Fails if any unallowed 'any' is found.
 */

import { glob } from 'glob';
import { readFile } from 'fs/promises';
import { resolve, relative } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PATTERN = 'src/**/*.{ts,tsx}';

// Patterns that indicate allowed 'any' usage
const ALLOWED_PATTERNS = [
  /\/\/\s*allow:any/i,
  /\/\/\s*ALLOW:any/i,
  /\/\*\s*allow:any\s*\*\//i,
];

async function checkFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check if this line contains 'any' as a type (not in comments or strings)
    // Simple heuristic: look for ': any' or '<any>' or 'as any'
    const anyMatches = [
      ...line.matchAll(/:\s*any\b/g),
      ...line.matchAll(/<\s*any\s*>/g),
      ...line.matchAll(/\bas\s+any\b/g),
    ];

    if (anyMatches.length === 0) {
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
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
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
    console.error(`Found ${totalViolations} unallowed 'any' type(s):\n`);
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    ${v.content}`);
    }
    console.error('\nFix: Replace `any` with proper types, or add "// allow:any" comment if justified.');
    process.exit(1);
  } else {
    console.log('No unallowed `any` types found.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
