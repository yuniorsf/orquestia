#!/usr/bin/env node
import { runCli } from './main.js';

// Node's `node:sea` blob loader runs its main script as CommonJS, which
// cannot use top-level `await` — unlike `index.ts` (the regular npm `bin`
// entry), this bootstrap chains `.then()/.catch()` so the esbuild-bundled
// output stays CJS-compatible.
runCli(process.argv.slice(2), process.cwd())
  .then((result) => {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exitCode = result.exitCode;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
