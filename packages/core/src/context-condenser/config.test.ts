import { describe, expect, it } from 'vitest';
import { parseCondenserConfig } from './config.js';
import { InvalidCondenserConfigError } from './types.js';

const validRaw = {
  context_condenser: {
    engine: 'tree_sitter',
    max_context_tokens: 16000,
    include_signatures_only: true,
    prune_irrelevant_files: true,
  },
};

describe('parseCondenserConfig', () => {
  it('parses the exact shape documented in ORQUESTIA_SPECIFICATION.md §4', () => {
    expect(parseCondenserConfig(validRaw)).toEqual({
      engine: 'tree_sitter',
      maxContextTokens: 16000,
      includeSignaturesOnly: true,
      pruneIrrelevantFiles: true,
    });
  });

  it('throws InvalidCondenserConfigError when "context_condenser" is missing', () => {
    expect(() => parseCondenserConfig({})).toThrow(InvalidCondenserConfigError);
  });

  it('throws InvalidCondenserConfigError when "engine" is not a string', () => {
    expect(() =>
      parseCondenserConfig({ context_condenser: { ...validRaw.context_condenser, engine: 42 } }),
    ).toThrow(InvalidCondenserConfigError);
  });

  it('throws InvalidCondenserConfigError when "max_context_tokens" is not a positive integer', () => {
    expect(() =>
      parseCondenserConfig({
        context_condenser: { ...validRaw.context_condenser, max_context_tokens: -1 },
      }),
    ).toThrow(InvalidCondenserConfigError);
    expect(() =>
      parseCondenserConfig({
        context_condenser: { ...validRaw.context_condenser, max_context_tokens: 1.5 },
      }),
    ).toThrow(InvalidCondenserConfigError);
  });

  it('throws InvalidCondenserConfigError when "include_signatures_only" is not a boolean', () => {
    expect(() =>
      parseCondenserConfig({
        context_condenser: { ...validRaw.context_condenser, include_signatures_only: 'yes' },
      }),
    ).toThrow(InvalidCondenserConfigError);
  });

  it('throws InvalidCondenserConfigError when "prune_irrelevant_files" is not a boolean', () => {
    expect(() =>
      parseCondenserConfig({
        context_condenser: { ...validRaw.context_condenser, prune_irrelevant_files: 'no' },
      }),
    ).toThrow(InvalidCondenserConfigError);
  });
});
