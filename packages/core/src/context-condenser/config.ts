import { InvalidCondenserConfigError, type CondenserConfig } from './types.js';

/**
 * Parses the `context_condenser:` section of `orquestia.config.yaml` (see
 * `ORQUESTIA_SPECIFICATION.md` §4) into a typed {@link CondenserConfig}.
 * Pure — no I/O; the raw YAML document is already loaded by `ConfigReaderPort`.
 */
export function parseCondenserConfig(raw: Readonly<Record<string, unknown>>): CondenserConfig {
  const section = requireMapping(raw.context_condenser, 'context_condenser');
  const engine = requireString(section.engine, 'context_condenser.engine');
  const maxContextTokens = requirePositiveInteger(
    section.max_context_tokens,
    'context_condenser.max_context_tokens',
  );
  const includeSignaturesOnly = requireBoolean(
    section.include_signatures_only,
    'context_condenser.include_signatures_only',
  );
  const pruneIrrelevantFiles = requireBoolean(
    section.prune_irrelevant_files,
    'context_condenser.prune_irrelevant_files',
  );

  return { engine, maxContextTokens, includeSignaturesOnly, pruneIrrelevantFiles };
}

function requireMapping(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidCondenserConfigError(`"${path}" must be a mapping.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidCondenserConfigError(`"${path}" must be a non-empty string.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new InvalidCondenserConfigError(`"${path}" must be a positive integer.`);
  }
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new InvalidCondenserConfigError(`"${path}" must be a boolean.`);
  }
  return value;
}
