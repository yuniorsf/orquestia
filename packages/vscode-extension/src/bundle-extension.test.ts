import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundleExtension } from './bundle-extension.js';

describe('bundleExtension (real esbuild bundle)', () => {
  let packageDir: string;

  beforeEach(async () => {
    packageDir = await mkdtemp(join(tmpdir(), 'orquestia-vscode-bundle-'));
    await mkdir(join(packageDir, 'dist-tsc'), { recursive: true });
    await writeFile(
      join(packageDir, 'dist-tsc', 'extension.js'),
      [
        "import * as vscode from 'vscode';",
        'export function activate() {',
        "  return vscode.window.showInformationMessage('hi');",
        '}',
      ].join('\n'),
    );
    // A fake `vscode` module so the bundled CJS output can genuinely be
    // require()'d in this test, the same way the real Extension Host
    // injects the real `vscode` module into the resolution path at load
    // time — proving `external: ['vscode']` actually keeps it external
    // instead of failing to resolve it at bundle time.
    await mkdir(join(packageDir, 'dist', 'node_modules', 'vscode'), { recursive: true });
    await writeFile(
      join(packageDir, 'dist', 'node_modules', 'vscode', 'index.js'),
      "exports.window = { showInformationMessage: (msg) => 'shown:' + msg };",
    );
    await writeFile(
      join(packageDir, 'dist', 'node_modules', 'vscode', 'package.json'),
      JSON.stringify({ name: 'vscode', main: 'index.js' }),
    );
  });

  afterEach(async () => {
    await rm(packageDir, { recursive: true, force: true });
  });

  it('bundles into a single CJS file that keeps "vscode" external and runs once it is injected', async () => {
    const outfile = await bundleExtension(packageDir);

    const require = createRequire(__filename);
    const bundled = require(outfile) as { activate: () => string };

    expect(bundled.activate()).toBe('shown:hi');
  });
});
