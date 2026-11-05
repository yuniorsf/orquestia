#!/usr/bin/env node
import { runCli } from './main.js';

const result = await runCli(process.argv.slice(2), process.cwd());
if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}
process.exitCode = result.exitCode;
