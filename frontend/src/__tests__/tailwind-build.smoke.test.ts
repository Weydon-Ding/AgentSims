import { test, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Smoke test: Verify Tailwind CSS is properly processing @tailwind directives.
 * This test fails if raw @tailwind directives appear in the build output,
 * which would indicate PostCSS/Tailwind is not configured correctly.
 */
test('Tailwind CSS build verification', () => {
  const distPath = join(process.cwd(), 'dist', 'assets');

  // Check if dist/assets exists
  expect(existsSync(distPath)).toBe(true);

  // Get all CSS files from dist/assets
  const cssFiles = readdirSync(distPath).filter((f) => f.endsWith('.css'));

  expect(cssFiles.length).toBeGreaterThan(0);

  for (const cssFile of cssFiles) {
    const cssPath = join(distPath, cssFile);
    const cssContent = readFileSync(cssPath, 'utf-8');

    // Must NOT contain raw @tailwind directives
    expect(cssContent).not.toContain('@tailwind base');
    expect(cssContent).not.toContain('@tailwind components');
    expect(cssContent).not.toContain('@tailwind utilities');

    // Must contain evidence of Tailwind processing
    // Look for Tailwind's CSS reset markers or utility classes
    const hasTailwindReset = cssContent.includes('--tw-') || cssContent.includes(':before,:after');
    const hasUtilities =
      cssContent.includes('.min-h-screen') ||
      cssContent.includes('.p-6') ||
      cssContent.includes('.text-');

    expect(hasTailwindReset || hasUtilities).toBe(true);
  }
});
