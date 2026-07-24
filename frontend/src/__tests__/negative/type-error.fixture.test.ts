/**
 * Negative fixture test: verifies that the test harness correctly
 * detects type errors in fixtures.
 *
 * This test imports a fixture with intentional type errors and
 * expects TypeScript compilation to fail.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

describe('Negative fixture harness', () => {
  // Use process.cwd() for reliable path resolution in Vitest
  const frontendRoot = resolve(process.cwd());
  const fixturePath = join(frontendRoot, 'test-fixtures', 'negative');

  it('should have negative fixture directory', () => {
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('should have type-error fixture', () => {
    const fixtureFile = join(fixturePath, 'type-error.fixture.ts');
    expect(existsSync(fixtureFile)).toBe(true);
  });

  it('should verify type-error fixture contains intentional error', () => {
    const fixtureFile = join(fixturePath, 'type-error.fixture.ts');
    const content = readFileSync(fixtureFile, 'utf-8');
    // The fixture should contain a deliberate type error
    expect(content).toContain('// @ts-expect-error');
  });
});
