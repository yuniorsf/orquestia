import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFileSystem } from './node-file-system.js';

describe('NodeFileSystem', () => {
  let dir: string;
  const fileSystem = new NodeFileSystem();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orquestia-sea-fs-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes UTF-8 file contents', async () => {
    const target = join(dir, 'sea-config.json');

    await fileSystem.writeFile(target, '{"main":"x"}');

    expect(await readFile(target, 'utf8')).toBe('{"main":"x"}');
  });

  it('copies a file to a new destination', async () => {
    const source = join(dir, 'source.bin');
    const destination = join(dir, 'destination.bin');
    await writeFile(source, 'binary-contents');

    await fileSystem.copyFile(source, destination);

    expect(await readFile(destination, 'utf8')).toBe('binary-contents');
  });

  it('renames a file to a new destination', async () => {
    const source = join(dir, 'before.bin');
    const destination = join(dir, 'after.bin');
    await writeFile(source, 'renamed-contents');

    await fileSystem.rename(source, destination);

    expect(await readFile(destination, 'utf8')).toBe('renamed-contents');
    await expect(stat(source)).rejects.toThrow();
  });

  it('chmods a file to the given mode', async () => {
    const target = join(dir, 'executable');
    await writeFile(target, '#!/usr/bin/env node');

    await fileSystem.chmod(target, 0o755);

    const mode = (await stat(target)).mode & 0o777;
    expect(mode).toBe(0o755);
  });

  it('removes a file, and is a no-op if it does not exist', async () => {
    const target = join(dir, 'to-remove');
    await writeFile(target, 'temp');

    await fileSystem.remove(target);
    await expect(fileSystem.remove(target)).resolves.toBeUndefined();

    await expect(stat(target)).rejects.toThrow();
  });
});
