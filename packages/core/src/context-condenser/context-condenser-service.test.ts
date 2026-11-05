import { describe, expect, it } from 'vitest';
import { ContextCondenserService, renderParsedFile } from './context-condenser-service.js';
import { FakeSourceParserPort, FakeTokenCounterPort } from './test-builders.js';
import type { CondenserConfig, ParsedFile } from './types.js';

const baseConfig: CondenserConfig = {
  engine: 'typescript',
  maxContextTokens: 100,
  includeSignaturesOnly: true,
  pruneIrrelevantFiles: true,
};

function parsedFile(filePath: string, signature: string): ParsedFile {
  return { filePath, declarations: [{ kind: 'function', name: 'f', signature }] };
}

describe('renderParsedFile', () => {
  it('joins declaration signatures with a blank line between them', () => {
    const parsed: ParsedFile = {
      filePath: 'a.ts',
      declarations: [
        { kind: 'function', name: 'f', signature: 'export function f(): void;' },
        { kind: 'const', name: 'X', signature: 'export const X: number;' },
      ],
    };

    expect(renderParsedFile(parsed)).toBe('export function f(): void;\n\nexport const X: number;');
  });

  it('renders an empty string for a file with no exported declarations', () => {
    expect(renderParsedFile({ filePath: 'a.ts', declarations: [] })).toBe('');
  });
});

describe('FakeSourceParserPort', () => {
  it('fails loudly when a file has no configured result', () => {
    const parser = new FakeSourceParserPort({});

    expect(() => parser.parseFile('missing.ts', 'source')).toThrow('no result configured');
  });
});

describe('ContextCondenserService.condense', () => {
  it('condenses each file via the parser when includeSignaturesOnly is true', () => {
    const parser = new FakeSourceParserPort({
      'a.ts': parsedFile('a.ts', 'export function a(): void;'),
    });
    const service = new ContextCondenserService(parser, new FakeTokenCounterPort());

    const result = service.condense(
      [{ filePath: 'a.ts', sourceText: 'export function a() {}' }],
      baseConfig,
    );

    expect(result.includedFiles).toEqual([
      { filePath: 'a.ts', content: 'export function a(): void;', estimatedTokens: 26 },
    ]);
    expect(parser.calls).toEqual([{ filePath: 'a.ts', sourceText: 'export function a() {}' }]);
  });

  it('uses the raw source text and never calls the parser when includeSignaturesOnly is false', () => {
    const parser = new FakeSourceParserPort({});
    const service = new ContextCondenserService(parser, new FakeTokenCounterPort());

    const result = service.condense([{ filePath: 'a.ts', sourceText: 'full raw source' }], {
      ...baseConfig,
      includeSignaturesOnly: false,
    });

    expect(result.includedFiles).toEqual([
      { filePath: 'a.ts', content: 'full raw source', estimatedTokens: 15 },
    ]);
    expect(parser.calls).toEqual([]);
  });

  it('prunes files once the running total would exceed maxContextTokens', () => {
    const parser = new FakeSourceParserPort({
      'a.ts': parsedFile('a.ts', 'x'.repeat(60)),
      'b.ts': parsedFile('b.ts', 'y'.repeat(60)),
    });
    const service = new ContextCondenserService(parser, new FakeTokenCounterPort());

    const result = service.condense(
      [
        { filePath: 'a.ts', sourceText: '' },
        { filePath: 'b.ts', sourceText: '' },
      ],
      baseConfig,
    );

    expect(result.includedFiles.map((f) => f.filePath)).toEqual(['a.ts']);
    expect(result.excludedFiles).toEqual(['b.ts']);
    expect(result.totalEstimatedTokens).toBe(60);
  });

  it('includes every file regardless of the budget when pruneIrrelevantFiles is false', () => {
    const parser = new FakeSourceParserPort({
      'a.ts': parsedFile('a.ts', 'x'.repeat(60)),
      'b.ts': parsedFile('b.ts', 'y'.repeat(60)),
    });
    const service = new ContextCondenserService(parser, new FakeTokenCounterPort());

    const result = service.condense(
      [
        { filePath: 'a.ts', sourceText: '' },
        { filePath: 'b.ts', sourceText: '' },
      ],
      { ...baseConfig, pruneIrrelevantFiles: false },
    );

    expect(result.includedFiles.map((f) => f.filePath)).toEqual(['a.ts', 'b.ts']);
    expect(result.excludedFiles).toEqual([]);
    expect(result.totalEstimatedTokens).toBe(120);
  });

  it('returns empty results for an empty file list', () => {
    const service = new ContextCondenserService(
      new FakeSourceParserPort({}),
      new FakeTokenCounterPort(),
    );

    expect(service.condense([], baseConfig)).toEqual({
      includedFiles: [],
      excludedFiles: [],
      totalEstimatedTokens: 0,
    });
  });
});
