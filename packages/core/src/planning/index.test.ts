import { describe, expect, it } from 'vitest';
import * as planning from './index.js';

describe('planning public API', () => {
  it('exports the baseline snapshot service and its adapters', () => {
    expect(planning.BaselineSnapshotService).toBeTypeOf('function');
    expect(planning.GitStatusSnapshotter).toBeTypeOf('function');
    expect(planning.YamlConfigReader).toBeTypeOf('function');
  });

  it('exports the config domain error type', () => {
    expect(planning.ConfigValidationError).toBeTypeOf('function');
  });
});
