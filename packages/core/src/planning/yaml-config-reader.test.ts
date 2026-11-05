import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigValidationError } from './types.js';
import { YamlConfigReader } from './yaml-config-reader.js';

describe('YamlConfigReader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'orquestia-config-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeConfig(contents: string): Promise<string> {
    const filePath = join(tempDir, 'orquestia.config.yaml');
    await writeFile(filePath, contents, 'utf8');
    return filePath;
  }

  it('parses version and project_name into a typed config, keeping the raw document', async () => {
    const filePath = await writeConfig(
      'version: "3.2"\nproject_name: "Orquestia"\nvault:\n  provider: sqlcipher\n',
    );
    const reader = new YamlConfigReader(filePath);

    const config = await reader.loadConfig();

    expect(config.version).toBe('3.2');
    expect(config.projectName).toBe('Orquestia');
    expect(config.raw).toMatchObject({ vault: { provider: 'sqlcipher' } });
  });

  it('rejects a document whose root is a scalar, not a mapping', async () => {
    const filePath = await writeConfig('just a scalar string\n');
    const reader = new YamlConfigReader(filePath);

    await expect(reader.loadConfig()).rejects.toThrow(ConfigValidationError);
  });

  it('rejects a document missing a string "version"', async () => {
    const filePath = await writeConfig('project_name: "Orquestia"\n');
    const reader = new YamlConfigReader(filePath);

    await expect(reader.loadConfig()).rejects.toThrow(ConfigValidationError);
  });

  it('rejects a document missing a string "project_name"', async () => {
    const filePath = await writeConfig('version: "3.2"\n');
    const reader = new YamlConfigReader(filePath);

    await expect(reader.loadConfig()).rejects.toThrow(ConfigValidationError);
  });
});
