import type { ApprovalGateName, ApprovalRecord, DurableApprovalManager } from '@orquestia/core';
import type { CliCommand, CommandResult } from './types.js';

const GATE_NAMES: readonly ApprovalGateName[] = [
  'after_planning',
  'before_coding',
  'before_rebase',
  'before_ship',
];

function isApprovalGateName(value: string | undefined): value is ApprovalGateName {
  return GATE_NAMES.includes(value as ApprovalGateName);
}

function formatRecord(record: ApprovalRecord): string {
  return `${record.taskId} ${record.gate} ${record.decision} (mode=${record.mode})`;
}

/**
 * `orquestia approvals <request|list|approve|reject> <taskId> [gate] [token]`
 * — a thin CLI wrapper around the already-durable `DurableApprovalManager`
 * (`.orquestia/state.json`), covering the "approval gate management" half of
 * ORQ-26's command surface.
 */
export class ApprovalsCommand implements CliCommand {
  readonly name = 'approvals';
  readonly summary = 'Manage durable human-in-the-loop approval gates';

  constructor(private readonly manager: DurableApprovalManager) {}

  async run(args: readonly string[]): Promise<CommandResult> {
    const [action, taskId, gateArg, token] = args;

    if (!action || !taskId) {
      return {
        exitCode: 1,
        stdout: '',
        stderr:
          'Usage: orquestia approvals <request|list|approve|reject> <taskId> [gate] [token]\n',
      };
    }

    if (action === 'list') {
      const pending = await this.manager.listPending(taskId);
      return {
        exitCode: 0,
        stdout:
          pending.length === 0
            ? 'No pending approvals.\n'
            : `${pending.map(formatRecord).join('\n')}\n`,
        stderr: '',
      };
    }

    if (!isApprovalGateName(gateArg)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `Unknown gate "${gateArg ?? ''}". Expected one of: ${GATE_NAMES.join(', ')}\n`,
      };
    }

    try {
      const record = await this.dispatchAction(action, taskId, gateArg, token);
      return { exitCode: 0, stdout: `${formatRecord(record)}\n`, stderr: '' };
    } catch (error) {
      return { exitCode: 1, stdout: '', stderr: `${(error as Error).message}\n` };
    }
  }

  private async dispatchAction(
    action: string,
    taskId: string,
    gate: ApprovalGateName,
    token: string | undefined,
  ): Promise<ApprovalRecord> {
    switch (action) {
      case 'request':
        return this.manager.requestGate(taskId, gate);
      case 'approve':
        return this.manager.approve(taskId, gate, token);
      case 'reject':
        return this.manager.reject(taskId, gate);
      default:
        throw new Error(
          `Unknown action "${action}". Expected one of: request, list, approve, reject.`,
        );
    }
  }
}
