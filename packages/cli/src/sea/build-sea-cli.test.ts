import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveSeaBuildPaths, runSeaBuild, toLipoArch } from './build-sea-cli.js';

const execFileAsync = promisify(execFile);

describe('resolveSeaBuildPaths', () => {
  it('computes the fixed on-disk layout relative to the given cliDir', () => {
    expect(resolveSeaBuildPaths('/some/cli')).toEqual({
      cliDir: '/some/cli',
      entryScriptPath: '/some/cli/dist/sea-entry.js',
      bundlePath: '/some/cli/dist/sea-bundle.cjs',
      seaConfigPath: '/some/cli/sea-config.json',
      blobPath: '/some/cli/dist/sea-blob.blob',
      outputBinaryPath: '/some/cli/dist/orquestia',
    });
  });
});

describe('toLipoArch', () => {
  it('maps the Node "x64" arch name to lipo\'s "x86_64"', () => {
    expect(toLipoArch('x64')).toBe('x86_64');
  });

  it('passes every other arch name through unchanged', () => {
    expect(toLipoArch('arm64')).toBe('arm64');
  });
});

describe('runSeaBuild (real end-to-end SEA build)', () => {
  let cliDir: string;

  beforeEach(async () => {
    cliDir = await mkdtemp(join(tmpdir(), 'orquestia-sea-e2e-'));
    await mkdir(join(cliDir, 'dist'), { recursive: true });
    // A real multi-file ESM import graph, matching the shape of the actual
    // compiled CLI output, so this test exercises the esbuild-bundle step
    // (not just the postject-injection step) for real.
    await writeFile(
      join(cliDir, 'dist', 'helper.js'),
      'export function greet(name) { return "sea-smoke-ok:" + name; }',
    );
    await writeFile(
      join(cliDir, 'dist', 'sea-entry.js'),
      [
        "import { greet } from './helper.js';",
        'process.stdout.write(greet(process.argv.slice(2).join(",")));',
      ].join('\n'),
    );
  });

  afterEach(async () => {
    await rm(cliDir, { recursive: true, force: true });
  });

  it('produces a standalone executable that runs without any node_modules tree', async () => {
    const paths = await runSeaBuild(cliDir);

    const { stdout } = await execFileAsync(paths.outputBinaryPath, ['foo', 'bar']);

    expect(stdout).toBe('sea-smoke-ok:foo,bar');
  }, 60_000);
});
