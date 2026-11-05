import { DurableApprovalManager, type ApprovalGateModes } from '@orquestia/core';
import { describe, expect, it } from 'vitest';
import { ApprovalsCommand } from './approvals-command.js';
import { FakeApprovalStateStore, FakeClock, FakeTokenGenerator } from './test-builders.js';

const GATE_MODES: ApprovalGateModes = {
  after_planning: 'auto',
  before_coding: 'prompt',
  before_rebase: 'auto',
  before_ship: 'manual_token',
};

function createCommand() {
  const manager = new DurableApprovalManager(
    new FakeApprovalStateStore(),
    new FakeClock(1_000),
    new FakeTokenGenerator(),
    GATE_MODES,
  );
  return new ApprovalsCommand(manager);
}

describe('ApprovalsCommand.run', () => {
  it('reports usage when the action or taskId is missing', async () => {
    const command = createCommand();

    const result = await command.run([]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: orquestia approvals');
  });

  it('reports usage when only the action is given', async () => {
    const command = createCommand();

    const result = await command.run(['list']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: orquestia approvals');
  });

  it('lists "No pending approvals." when nothing is pending', async () => {
    const command = createCommand();

    const result = await command.run(['list', 'task-1']);

    expect(result).toEqual({ exitCode: 0, stdout: 'No pending approvals.\n', stderr: '' });
  });

  it('lists every pending approval for the task', async () => {
    const command = createCommand();
    await command.run(['request', 'task-1', 'before_coding']);

    const result = await command.run(['list', 'task-1']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('task-1 before_coding pending (mode=prompt)\n');
  });

  it('rejects an unknown gate name', async () => {
    const command = createCommand();

    const result = await command.run(['request', 'task-1', 'not_a_gate']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown gate "not_a_gate"');
  });

  it('rejects a missing gate name', async () => {
    const command = createCommand();

    const result = await command.run(['request', 'task-1']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown gate ""');
  });

  it('auto-approves a request for an "auto" mode gate', async () => {
    const command = createCommand();

    const result = await command.run(['request', 'task-1', 'after_planning']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'task-1 after_planning approved (mode=auto)\n',
      stderr: '',
    });
  });

  it('approves a pending gate', async () => {
    const command = createCommand();
    await command.run(['request', 'task-1', 'before_coding']);

    const result = await command.run(['approve', 'task-1', 'before_coding']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'task-1 before_coding approved (mode=prompt)\n',
      stderr: '',
    });
  });

  it('approves a manual_token gate when the token matches', async () => {
    const command = createCommand();
    await command.run(['request', 'task-1', 'before_ship']);

    const result = await command.run(['approve', 'task-1', 'before_ship', 'fake-token-1']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('task-1 before_ship approved (mode=manual_token)\n');
  });

  it('rejects an approval with the wrong manual token', async () => {
    const command = createCommand();
    await command.run(['request', 'task-1', 'before_ship']);

    const result = await command.run(['approve', 'task-1', 'before_ship', 'wrong-token']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid or missing manual approval token');
  });

  it('rejects a pending gate', async () => {
    const command = createCommand();
    await command.run(['request', 'task-1', 'before_coding']);

    const result = await command.run(['reject', 'task-1', 'before_coding']);

    expect(result).toEqual({
      exitCode: 0,
      stdout: 'task-1 before_coding rejected (mode=prompt)\n',
      stderr: '',
    });
  });

  it('reports an error for approve/reject on a gate that was never requested', async () => {
    const command = createCommand();

    const result = await command.run(['approve', 'task-1', 'before_coding']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No approval record for task "task-1"');
  });

  it('rejects an unknown action', async () => {
    const command = createCommand();

    const result = await command.run(['bogus', 'task-1', 'before_coding']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown action "bogus"');
  });
});
