import { describe, expect, it } from 'vitest';
import { HeuristicTokenCounter } from './heuristic-token-counter.js';

describe('HeuristicTokenCounter.estimateTokens', () => {
  it('estimates roughly 4 characters per token, rounding up', () => {
    const counter = new HeuristicTokenCounter();

    expect(counter.estimateTokens('abcd')).toBe(1);
    expect(counter.estimateTokens('abcde')).toBe(2);
  });

  it('returns 0 for an empty string', () => {
    expect(new HeuristicTokenCounter().estimateTokens('')).toBe(0);
  });
});
