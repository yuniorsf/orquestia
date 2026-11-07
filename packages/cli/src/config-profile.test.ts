import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG_FILENAME,
  InvalidConfigProfileError,
  parseConfigSelector,
  resolveConfigPath,
} from './config-profile.js';

describe('parseConfigSelector', () => {
  it('returns an undefined profile and leaves argv untouched when the flag is absent', () => {
    expect(parseConfigSelector(['code', 'task-1', '--ship'])).toEqual({
      profile: undefined,
      rest: ['code', 'task-1', '--ship'],
    });
  });

  it('reads --config <name> and strips both tokens, regardless of position', () => {
    expect(parseConfigSelector(['--config', 'staging', 'plan', 'task-1'])).toEqual({
      profile: 'staging',
      rest: ['plan', 'task-1'],
    });
    expect(parseConfigSelector(['plan', 'task-1', '--config', 'staging'])).toEqual({
      profile: 'staging',
      rest: ['plan', 'task-1'],
    });
  });

  it('takes the last occurrence when --config is given more than once', () => {
    expect(parseConfigSelector(['--config', 'a', '--config', 'b']).profile).toBe('b');
  });

  it('leaves a dangling --config (no value) in rest, with an undefined profile', () => {
    expect(parseConfigSelector(['plan', '--config'])).toEqual({
      profile: undefined,
      rest: ['plan', '--config'],
    });
  });
});

describe('resolveConfigPath', () => {
  it('defaults to <cwd>/orquestia.config.yaml when no profile is given', () => {
    expect(resolveConfigPath('/repo', undefined)).toBe(join('/repo', DEFAULT_CONFIG_FILENAME));
  });

  it('resolves a named profile to <cwd>/.orquestia/configs/<name>.yaml', () => {
    expect(resolveConfigPath('/repo', 'staging')).toBe(
      join('/repo', '.orquestia', 'configs', 'staging.yaml'),
    );
  });

  it('accepts profile names with dots, underscores, and hyphens', () => {
    expect(resolveConfigPath('/repo', 'local-only_v2.test')).toBe(
      join('/repo', '.orquestia', 'configs', 'local-only_v2.test.yaml'),
    );
  });

  it('throws InvalidConfigProfileError for a profile name containing a path separator', () => {
    expect(() => resolveConfigPath('/repo', '../escape')).toThrow(InvalidConfigProfileError);
    expect(() => resolveConfigPath('/repo', 'sub/dir')).toThrow(InvalidConfigProfileError);
  });

  it('throws InvalidConfigProfileError for an empty profile name', () => {
    expect(() => resolveConfigPath('/repo', '')).toThrow(InvalidConfigProfileError);
  });
});
