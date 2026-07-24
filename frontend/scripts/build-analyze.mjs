#!/usr/bin/env node
/**
 * Build analyze script:
 * 1. Runs production build
 * 2. Analyzes bundle size
 * 3. Fails if initial JS gzip size exceeds 1.5 MB
 * 
 * Outputs bundle stats to test-results/bundle-stats.json
 */

import { execSync } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve, relative } from 'path';
import { existsSync } from 'fs';
import { gzipSize } from 'gzip-size';

const ROOT = resolve(import.meta.dirname, '..');
const DIST_DIR = resolve(ROOT, 'dist');
const RESULTS_DIR = resolve(ROOT, 'test-results');
const MAX_SIZE_MB = 1.5;

async function getBundleSize() {
  // Find all JS files in dist/assets
  const assetsDir = resolve(DIST_DIR, 'assets');
  if (!existsSync(assetsDir)) {
    throw new Error('dist/assets directory not found - run build first');
  }

  const { readdir } = await import('fs/promises');
  const files = await readdir(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));

  let totalSize = 0;
  const fileSizes = [];

  for (const file of jsFiles) {
    const filePath = resolve(assetsDir, file);
    const content = await readFile(filePath);
    const size = await gzipSize(content);
    totalSize += size;
    fileSizes.push({
      file,
      gzipSize: size,
      sizeKB: (size / 1024).toFixed(2),
    });
  }

  return { totalSize, fileSizes };
}

async function main() {
  console.log('Building for production...\n');

  try {
    // Run build
    execSync('npm run build', {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('Build failed!');
    process.exit(1);
  }

  console.log('\nAnalyzing bundle size...\n');

  // Ensure results directory exists
  await mkdir(RESULTS_DIR, { recursive: true });

  try {
    const { totalSize, fileSizes } = await getBundleSize();
    const totalSizeMB = totalSize / (1024 * 1024);

    const report = {
      timestamp: new Date().toISOString(),
      totalGzipSizeMB: Number(totalSizeMB.toFixed(3)),
      maxSizeMB: MAX_SIZE_MB,
      passed: totalSizeMB <= MAX_SIZE_MB,
      files: fileSizes,
    };

    // Write JSON report
    await writeFile(
      resolve(RESULTS_DIR, 'bundle-stats.json'),
      JSON.stringify(report, null, 2)
    );

    // Print summary
    console.log('Bundle Size Report:');
    console.log('===================');
    console.log(`Total gzip size: ${totalSizeMB.toFixed(3)} MB`);
    console.log(`Max allowed:     ${MAX_SIZE_MB} MB`);
    console.log(`Status:          ${report.passed ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log('\nFiles:');
    for (const f of fileSizes) {
      console.log(`  ${f.file}: ${f.sizeKB} KB (gzip)`);
    }

    if (!report.passed) {
      console.error(
        `\nERROR: Bundle size (${totalSizeMB.toFixed(3)} MB) exceeds limit (${MAX_SIZE_MB} MB)`
      );
      console.error('Consider code splitting, lazy loading, or removing dependencies.');
      process.exit(1);
    }

    console.log('\nBundle analysis complete. Report saved to test-results/bundle-stats.json');
    process.exit(0);
  } catch (err) {
    console.error('Error analyzing bundle:', err.message);
    process.exit(1);
  }
}

main();
