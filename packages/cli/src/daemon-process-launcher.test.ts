import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChildProcessDaemonLauncher } from './daemon-process-launcher.js';

describe('ChildProcessDaemonLauncher (real detached spawn)', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orquestia-launcher-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('spawns the script detached, redirecting its output to the log file', async () => {
    const scriptPath = join(dir, 'script.mjs');
    await writeFile(
      scriptPath,
      [
        'process.stdout.write("stdout:" + process.argv[2] + "\\n");',
        'process.stderr.write("stderr-line\\n");',
      ].join('\n'),
    );
    const logPath = join(dir, 'logs', 'daemon.log');
    const launcher = new ChildProcessDaemonLauncher(scriptPath, ['hello-arg'], dir, logPath);

    await launcher.spawn();
    await waitForFileContent(logPath, 'stdout:hello-arg');

    const log = await readFile(logPath, 'utf8');
    expect(log).toContain('stdout:hello-arg');
    expect(log).toContain('stderr-line');
  });

  it("creates the log file's parent directory when it does not exist yet", async () => {
    const scriptPath = join(dir, 'noop.mjs');
    await writeFile(scriptPath, 'process.stdout.write("ran\\n");');
    const logPath = join(dir, 'nested', 'deep', 'daemon.log');
    const launcher = new ChildProcessDaemonLauncher(scriptPath, [], dir, logPath);

    await launcher.spawn();

    await waitForFileContent(logPath, 'ran');
  });
});

async function waitForFileContent(path: string, expected: string): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const content = await readFile(path, 'utf8');
      if (content.includes(expected)) {
        return;
      }
    } catch {
      // file not created yet
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for "${path}" to contain "${expected}".`);
}
