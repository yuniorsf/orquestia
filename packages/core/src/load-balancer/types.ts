export type ProviderStrategyName =
  'quota_aware' | 'least_cost' | 'latency_priority' | 'round_robin';

export interface ProviderEntry {
  readonly name: string;
  readonly provider: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly weight?: number;
  readonly priority?: number;
  /** Lower is cheaper; used by the `least_cost` strategy. */
  readonly costTier?: number;
  /** Lower is faster; used by the `latency_priority` strategy. */
  readonly latencyTier?: number;
}

export interface LayerConfig {
  readonly name: string;
  readonly enabled: boolean;
  readonly strategy: ProviderStrategyName;
  /** Whether a failed provider call should retry the next entry in `providers` (priority order) rather than fail immediately. */
  readonly primaryFallback: boolean;
  readonly providers: readonly ProviderEntry[];
}

export interface ProviderSelection {
  readonly layer: string;
  readonly provider: ProviderEntry;
}

/** Narrow quota-check port `quota_aware` depends on; `RateLimitTracker` already satisfies it structurally. */
export interface RateLimitCheckPort {
  isRateLimited(providerName: string): boolean;
}

export interface StrategyRouter {
  selectProvider(layer: LayerConfig): ProviderSelection;
}

export class UnknownLayerError extends Error {
  constructor(layerName: string) {
    super(`No layer named "${layerName}" is configured.`);
    this.name = 'UnknownLayerError';
  }
}

export class DisabledLayerError extends Error {
  constructor(layerName: string) {
    super(`Layer "${layerName}" is disabled.`);
    this.name = 'DisabledLayerError';
  }
}

export class NoProvidersAvailableError extends Error {
  constructor(layerName: string) {
    super(`No available providers for layer "${layerName}".`);
    this.name = 'NoProvidersAvailableError';
  }
}

export class UnknownStrategyError extends Error {
  constructor(strategy: string) {
    super(`Unknown provider strategy "${strategy}".`);
    this.name = 'UnknownStrategyError';
  }
}

export class InvalidLayerPoolsConfigError extends Error {
  constructor(message: string) {
    super(`Invalid "layers" config section in orquestia.config.yaml: ${message}`);
    this.name = 'InvalidLayerPoolsConfigError';
  }
}
