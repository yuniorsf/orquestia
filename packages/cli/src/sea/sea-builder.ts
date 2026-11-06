import type { ProcessRunner, SeaBuildPaths, SeaFileSystem, SeaHostInfo } from './types.js';
import { SeaBuildStepFailedError } from './types.js';

const SEA_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

function renderSeaConfig(mainScriptPath: string, blobPath: string): string {
  return JSON.stringify(
    {
      main: mainScriptPath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
    },
    null,
    2,
  );
}

/**
 * Compiles the CLI's built entrypoint into a single-file executable using
 * Node's built-in `node:sea` blob format, following the exact
 * generate-blob -> copy-node-binary -> (macOS: thin + strip signature) ->
 * postject-inject -> (macOS: re-sign) sequence documented by Node for SEAs.
 *
 * Both the blob-generating `node` process and the binary copied as the SEA
 * host must be the *same* Node build, so `nodeExecutablePath` is injected
 * rather than resolved from `$PATH` (which could point at a different Node
 * version than the one currently running this builder). `postjectCliPath`
 * is similarly injected as a resolved on-disk path instead of shelling out
 * to `npx postject`, so injection never depends on the invoking process's
 * cwd or falls back to a network fetch.
 *
 * macOS's official Node distribution ships a universal (fat) binary with
 * both arm64 and x86_64 slices, each embedding the SEA sentinel fuse once —
 * postject refuses to inject into a binary with more than one sentinel
 * occurrence. `lipo -thin` is attempted (best-effort: a binary that is
 * already single-architecture simply fails this step, which is not
 * treated as fatal) to reduce the copy to the current process's
 * architecture before injection.
 *
 * All I/O is routed through injected ports so the orchestration order and
 * platform branching are unit-testable without spawning real processes.
 */
export class SeaBuilder {
  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly fileSystem: SeaFileSystem,
    private readonly host: SeaHostInfo,
  ) {}

  async build(paths: SeaBuildPaths): Promise<void> {
    await this.fileSystem.writeFile(
      paths.seaConfigPath,
      renderSeaConfig(paths.bundlePath, paths.blobPath),
    );

    await this.runStep(
      'generate-blob',
      this.host.nodeExecutablePath,
      ['--experimental-sea-config', paths.seaConfigPath],
      paths.cliDir,
    );

    await this.fileSystem.copyFile(this.host.nodeExecutablePath, paths.outputBinaryPath);

    if (this.host.platform === 'darwin') {
      await this.thinUniversalBinary(paths);
      await this.runStep(
        'remove-signature',
        'codesign',
        ['--remove-signature', paths.outputBinaryPath],
        paths.cliDir,
      );
    }

    const postjectArgs = [
      this.host.postjectCliPath,
      paths.outputBinaryPath,
      'NODE_SEA_BLOB',
      paths.blobPath,
      '--sentinel-fuse',
      SEA_FUSE,
    ];
    if (this.host.platform === 'darwin') {
      postjectArgs.push('--macho-segment-name', 'NODE_SEA');
    }
    await this.runStep('inject-blob', this.host.nodeExecutablePath, postjectArgs, paths.cliDir);

    if (this.host.platform === 'darwin') {
      await this.runStep(
        're-sign',
        'codesign',
        ['--sign', '-', paths.outputBinaryPath],
        paths.cliDir,
      );
    }

    await this.fileSystem.chmod(paths.outputBinaryPath, 0o755);
    await this.fileSystem.remove(paths.blobPath);
  }

  /** Best-effort: reduces a universal binary to the current arch; a no-op if already single-arch. */
  private async thinUniversalBinary(paths: SeaBuildPaths): Promise<void> {
    const thinnedPath = `${paths.outputBinaryPath}.thin`;
    const result = await this.processRunner.run(
      'lipo',
      ['-thin', this.host.lipoArch, '-output', thinnedPath, paths.outputBinaryPath],
      paths.cliDir,
    );
    if (result.exitCode === 0) {
      await this.fileSystem.rename(thinnedPath, paths.outputBinaryPath);
    }
  }

  private async runStep(
    stage: string,
    command: string,
    args: readonly string[],
    cwd: string,
  ): Promise<void> {
    const result = await this.processRunner.run(command, args, cwd);
    if (result.exitCode !== 0) {
      throw new SeaBuildStepFailedError(stage, result);
    }
  }
}
