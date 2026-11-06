import {
  InvalidOrchestrationConfigError,
  type OrchestrationConfig,
  type WorkerSpec,
} from './types.js';

/**
 * Parses the `orchestration:` section of `orquestia.config.yaml`,
 * discriminated by `orchestration.architecture` the same way
 * `parseLayerPoolsConfig` discriminates `layers:` entries by
 * `ProviderStrategyName`. Pure — no I/O; the raw YAML document is already
 * loaded by `ConfigReaderPort`.
 */
export function parseOrchestrationConfig(
  raw: Readonly<Record<string, unknown>>,
): OrchestrationConfig {
  const section = requireMapping(raw.orchestration, 'orchestration');
  const architecture = requireString(section.architecture, 'orchestration.architecture');

  if (architecture === 'fixed_tri_planar') {
    return { architecture };
  }

  if (architecture === 'hierarchical_n_worker') {
    const hnwRaw = requireMapping(
      section.hierarchical_n_worker,
      'orchestration.hierarchical_n_worker',
    );
    const workers = parseWorkerSpecList(
      hnwRaw.workers,
      'orchestration.hierarchical_n_worker.workers',
    );
    return { architecture, hierarchicalNWorker: { workers } };
  }

  if (architecture === 'handoff_swarm') {
    const handoffRaw = requireMapping(section.handoff_swarm, 'orchestration.handoff_swarm');
    const workers = parseWorkerSpecList(handoffRaw.workers, 'orchestration.handoff_swarm.workers');
    return { architecture, handoffSwarm: { workers } };
  }

  if (architecture === 'blackboard') {
    const blackboardRaw = requireMapping(section.blackboard, 'orchestration.blackboard');
    const contributors = parseWorkerSpecList(
      blackboardRaw.contributors,
      'orchestration.blackboard.contributors',
    );
    return { architecture, blackboard: { contributors } };
  }

  throw new InvalidOrchestrationConfigError(
    `Unknown "orchestration.architecture": "${architecture}".`,
  );
}

function parseWorkerSpecList(value: unknown, path: string): readonly WorkerSpec[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidOrchestrationConfigError(`"${path}" must be a non-empty list.`);
  }
  return value.map((entry, index) => parseWorkerSpec(entry, `${path}[${index}]`));
}

function parseWorkerSpec(value: unknown, path: string): WorkerSpec {
  const entry = requireMapping(value, path);
  return {
    name: requireString(entry.name, `${path}.name`),
    agent: requireString(entry.agent, `${path}.agent`),
  };
}

function requireMapping(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidOrchestrationConfigError(`"${path}" must be a mapping.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidOrchestrationConfigError(`"${path}" must be a non-empty string.`);
  }
  return value;
}
