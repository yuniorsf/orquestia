import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FsPlanSpecWriter } from './fs-plan-spec-writer.js';

describe('FsPlanSpecWriter', () => {
  let specsDir: string;

  beforeEach(async () => {
    specsDir = join(await mkdtemp(join(tmpdir(), 'orquestia-specs-')), 'nested', 'specs');
  });

  afterEach(async () => {
    await rm(specsDir, { recursive: true, force: true });
  });

  it('writes the markdown to plan-<taskId>.md, creating the specs directory', async () => {
    const writer = new FsPlanSpecWriter(specsDir);

    const specPath = await writer.writeSpec('ORQ-14-example', '# Plan\n');

    expect(specPath).toBe(join(specsDir, 'plan-ORQ-14-example.md'));
    await expect(readFile(specPath, 'utf8')).resolves.toBe('# Plan\n');
  });
});
