/**
 * Token-Aware Context Condenser (AST Repo-Map): strips implementations,
 * private members, and comments from peripheral source files, extracting
 * an ISP Minimal Context Projection ($\pi_k$) of exported interfaces,
 * signatures, DTOs, and ports — bounded by `context_condenser.max_context_tokens`.
 */
export type DeclarationKind = 'interface' | 'type' | 'class' | 'function' | 'const' | 'enum';

export interface ExportedDeclaration {
  readonly kind: DeclarationKind;
  readonly name: string;
  /** The declaration's signature only — implementation bodies, private members, and comments stripped. */
  readonly signature: string;
}

export interface ParsedFile {
  readonly filePath: string;
  readonly declarations: readonly ExportedDeclaration[];
}

/** Abstracts the language-specific AST analyzer. TypeScriptAstSourceParser is the one adapter shipped here; other language grammars (e.g. a real tree-sitter backend) implement this same port in future tickets. */
export interface SourceParserPort {
  parseFile(filePath: string, sourceText: string): ParsedFile;
}

/** Abstracts token estimation so the budget check doesn't hardcode a specific tokenizer. */
export interface TokenCounterPort {
  estimateTokens(text: string): number;
}

export interface CondenserConfig {
  readonly engine: string;
  readonly maxContextTokens: number;
  readonly includeSignaturesOnly: boolean;
  readonly pruneIrrelevantFiles: boolean;
}

export interface SourceFileInput {
  readonly filePath: string;
  readonly sourceText: string;
}

export interface CondensedFile {
  readonly filePath: string;
  readonly content: string;
  readonly estimatedTokens: number;
}

export interface ContextProjectionResult {
  readonly includedFiles: readonly CondensedFile[];
  readonly excludedFiles: readonly string[];
  readonly totalEstimatedTokens: number;
}

export class InvalidCondenserConfigError extends Error {
  constructor(message: string) {
    super(`Invalid "context_condenser" config section in orquestia.config.yaml: ${message}`);
    this.name = 'InvalidCondenserConfigError';
  }
}
