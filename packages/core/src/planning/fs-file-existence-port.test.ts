import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FsFileExistencePort } from './fs-file-existence-port.js';

describe('FsFileExistencePort', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'orquestia-file-exists-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns true for a file that exists', async () => {
    const filePath = join(tempDir, 'present.ts');
    await writeFile(filePath, 'export const x = 1;\n', 'utf8');
    const port = new FsFileExistencePort();

    expect(await port.exists(filePath)).toBe(true);
  });

  it('returns false for a file that does not exist', async () => {
    const port = new FsFileExistencePort();

    expect(await port.exists(join(tempDir, 'missing.ts'))).toBe(false);
  });
});
