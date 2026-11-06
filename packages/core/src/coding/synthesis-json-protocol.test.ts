import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FsFileWriter,
  MalformedSynthesisOutputError,
  parseSynthesisOutput,
  renderFileManifestList,
  writeSynthesizedFiles,
} from './synthesis-json-protocol.js';

describe('parseSynthesisOutput', () => {
  it('parses a well-formed response', () => {
    const files = parseSynthesisOutput(
      '2A',
      '{"files":[{"path":"src/foo.ts","content":"export const x = 1;"}]}',
    );

    expect(files).toEqual([{ path: 'src/foo.ts', content: 'export const x = 1;' }]);
  });

  it('extracts the JSON object even when the model adds prose around it', () => {
    const files = parseSynthesisOutput(
      '2A',
      'Sure thing!\n\n{"files":[{"path":"a.ts","content":"x"}]}\n\nLet me know if you need more.',
    );

    expect(files).toEqual([{ path: 'a.ts', content: 'x' }]);
  });

  it('extracts the JSON object past tool-call transcript noise containing its own braces', () => {
    const files = parseSynthesisOutput(
      '2B',
      [
        "$ Shell cat config.ts && echo '{ not: json }'",
        '{ not: json }',
        '{"files":[{"path":"a.ts","content":"export const x = { nested: true };"}]}',
      ].join('\n'),
    );

    expect(files).toEqual([{ path: 'a.ts', content: 'export const x = { nested: true };' }]);
  });

  it('strips a ```json markdown fence before parsing', () => {
    const files = parseSynthesisOutput('2B', '```json\n{"files":[]}\n```');

    expect(files).toEqual([]);
  });

  it('throws MalformedSynthesisOutputError on invalid JSON', () => {
    expect(() => parseSynthesisOutput('2A', 'not json')).toThrow(MalformedSynthesisOutputError);
  });

  it('throws when "files" is missing or not an array', () => {
    expect(() => parseSynthesisOutput('2A', '{}')).toThrow(MalformedSynthesisOutputError);
  });

  it('throws when a files entry has an invalid path or content', () => {
    expect(() => parseSynthesisOutput('2A', '{"files":[{"path":"a.ts","content":42}]}')).toThrow(
      MalformedSynthesisOutputError,
    );
  });
});

describe('renderFileManifestList', () => {
  it('formats one bullet per entry with its kind', () => {
    expect(renderFileManifestList([{ path: 'a.ts', kind: 'NEW' }])).toBe('- [NEW] a.ts');
  });
});

describe('FsFileWriter + writeSynthesizedFiles', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orquestia-synth-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes a file, creating nested parent directories', async () => {
    const writer = new FsFileWriter();

    await writeSynthesizedFiles(writer, dir, [{ path: 'src/nested/foo.ts', content: 'hello' }]);

    expect(await readFile(join(dir, 'src/nested/foo.ts'), 'utf8')).toBe('hello');
  });

  it('writes multiple files', async () => {
    const writer = new FsFileWriter();

    await writeSynthesizedFiles(writer, dir, [
      { path: 'a.ts', content: 'A' },
      { path: 'b.ts', content: 'B' },
    ]);

    expect(await readFile(join(dir, 'a.ts'), 'utf8')).toBe('A');
    expect(await readFile(join(dir, 'b.ts'), 'utf8')).toBe('B');
  });
});
