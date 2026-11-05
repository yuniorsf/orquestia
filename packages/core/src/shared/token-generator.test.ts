import { describe, expect, it } from 'vitest';
import { RandomTokenGenerator } from './token-generator.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('RandomTokenGenerator', () => {
  it('generates a UUID-shaped token', () => {
    expect(new RandomTokenGenerator().generate()).toMatch(UUID_PATTERN);
  });

  it('generates a different token on each call', () => {
    const generator = new RandomTokenGenerator();

    expect(generator.generate()).not.toBe(generator.generate());
  });
});
