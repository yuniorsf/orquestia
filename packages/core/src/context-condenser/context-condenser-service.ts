import type {
  CondenserConfig,
  CondensedFile,
  ContextProjectionResult,
  ParsedFile,
  SourceFileInput,
  SourceParserPort,
  TokenCounterPort,
} from './types.js';

/**
 * Projects a set of peripheral source files down to their ISP Minimal
 * Context Projection ($\pi_k$), bounded by `maxContextTokens`. Files are
 * considered in the given order (relevance ranking is the caller's
 * concern); once the running total would exceed the budget, remaining
 * files are pruned (excluded) rather than truncated mid-file.
 */
export class ContextCondenserService {
  constructor(
    private readonly parser: SourceParserPort,
    private readonly tokenCounter: TokenCounterPort,
  ) {}

  condense(files: readonly SourceFileInput[], config: CondenserConfig): ContextProjectionResult {
    const includedFiles: CondensedFile[] = [];
    const excludedFiles: string[] = [];
    let totalEstimatedTokens = 0;

    for (const file of files) {
      const content = config.includeSignaturesOnly
        ? renderParsedFile(this.parser.parseFile(file.filePath, file.sourceText))
        : file.sourceText;
      const estimatedTokens = this.tokenCounter.estimateTokens(content);

      if (
        config.pruneIrrelevantFiles &&
        totalEstimatedTokens + estimatedTokens > config.maxContextTokens
      ) {
        excludedFiles.push(file.filePath);
        continue;
      }

      includedFiles.push({ filePath: file.filePath, content, estimatedTokens });
      totalEstimatedTokens += estimatedTokens;
    }

    return { includedFiles, excludedFiles, totalEstimatedTokens };
  }
}

export function renderParsedFile(parsed: ParsedFile): string {
  return parsed.declarations.map((declaration) => declaration.signature).join('\n\n');
}
