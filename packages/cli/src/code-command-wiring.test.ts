import { describe, expect, it } from 'vitest';
import { buildOracleCommands, REPO_BASE_REF } from './code-command-wiring.js';

describe('buildOracleCommands', () => {
  it("joins each branch's file paths into the solidPreflight scope flags", () => {
    const commands = buildOracleCommands({
      coreLogicSpec: [
        { path: 'src/a.ts', kind: 'NEW' },
        { path: 'src/b.ts', kind: 'MODIFY' },
      ],
      testAndBoilerplateSpec: [{ path: 'src/a.test.ts', kind: 'NEW' }],
    });

    expect(commands.solidPreflight).toBe(
      `python3 scripts/verify-solid-contracts.py --target . --base ${REPO_BASE_REF} --scope-a "src/a.ts,src/b.ts" --scope-b "src/a.test.ts"`,
    );
    expect(commands.formatCheck).toBe('npx prettier --check .');
    expect(commands.buildAndLint).toBe('npx tsc --noEmit && npx eslint . --max-warnings 0');
    expect(commands.testRun).toBe('npm test');
  });

  it('produces empty scope flags for an empty manifest', () => {
    const commands = buildOracleCommands({ coreLogicSpec: [], testAndBoilerplateSpec: [] });

    expect(commands.solidPreflight).toContain('--scope-a ""');
    expect(commands.solidPreflight).toContain('--scope-b ""');
  });
});
