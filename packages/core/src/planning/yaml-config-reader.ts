import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { ConfigValidationError, type ConfigReaderPort, type OrquestiaConfig } from './types.js';

/**
 * Ingests `orquestia.config.yaml` into a typed {@link OrquestiaConfig},
 * exposing the parsed document verbatim via `raw` for callers that need
 * sections this domain type does not model yet.
 */
export class YamlConfigReader implements ConfigReaderPort {
  constructor(private readonly filePath: string) {}

  async loadConfig(): Promise<OrquestiaConfig> {
    const text = await readFile(this.filePath, 'utf8');
    const parsed = parse(text) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      throw new ConfigValidationError(this.filePath, 'document root must be a mapping.');
    }

    const raw = parsed as Record<string, unknown>;
    const { version, project_name: projectName } = raw;

    if (typeof version !== 'string') {
      throw new ConfigValidationError(this.filePath, '"version" must be a string.');
    }
    if (typeof projectName !== 'string') {
      throw new ConfigValidationError(this.filePath, '"project_name" must be a string.');
    }

    return { version, projectName, raw };
  }
}
