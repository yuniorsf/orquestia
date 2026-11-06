import type { ProcessResult, ProcessRunner, SeaFileSystem } from './types.js';

export class FakeProcessRunner implements ProcessRunner {
  readonly calls: Array<{ command: string; args: readonly string[]; cwd: string }> = [];

  constructor(private readonly resultsByCommand: ReadonlyMap<string, ProcessResult> = new Map()) {}

  async run(command: string, args: readonly string[], cwd: string): Promise<ProcessResult> {
    this.calls.push({ command, args, cwd });
    return this.resultsByCommand.get(command) ?? { exitCode: 0, stdout: '', stderr: '' };
  }
}

export class FakeSeaFileSystem implements SeaFileSystem {
  readonly writtenFiles = new Map<string, string>();
  readonly copies: Array<{ source: string; destination: string }> = [];
  readonly renames: Array<{ source: string; destination: string }> = [];
  readonly chmods: Array<{ path: string; mode: number }> = [];
  readonly removed: string[] = [];

  async writeFile(path: string, contents: string): Promise<void> {
    this.writtenFiles.set(path, contents);
  }

  async copyFile(source: string, destination: string): Promise<void> {
    this.copies.push({ source, destination });
  }

  async rename(source: string, destination: string): Promise<void> {
    this.renames.push({ source, destination });
  }

  async chmod(path: string, mode: number): Promise<void> {
    this.chmods.push({ path, mode });
  }

  async remove(path: string): Promise<void> {
    this.removed.push(path);
  }
}
