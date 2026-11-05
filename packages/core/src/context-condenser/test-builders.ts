import type { ParsedFile, SourceParserPort, TokenCounterPort } from './types.js';

export class FakeSourceParserPort implements SourceParserPort {
  readonly calls: Array<{ filePath: string; sourceText: string }> = [];

  constructor(private readonly resultsByPath: Readonly<Record<string, ParsedFile>>) {}

  parseFile(filePath: string, sourceText: string): ParsedFile {
    this.calls.push({ filePath, sourceText });
    const result = this.resultsByPath[filePath];
    if (!result) {
      throw new Error(`FakeSourceParserPort: no result configured for file "${filePath}".`);
    }
    return result;
  }
}

/** Counts tokens as exactly the string length, so test fixtures can use small, human-readable numbers for the budget instead of real character counts. */
export class FakeTokenCounterPort implements TokenCounterPort {
  estimateTokens(text: string): number {
    return text.length;
  }
}
