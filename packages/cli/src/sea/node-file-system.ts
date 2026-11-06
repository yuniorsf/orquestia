import { chmod, copyFile, rename, rm, writeFile } from 'node:fs/promises';
import type { SeaFileSystem } from './types.js';

/** Real `node:fs/promises`-backed {@link SeaFileSystem} for SEA build steps. */
export class NodeFileSystem implements SeaFileSystem {
  async writeFile(path: string, contents: string): Promise<void> {
    await writeFile(path, contents, 'utf8');
  }

  async copyFile(source: string, destination: string): Promise<void> {
    await copyFile(source, destination);
  }

  async rename(source: string, destination: string): Promise<void> {
    await rename(source, destination);
  }

  async chmod(path: string, mode: number): Promise<void> {
    await chmod(path, mode);
  }

  async remove(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}
