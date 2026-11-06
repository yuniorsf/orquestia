import { describe, expect, it } from 'vitest';
import { SeaBuilder } from './sea-builder.js';
import { FakeProcessRunner, FakeSeaFileSystem } from './test-builders.js';
import { SeaBuildStepFailedError } from './types.js';
import type { SeaBuildPaths, SeaHostInfo } from './types.js';

const paths: SeaBuildPaths = {
  cliDir: '/cli',
  entryScriptPath: '/cli/dist/sea-entry.js',
  bundlePath: '/cli/dist/sea-bundle.cjs',
  seaConfigPath: '/cli/sea-config.json',
  blobPath: '/cli/dist/sea-blob.blob',
  outputBinaryPath: '/cli/dist/orquestia',
};

const NODE_PATH = '/usr/local/bin/node';
const POSTJECT_CLI_PATH = '/cli/node_modules/postject/dist/cli.js';

const linuxHost: SeaHostInfo = {
  platform: 'linux',
  lipoArch: 'x86_64',
  nodeExecutablePath: NODE_PATH,
  postjectCliPath: POSTJECT_CLI_PATH,
};

const darwinHost: SeaHostInfo = { ...linuxHost, platform: 'darwin', lipoArch: 'arm64' };

describe('SeaBuilder', () => {
  it('runs the full non-macOS sequence without any codesign or lipo steps', async () => {
    const processRunner = new FakeProcessRunner();
    const fileSystem = new FakeSeaFileSystem();
    const builder = new SeaBuilder(processRunner, fileSystem, linuxHost);

    await builder.build(paths);

    expect(fileSystem.writtenFiles.get(paths.seaConfigPath)).toContain(
      '"main": "/cli/dist/sea-bundle.cjs"',
    );
    expect(processRunner.calls.map((call) => call.command)).toEqual([NODE_PATH, NODE_PATH]);
    expect(processRunner.calls[1]?.args[0]).toBe(POSTJECT_CLI_PATH);
    expect(processRunner.calls[1]?.args).not.toContain('--macho-segment-name');
    expect(fileSystem.copies).toEqual([{ source: NODE_PATH, destination: paths.outputBinaryPath }]);
    expect(fileSystem.renames).toHaveLength(0);
    expect(fileSystem.chmods).toEqual([{ path: paths.outputBinaryPath, mode: 0o755 }]);
    expect(fileSystem.removed).toEqual([paths.blobPath]);
  });

  it('runs the macOS sequence with lipo-thin, strip-signature, --macho-segment-name, and re-sign', async () => {
    const processRunner = new FakeProcessRunner(
      new Map([['lipo', { exitCode: 0, stdout: '', stderr: '' }]]),
    );
    const fileSystem = new FakeSeaFileSystem();
    const builder = new SeaBuilder(processRunner, fileSystem, darwinHost);

    await builder.build(paths);

    expect(processRunner.calls.map((call) => call.command)).toEqual([
      NODE_PATH,
      'lipo',
      'codesign',
      NODE_PATH,
      'codesign',
    ]);
    expect(processRunner.calls[1]?.args).toEqual([
      '-thin',
      'arm64',
      '-output',
      `${paths.outputBinaryPath}.thin`,
      paths.outputBinaryPath,
    ]);
    expect(fileSystem.renames).toEqual([
      { source: `${paths.outputBinaryPath}.thin`, destination: paths.outputBinaryPath },
    ]);
    expect(processRunner.calls[2]?.args).toEqual(['--remove-signature', paths.outputBinaryPath]);
    expect(processRunner.calls[3]?.args).toContain('--macho-segment-name');
    expect(processRunner.calls[4]?.args).toEqual(['--sign', '-', paths.outputBinaryPath]);
  });

  it('treats lipo-thin failure as a non-fatal no-op when the binary is already single-arch', async () => {
    const processRunner = new FakeProcessRunner(
      new Map([['lipo', { exitCode: 1, stdout: '', stderr: 'not a fat file' }]]),
    );
    const fileSystem = new FakeSeaFileSystem();
    const builder = new SeaBuilder(processRunner, fileSystem, darwinHost);

    await builder.build(paths);

    expect(fileSystem.renames).toHaveLength(0);
    expect(processRunner.calls.map((call) => call.command)).toEqual([
      NODE_PATH,
      'lipo',
      'codesign',
      NODE_PATH,
      'codesign',
    ]);
  });

  it('runs every process in the configured cliDir', async () => {
    const processRunner = new FakeProcessRunner(
      new Map([['lipo', { exitCode: 0, stdout: '', stderr: '' }]]),
    );
    const fileSystem = new FakeSeaFileSystem();
    const builder = new SeaBuilder(processRunner, fileSystem, darwinHost);

    await builder.build(paths);

    expect(processRunner.calls.every((call) => call.cwd === paths.cliDir)).toBe(true);
  });

  it('throws SeaBuildStepFailedError and stops the sequence when a step fails', async () => {
    const processRunner = new FakeProcessRunner(
      new Map([[NODE_PATH, { exitCode: 1, stdout: '', stderr: 'bad config' }]]),
    );
    const fileSystem = new FakeSeaFileSystem();
    const builder = new SeaBuilder(processRunner, fileSystem, linuxHost);

    await expect(builder.build(paths)).rejects.toThrow(SeaBuildStepFailedError);
    expect(processRunner.calls).toHaveLength(1);
    expect(fileSystem.copies).toHaveLength(0);
  });

  it('includes the stage and process result on the thrown error', async () => {
    let callCount = 0;
    const processRunner = new FakeProcessRunner();
    processRunner.run = async (command, args, cwd) => {
      callCount += 1;
      processRunner.calls.push({ command, args, cwd });
      if (callCount === 2) {
        return { exitCode: 3, stdout: '', stderr: 'postject failed' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const fileSystem = new FakeSeaFileSystem();
    const builder = new SeaBuilder(processRunner, fileSystem, linuxHost);

    try {
      await builder.build(paths);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SeaBuildStepFailedError);
      const seaError = error as SeaBuildStepFailedError;
      expect(seaError.stage).toBe('inject-blob');
      expect(seaError.result).toEqual({ exitCode: 3, stdout: '', stderr: 'postject failed' });
      expect(seaError.message).toContain('inject-blob');
    }
  });
});
