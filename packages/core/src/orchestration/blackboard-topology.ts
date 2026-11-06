import type { Clock } from '../shared/clock.js';
import type { SpecialistOutput } from '../planning/types.js';
import { EmptyWorkerListError } from './hierarchical-n-worker-topology.js';
import type {
  OrchestrationResult,
  OrchestrationTopologyPort,
  WorkerDispatcherPort,
  WorkerSpec,
} from './types.js';

interface Contribution {
  readonly worker: WorkerSpec;
  readonly output: SpecialistOutput;
  readonly writtenAt: number;
}

/**
 * Last-writer-wins merge: for any file path proposed by more than one
 * contributor, only the contribution with the latest `writtenAt` keeps that
 * path in its own manifest — ties broken by `contributions` array order
 * (earlier contributor wins), keeping the result deterministic rather than
 * dependent on `Promise.all`'s resolution order. This resolves the conflict
 * entirely upstream, before anything is written to the real worktree —
 * which is why the Oracle's disjoint-ownership Gate 1 (`verify_scopes` /
 * `verify_worker_scopes`) needs no blackboard-specific variant: it already
 * degrades to a no-op when no `--scope-a`/`--scope-b`/`--worker-scope`
 * flags are passed, which is exactly correct here — shared, opportunistic
 * ownership is blackboard's whole premise, not a violation to catch.
 */
function mergeLastWriterWins(
  contributions: readonly Contribution[],
): ReadonlyMap<string, SpecialistOutput> {
  const winningContributionIndexByPath = new Map<string, number>();

  contributions.forEach((contribution, index) => {
    for (const entry of contribution.output.fileManifest) {
      const currentWinnerIndex = winningContributionIndexByPath.get(entry.path);
      if (currentWinnerIndex === undefined) {
        winningContributionIndexByPath.set(entry.path, index);
        continue;
      }
      const currentWinner = contributions[currentWinnerIndex] as Contribution;
      if (contribution.writtenAt > currentWinner.writtenAt) {
        winningContributionIndexByPath.set(entry.path, index);
      }
    }
  });

  const outputs = new Map<string, SpecialistOutput>();
  contributions.forEach((contribution, index) => {
    const retainedManifest = contribution.output.fileManifest.filter(
      (entry) => winningContributionIndexByPath.get(entry.path) === index,
    );
    outputs.set(contribution.worker.name, {
      ...contribution.output,
      fileManifest: retainedManifest,
    });
  });

  return outputs;
}

/**
 * Shared mutable workspace: every configured contributor is dispatched in
 * parallel and may legitimately claim the same file path as another —
 * resolved by {@link mergeLastWriterWins} rather than rejected, the
 * opposite premise from every other topology's disjoint-ownership
 * invariant. See `orchestration.blackboard.contributors[]`.
 */
export class BlackboardTopology implements OrchestrationTopologyPort {
  readonly architecture = 'blackboard';

  constructor(
    private readonly contributors: readonly WorkerSpec[],
    private readonly dispatcher: WorkerDispatcherPort,
    private readonly clock: Clock,
  ) {
    if (contributors.length === 0) {
      throw new EmptyWorkerListError();
    }
  }

  async dispatch(): Promise<OrchestrationResult> {
    const contributions = await Promise.all(
      this.contributors.map(async (worker): Promise<Contribution> => ({
        worker,
        output: await this.dispatcher.dispatch(worker),
        writtenAt: this.clock.now(),
      })),
    );

    return { outputs: mergeLastWriterWins(contributions) };
  }
}
