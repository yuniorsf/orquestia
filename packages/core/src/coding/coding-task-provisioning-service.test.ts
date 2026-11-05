import { describe, expect, it } from 'vitest';
import { FakeWorktreeProvisioner } from '../workspace/test-builders.js';
import { CodingTaskProvisioningService } from './coding-task-provisioning-service.js';
import { DisjointAllocationValidator } from './disjoint-allocation-validator.js';
import { DisjointAllocationError, type CodingTaskManifest } from './types.js';

function createService() {
  const worktreeProvisioner = new FakeWorktreeProvisioner();
  const service = new CodingTaskProvisioningService(
    new DisjointAllocationValidator(),
    worktreeProvisioner,
  );
  return { service, worktreeProvisioner };
}

describe('CodingTaskProvisioningService.provision', () => {
  it('provisions a worktree when the allocation is disjoint', async () => {
    const { service, worktreeProvisioner } = createService();
    const manifest: CodingTaskManifest = {
      coreLogicSpec: [{ path: 'packages/core/src/foo/bar.ts', kind: 'NEW' }],
      testAndBoilerplateSpec: [{ path: 'packages/core/src/foo/bar.test.ts', kind: 'NEW' }],
    };

    const handle = await service.provision('ORQ-99-example', 'origin/develop', manifest);

    expect(handle).toEqual({
      taskId: 'ORQ-99-example',
      path: '/worktrees/ORQ-99-example',
      branch: 'orq-99-example',
    });
    expect(worktreeProvisioner.createCalls).toEqual([
      { taskId: 'ORQ-99-example', baseRef: 'origin/develop' },
    ]);
  });

  it('rejects and never provisions a worktree when the allocation overlaps', async () => {
    const { service, worktreeProvisioner } = createService();
    const sharedPath = 'packages/core/src/foo/bar.ts';
    const manifest: CodingTaskManifest = {
      coreLogicSpec: [{ path: sharedPath, kind: 'NEW' }],
      testAndBoilerplateSpec: [{ path: sharedPath, kind: 'NEW' }],
    };

    await expect(service.provision('ORQ-99-example', 'origin/develop', manifest)).rejects.toThrow(
      DisjointAllocationError,
    );
    expect(worktreeProvisioner.createCalls).toEqual([]);
  });
});
