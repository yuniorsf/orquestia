export interface SeaBuildPaths {
  readonly cliDir: string;
  /** Compiled, pre-bundle entrypoint (ESM) that gets flattened into {@link bundlePath}. */
  readonly entryScriptPath: string;
  /** Single-file CommonJS bundle fed to Node's SEA blob generator as `main`. */
  readonly bundlePath: string;
  readonly seaConfigPath: string;
  readonly blobPath: string;
  readonly outputBinaryPath: string;
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessRunner {
  run(command: string, args: readonly string[], cwd: string): Promise<ProcessResult>;
}

export interface SeaFileSystem {
  writeFile(path: string, contents: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  rename(source: string, destination: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  remove(path: string): Promise<void>;
}

/**
 * Everything the builder needs to know about the host it is running on,
 * injected as plain data so platform branching stays unit-testable without
 * stubbing globals like `process.platform`/`process.arch`.
 */
export interface SeaHostInfo {
  readonly platform: NodeJS.Platform;
  /** The `lipo -thin` architecture name for this process (e.g. "arm64", "x86_64"), used only on darwin. */
  readonly lipoArch: string;
  readonly nodeExecutablePath: string;
  readonly postjectCliPath: string;
}

export class SeaBuildStepFailedError extends Error {
  constructor(
    readonly stage: string,
    readonly result: ProcessResult,
  ) {
    super(`SEA build step "${stage}" failed with exit code ${result.exitCode}: ${result.stderr}`);
    this.name = 'SeaBuildStepFailedError';
  }
}
