import { createRequire } from 'node:module';
import { join } from 'node:path';
import { build as esbuildBundle } from 'esbuild';
import { NodeFileSystem } from './node-file-system.js';
import { NodeProcessRunner } from './node-process-runner.js';
import { SeaBuilder } from './sea-builder.js';
import type { SeaBuildPaths, SeaHostInfo } from './types.js';

const require = createRequire(import.meta.url);

/** Maps Node's `process.arch` to the architecture name `lipo -thin` expects. */
export function toLipoArch(nodeArch: string): string {
  if (nodeArch === 'x64') {
    return 'x86_64';
  }
  return nodeArch;
}

/** Computes the fixed on-disk layout the SEA build uses inside a built `@orquestia/cli` checkout. */
export function resolveSeaBuildPaths(cliDir: string): SeaBuildPaths {
  return {
    cliDir,
    entryScriptPath: join(cliDir, 'dist', 'sea-entry.js'),
    bundlePath: join(cliDir, 'dist', 'sea-bundle.cjs'),
    seaConfigPath: join(cliDir, 'sea-config.json'),
    blobPath: join(cliDir, 'dist', 'sea-blob.blob'),
    outputBinaryPath: join(cliDir, 'dist', 'orquestia'),
  };
}

/**
 * Composition root wiring real process/filesystem adapters for the SEA
 * build. Node's `node:sea` blob loader always executes its main script as
 * CommonJS, but the CLI's compiled entrypoint is a multi-file ESM import
 * graph (it depends on `@orquestia/core`) — esbuild flattens that graph
 * into a single self-contained CJS file before the SEA blob is generated.
 */
export async function runSeaBuild(cliDir: string): Promise<SeaBuildPaths> {
  const paths = resolveSeaBuildPaths(cliDir);

  await esbuildBundle({
    entryPoints: [paths.entryScriptPath],
    outfile: paths.bundlePath,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
  });

  const host: SeaHostInfo = {
    platform: process.platform,
    lipoArch: toLipoArch(process.arch),
    nodeExecutablePath: process.execPath,
    postjectCliPath: require.resolve('postject/dist/cli.js'),
  };
  const builder = new SeaBuilder(new NodeProcessRunner(), new NodeFileSystem(), host);
  await builder.build(paths);
  return paths;
}
