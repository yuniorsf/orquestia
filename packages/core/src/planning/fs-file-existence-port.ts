import { access } from 'node:fs/promises';
import type { FileExistencePort } from './types.js';

export class FsFileExistencePort implements FileExistencePort {
  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
