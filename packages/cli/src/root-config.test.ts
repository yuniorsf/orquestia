import { join } from 'node:path';
import {
  parseAtlassianAlmConfig,
  parseCondenserConfig,
  parseLayerPoolsConfig,
  parseOrchestrationConfig,
  YamlConfigReader,
} from '@orquestia/core';
import { describe, expect, it } from 'vitest';

const ROOT_CONFIG_PATH = join(process.cwd(), 'orquestia.config.yaml');

/**
 * Regression guard for the repo-root `orquestia.config.yaml`: asserts it
 * stays loadable by `YamlConfigReader` and parses cleanly against every
 * real section parser, so the shipped file can never silently drift out of
 * sync with the parsers it's meant to satisfy.
 */
describe('orquestia.config.yaml (repo root)', () => {
  it('parses as a valid OrquestiaConfig', async () => {
    const config = await new YamlConfigReader(ROOT_CONFIG_PATH).loadConfig();

    expect(config.version).toBe('3.0');
    expect(config.projectName).toBe('Orquestia');
  });

  it('its context_condenser section parses against the real parser', async () => {
    const config = await new YamlConfigReader(ROOT_CONFIG_PATH).loadConfig();

    expect(() => parseCondenserConfig(config.raw)).not.toThrow();
  });

  it('its atlassian section parses against the real parser', async () => {
    const config = await new YamlConfigReader(ROOT_CONFIG_PATH).loadConfig();

    expect(() => parseAtlassianAlmConfig(config.raw)).not.toThrow();
  });

  it('its layers section parses against the real parser', async () => {
    const config = await new YamlConfigReader(ROOT_CONFIG_PATH).loadConfig();

    expect(() => parseLayerPoolsConfig(config.raw)).not.toThrow();
  });

  it('its orchestration section parses against the real parser, selecting fixed_tri_planar', async () => {
    const config = await new YamlConfigReader(ROOT_CONFIG_PATH).loadConfig();

    expect(parseOrchestrationConfig(config.raw)).toEqual({ architecture: 'fixed_tri_planar' });
  });
});
