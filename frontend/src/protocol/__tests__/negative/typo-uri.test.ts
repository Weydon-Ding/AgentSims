import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('协议 URI 负向类型检查', () => {
  it('Given 拼写错误的 URI 夹具 When 使用真实 tsc 编译 Then 编译以类型错误失败', () => {
    const root = resolve(process.cwd());
    const fixture = resolve(root, 'test-fixtures/negative/typo-uri.fixture.ts');
    const result = spawnSync(
      `npx tsc --noEmit --strict --target ES2020 --module ESNext --moduleResolution bundler --skipLibCheck "${fixture}"`,
      { cwd: root, shell: true, encoding: 'utf8' }
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/not assignable|TS2322|TS2820/);
  });
});
