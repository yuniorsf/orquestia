#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSeaBuild } from './sea/build-sea-cli.js';

const cliDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const paths = await runSeaBuild(cliDir);
process.stdout.write(`Built SEA executable at ${paths.outputBinaryPath}\n`);
