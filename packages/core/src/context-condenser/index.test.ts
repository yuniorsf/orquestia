import { describe, expect, it } from 'vitest';
import * as contextCondenser from './index.js';

describe('context-condenser public API', () => {
  it('exports the config parser', () => {
    expect(contextCondenser.parseCondenserConfig).toBeTypeOf('function');
  });

  it('exports the domain error type', () => {
    expect(contextCondenser.InvalidCondenserConfigError).toBeTypeOf('function');
  });

  it('exports the orchestrating service, its pure render helper, and the real adapters', () => {
    expect(contextCondenser.ContextCondenserService).toBeTypeOf('function');
    expect(contextCondenser.renderParsedFile).toBeTypeOf('function');
    expect(contextCondenser.TypeScriptAstSourceParser).toBeTypeOf('function');
    expect(contextCondenser.HeuristicTokenCounter).toBeTypeOf('function');
  });
});
