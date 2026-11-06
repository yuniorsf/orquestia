import { describe, expect, it } from 'vitest';
import { parseOrchestrationConfig } from './orchestration-config.js';
import { InvalidOrchestrationConfigError } from './types.js';

describe('parseOrchestrationConfig', () => {
  it('parses a fixed_tri_planar architecture with no further sub-section required', () => {
    const config = parseOrchestrationConfig({
      orchestration: { architecture: 'fixed_tri_planar' },
    });

    expect(config).toEqual({ architecture: 'fixed_tri_planar' });
  });

  it('parses a hierarchical_n_worker architecture with its worker list', () => {
    const raw = {
      orchestration: {
        architecture: 'hierarchical_n_worker',
        hierarchical_n_worker: {
          workers: [
            { name: 'architecture', agent: 'claude_code' },
            { name: 'contracts', agent: 'copilot_cli' },
          ],
        },
      },
    };

    const config = parseOrchestrationConfig(raw);

    expect(config).toEqual({
      architecture: 'hierarchical_n_worker',
      hierarchicalNWorker: {
        workers: [
          { name: 'architecture', agent: 'claude_code' },
          { name: 'contracts', agent: 'copilot_cli' },
        ],
      },
    });
  });

  it('throws when "orchestration" is missing', () => {
    expect(() => parseOrchestrationConfig({})).toThrow(InvalidOrchestrationConfigError);
  });

  it('throws when "orchestration.architecture" is missing', () => {
    expect(() => parseOrchestrationConfig({ orchestration: {} })).toThrow(
      InvalidOrchestrationConfigError,
    );
  });

  it('throws on an unknown architecture name', () => {
    expect(() =>
      parseOrchestrationConfig({ orchestration: { architecture: 'made_up_architecture' } }),
    ).toThrow(/Unknown "orchestration.architecture"/);
  });

  it('throws when hierarchical_n_worker is selected but its sub-section is missing', () => {
    expect(() =>
      parseOrchestrationConfig({ orchestration: { architecture: 'hierarchical_n_worker' } }),
    ).toThrow(InvalidOrchestrationConfigError);
  });

  it('throws when hierarchical_n_worker.workers is missing', () => {
    expect(() =>
      parseOrchestrationConfig({
        orchestration: { architecture: 'hierarchical_n_worker', hierarchical_n_worker: {} },
      }),
    ).toThrow('"orchestration.hierarchical_n_worker.workers" must be a non-empty list.');
  });

  it('throws when hierarchical_n_worker.workers is an empty list', () => {
    expect(() =>
      parseOrchestrationConfig({
        orchestration: {
          architecture: 'hierarchical_n_worker',
          hierarchical_n_worker: { workers: [] },
        },
      }),
    ).toThrow('"orchestration.hierarchical_n_worker.workers" must be a non-empty list.');
  });

  it('throws when a worker entry is missing "name"', () => {
    expect(() =>
      parseOrchestrationConfig({
        orchestration: {
          architecture: 'hierarchical_n_worker',
          hierarchical_n_worker: { workers: [{ agent: 'claude_code' }] },
        },
      }),
    ).toThrow('"orchestration.hierarchical_n_worker.workers[0].name" must be a non-empty string.');
  });

  it('throws when a worker entry is missing "agent"', () => {
    expect(() =>
      parseOrchestrationConfig({
        orchestration: {
          architecture: 'hierarchical_n_worker',
          hierarchical_n_worker: { workers: [{ name: 'architecture' }] },
        },
      }),
    ).toThrow('"orchestration.hierarchical_n_worker.workers[0].agent" must be a non-empty string.');
  });

  it('throws when a worker entry is not a mapping', () => {
    expect(() =>
      parseOrchestrationConfig({
        orchestration: {
          architecture: 'hierarchical_n_worker',
          hierarchical_n_worker: { workers: ['not-a-mapping'] },
        },
      }),
    ).toThrow('"orchestration.hierarchical_n_worker.workers[0]" must be a mapping.');
  });

  it('parses a handoff_swarm architecture with its ordered worker list', () => {
    const raw = {
      orchestration: {
        architecture: 'handoff_swarm',
        handoff_swarm: {
          workers: [
            { name: 'first', agent: 'claude_code' },
            { name: 'second', agent: 'copilot_cli' },
          ],
        },
      },
    };

    const config = parseOrchestrationConfig(raw);

    expect(config).toEqual({
      architecture: 'handoff_swarm',
      handoffSwarm: {
        workers: [
          { name: 'first', agent: 'claude_code' },
          { name: 'second', agent: 'copilot_cli' },
        ],
      },
    });
  });

  it('throws when handoff_swarm.workers is missing', () => {
    expect(() =>
      parseOrchestrationConfig({
        orchestration: { architecture: 'handoff_swarm', handoff_swarm: {} },
      }),
    ).toThrow('"orchestration.handoff_swarm.workers" must be a non-empty list.');
  });

  it('parses a blackboard architecture with its contributor list', () => {
    const raw = {
      orchestration: {
        architecture: 'blackboard',
        blackboard: {
          contributors: [
            { name: 'alpha', agent: 'claude_code' },
            { name: 'beta', agent: 'copilot_cli' },
          ],
        },
      },
    };

    const config = parseOrchestrationConfig(raw);

    expect(config).toEqual({
      architecture: 'blackboard',
      blackboard: {
        contributors: [
          { name: 'alpha', agent: 'claude_code' },
          { name: 'beta', agent: 'copilot_cli' },
        ],
      },
    });
  });

  it('throws when blackboard.contributors is missing', () => {
    expect(() =>
      parseOrchestrationConfig({ orchestration: { architecture: 'blackboard', blackboard: {} } }),
    ).toThrow('"orchestration.blackboard.contributors" must be a non-empty list.');
  });

  it('throws when blackboard is selected but its sub-section is missing', () => {
    expect(() =>
      parseOrchestrationConfig({ orchestration: { architecture: 'blackboard' } }),
    ).toThrow(InvalidOrchestrationConfigError);
  });
});
