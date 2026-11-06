import { describe, expect, it } from 'vitest';
import * as sea from './index.js';

describe('sea public API', () => {
  it('exports the composition root functions', () => {
    expect(sea.runSeaBuild).toBeTypeOf('function');
    expect(sea.resolveSeaBuildPaths).toBeTypeOf('function');
    expect(sea.toLipoArch).toBeTypeOf('function');
  });

  it('exports the builder and real adapters', () => {
    expect(sea.SeaBuilder).toBeTypeOf('function');
    expect(sea.NodeProcessRunner).toBeTypeOf('function');
    expect(sea.NodeFileSystem).toBeTypeOf('function');
  });

  it('exports the domain error type', () => {
    expect(sea.SeaBuildStepFailedError).toBeTypeOf('function');
  });
});
