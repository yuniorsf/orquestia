import { join } from 'node:path';
import { build } from 'esbuild';

/**
 * Bundles the compiled extension entrypoint (and its `@orquestia/core`
 * import graph) into a single CommonJS file. VS Code's Extension Host
 * `require()`s `main` directly, and `@orquestia/core` ships as an ESM
 * package — bundling avoids any CJS/ESM interop question at load time and
 * keeps `node_modules` out of the packaged `.vsix` entirely. `vscode`
 * itself is marked external: it is not a real on-disk package, but a
 * module the Extension Host injects into the resolution path at runtime.
 */
export async function bundleExtension(packageDir: string): Promise<string> {
  const entryPoint = join(packageDir, 'dist-tsc', 'extension.js');
  const outfile = join(packageDir, 'dist', 'extension.js');

  await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
    logLevel: 'silent',
  });

  return outfile;
}
