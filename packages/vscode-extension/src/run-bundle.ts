#!/usr/bin/env node
import { join } from 'node:path';
import { bundleExtension } from './bundle-extension.js';

const packageDir = join(__dirname, '..');

bundleExtension(packageDir)
  .then((outfile) => {
    process.stdout.write(`Bundled extension at ${outfile}\n`);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
