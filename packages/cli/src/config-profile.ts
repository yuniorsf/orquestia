import { join } from 'node:path';

export const DEFAULT_CONFIG_FILENAME = 'orquestia.config.yaml';
const CONFIG_PROFILES_DIR = '.orquestia/configs';
const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export class InvalidConfigProfileError extends Error {
  constructor(profile: string) {
    super(
      `Invalid config profile name "${profile}": must match ${PROFILE_NAME_PATTERN.source} (no path separators or "..").`,
    );
    this.name = 'InvalidConfigProfileError';
  }
}

/**
 * Extracts a global `--config <name>` flag from `argv`, mirroring
 * `parseVerbosity`'s shape so the two compose cleanly regardless of order:
 * strips both tokens from the result so command-specific parsing (e.g.
 * `code`'s `--ship`) is unaffected by its position. The last occurrence
 * wins if given more than once.
 */
export function parseConfigSelector(argv: readonly string[]): {
  readonly profile: string | undefined;
  readonly rest: readonly string[];
} {
  let profile: string | undefined;
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--config') {
      const value = argv[i + 1];
      if (value !== undefined) {
        profile = value;
        i += 1;
        continue;
      }
    }
    rest.push(arg);
  }

  return { profile, rest };
}

/**
 * Resolves which config file `orquestia plan`/`orquestia code` should
 * read: `<cwd>/orquestia.config.yaml` when no profile was named (today's
 * unchanged default), or `<cwd>/.orquestia/configs/<profile>.yaml`
 * otherwise. Throws `InvalidConfigProfileError` for a profile name
 * containing a path separator or `..` — this is a filename, not a path,
 * and must never let `--config` escape the profiles directory.
 */
export function resolveConfigPath(cwd: string, profile: string | undefined): string {
  if (profile === undefined) {
    return join(cwd, DEFAULT_CONFIG_FILENAME);
  }
  if (!PROFILE_NAME_PATTERN.test(profile)) {
    throw new InvalidConfigProfileError(profile);
  }
  return join(cwd, CONFIG_PROFILES_DIR, `${profile}.yaml`);
}
