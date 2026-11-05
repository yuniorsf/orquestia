import type { TokenCounterPort } from './types.js';

/** ~4 characters per token is a standard rough estimate for English/code text — adequate for a soft context budget without a real tokenizer dependency. */
const CHARS_PER_TOKEN = 4;

export class HeuristicTokenCounter implements TokenCounterPort {
  estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }
}
