import type {
  CheckpointPort,
  CodeSynthesisDispatcherPort,
  CodingOracleResult,
  CodingRemediationDispatcherPort,
  CodingSelfHealOutcome,
  CodingTaskManifest,
  CommandRunnerPort,
  ManifestConflictRemediationDispatcherPort,
  OracleCommands,
  RebaseAndVerifyResult,
  ShipOutcome,
  ShipSpec,
  SpecialistDispatcherPort,
  WorktreeHandle,
  WorktreeProvisioner,
} from '@orquestia/core';
import {
  CodeSynthesisDispatchService,
  CodingOracleRunner,
  CodingSelfHealingService,
  CodingTaskProvisioningService,
  DisjointAllocationError,
  DisjointAllocationValidator,
  ManifestConflictSelfHealingService,
  PlanDispatchService,
  RebaseAndReverifyService,
} from '@orquestia/core';
import type { CliCommand, CommandResult } from './types.js';

export interface CodeShipService {
  ship(taskId: string, oracleResult: CodingOracleResult, spec: ShipSpec): Promise<ShipOutcome>;
}

export interface CodeCommandDependencies {
  readonly repoBaseRef: string;
  readonly worktreeProvisioner: WorktreeProvisioner;
  readonly checkpointFactory: (worktree: WorktreeHandle) => CheckpointPort;
  readonly commandRunnerFactory: (worktree: WorktreeHandle) => CommandRunnerPort;
  readonly planDispatcherFactory: (taskId: string) => SpecialistDispatcherPort;
  readonly manifestConflictRemediationDispatcherFactory: (
    taskId: string,
  ) => ManifestConflictRemediationDispatcherPort;
  readonly codeSynthesisDispatcherFactory: () => CodeSynthesisDispatcherPort;
  readonly remediationDispatcherFactory: (
    worktree: WorktreeHandle,
    commandRunner: CommandRunnerPort,
    oracleCommands: OracleCommands,
  ) => CodingRemediationDispatcherPort;
  readonly oracleCommandsFactory: (manifest: CodingTaskManifest) => OracleCommands;
  readonly shipServiceFactory: (commandRunner: CommandRunnerPort) => CodeShipService;
  readonly maxSelfHealRetries: number;
}

function formatSelfHeal(outcome: CodingSelfHealOutcome): string {
  const lines = [`Deterministic Coding Oracle: ${outcome.status.toUpperCase()}`];
  for (const attempt of outcome.attempts) {
    const status = attempt.result.passed ? 'passed' : `failed (exit ${attempt.result.exitCode})`;
    lines.push(
      `  Attempt ${attempt.attempt}: ${status}${attempt.rolledBack ? ' — rolled back checkpoint' : ''}`,
    );
  }
  return lines.join('\n');
}

/**
 * `orquestia code <taskId> [--ship]` — the full 5-phase Coding DAG:
 * decides the file manifest by reusing the Planning DAG's specialist
 * dispatch (ORQ-34), with a bounded informed-retry pass on a disjoint-
 * ownership collision before provisioning (ORQ-49), provisions an
 * isolated worktree, dispatches real
 * code synthesis (agents generate file contents as JSON; the dispatcher
 * writes them — no unsupervised tool access), runs the 4-stage
 * Deterministic Oracle with bounded self-healing, rebases onto
 * `repoBaseRef` with a mandatory re-verify, and — only with `--ship` —
 * commits/pushes/opens a PR. Every real adapter is injected via
 * {@link CodeCommandDependencies} so the command itself has no `fs`/`git`
 * calls of its own.
 */
export class CodeCommand implements CliCommand {
  readonly name = 'code';
  readonly summary = 'Run the Coding DAG (domain implementation + verification)';

  constructor(private readonly deps: CodeCommandDependencies) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    const [taskId] = args;
    if (!taskId) {
      return { exitCode: 1, stdout: '', stderr: 'Usage: orquestia code <taskId> [--ship]\n' };
    }
    const ship = args.includes('--ship');

    let manifest: CodingTaskManifest;
    try {
      manifest = await this.decideManifest(taskId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Manifest decomposition failed for "${taskId}": ${message}\n`,
      };
    }

    let worktree: WorktreeHandle;
    try {
      worktree = await new CodingTaskProvisioningService(
        new DisjointAllocationValidator(),
        this.deps.worktreeProvisioner,
      ).provision(taskId, this.deps.repoBaseRef, manifest);
    } catch (error) {
      if (error instanceof DisjointAllocationError) {
        return { exitCode: 1, stdout: '', stderr: `${error.message}\n` };
      }
      throw error;
    }

    const synthesisDispatcher = this.deps.codeSynthesisDispatcherFactory();
    await new CodeSynthesisDispatchService(synthesisDispatcher).dispatchBoth(worktree, manifest);

    const commandRunner = this.deps.commandRunnerFactory(worktree);
    const oracleCommands = this.deps.oracleCommandsFactory(manifest);
    const remediationDispatcher = this.deps.remediationDispatcherFactory(
      worktree,
      commandRunner,
      oracleCommands,
    );

    const selfHeal = await new CodingSelfHealingService(
      new CodingOracleRunner(commandRunner),
      this.deps.checkpointFactory(worktree),
      remediationDispatcher,
      { maxRetries: this.deps.maxSelfHealRetries },
    ).run(oracleCommands);

    if (selfHeal.status !== 'passed') {
      return {
        exitCode: 2,
        stdout: `${formatSelfHeal(selfHeal)}\nWorktree left at ${worktree.path} for inspection.\n`,
        stderr: '',
      };
    }

    const rebase = await this.rebaseAndReverify(commandRunner, oracleCommands);
    if (rebase.rebase.status !== 'clean' || !rebase.oracle || !rebase.oracle.passed) {
      return {
        exitCode: 2,
        stdout: `${formatSelfHeal(selfHeal)}\nRebase/re-verify failed: ${JSON.stringify(rebase.rebase)}\nWorktree left at ${worktree.path} for inspection.\n`,
        stderr: '',
      };
    }

    if (!ship) {
      return {
        exitCode: 0,
        stdout: `${formatSelfHeal(selfHeal)}\nVerified and rebased onto ${this.deps.repoBaseRef}. Worktree left uncommitted at ${worktree.path} for review.\n`,
        stderr: '',
      };
    }

    const shipOutcome = await this.deps
      .shipServiceFactory(commandRunner)
      .ship(taskId, rebase.oracle, {
        worktree,
        commitMessage: `feat: implement ${taskId}\n\n(${taskId})`,
        baseBranch: this.deps.repoBaseRef.replace(/^origin\//, ''),
        prTitle: `${taskId}: implement`,
        prBody: `Implements ${taskId}.`,
        issueKey: null,
        jiraTargetStatus: 'Done',
      });

    if (shipOutcome.status === 'failed') {
      return {
        exitCode: 2,
        stdout: `${formatSelfHeal(selfHeal)}\nShip failed at step "${shipOutcome.failedStep}": ${shipOutcome.reason}\n`,
        stderr: '',
      };
    }

    return {
      exitCode: 0,
      stdout: `${formatSelfHeal(selfHeal)}\nShipped: ${shipOutcome.pullRequestUrl}\n`,
      stderr: '',
    };
  }

  private async decideManifest(taskId: string): Promise<CodingTaskManifest> {
    const dispatcher = this.deps.planDispatcherFactory(taskId);
    const { branchA, branchB } = await new PlanDispatchService(dispatcher).dispatchBoth();

    // ORQ-49: 2A/2B decide independently and in parallel, with no
    // visibility into each other's claims — give 2B a bounded, informed
    // retry (told exactly which paths 2A already has) before falling
    // through to CodingTaskProvisioningService's own DisjointAllocationError.
    const remediationDispatcher = this.deps.manifestConflictRemediationDispatcherFactory(taskId);
    const healed = await new ManifestConflictSelfHealingService(remediationDispatcher, {
      maxRetries: 2,
    }).run(branchA, branchB);

    return {
      coreLogicSpec: healed.branchA.fileManifest,
      testAndBoilerplateSpec: healed.branchB.fileManifest,
    };
  }

  private async rebaseAndReverify(
    commandRunner: CommandRunnerPort,
    oracleCommands: OracleCommands,
  ): Promise<RebaseAndVerifyResult> {
    const service = new RebaseAndReverifyService(
      commandRunner,
      new CodingOracleRunner(commandRunner),
    );
    return service.run(this.deps.repoBaseRef, oracleCommands);
  }
}
