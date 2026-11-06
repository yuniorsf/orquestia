import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseOrchestrationConfig, YamlConfigReader } from '@orquestia/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = process.cwd();
const GENERATOR_SCRIPT = join(REPO_ROOT, 'scripts', 'init-orchestration.sh');

const GOVERNANCE_FILES = [
  'CLAUDE.md',
  '.github/copilot-instructions.md',
  '.claude/skills/code-gen-dag/SKILL.md',
  '.github/skills/code-gen-dag/SKILL.md',
  '.agents/skills/code-gen-dag/SKILL.md',
  '.claude/commands/code-gen-dag.md',
  '.claude/skills/plan-gen-dag/SKILL.md',
  '.github/skills/plan-gen-dag/SKILL.md',
  '.agents/skills/plan-gen-dag/SKILL.md',
  '.claude/commands/plan-gen-dag.md',
  '.antigravity/workflows/code-gen-dag.md',
  '.antigravity/workflows/plan-gen-dag.md',
  '.antigravity/workflows/code-gen-dag.json',
  '.antigravity/workflows/plan-gen-dag.json',
];

let scratchDir: string;

beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'orquestia-init-orchestration-'));
});

afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

function runGenerator(args: readonly string[]): void {
  execFileSync(GENERATOR_SCRIPT, args, { stdio: 'pipe' });
}

describe('scripts/init-orchestration.sh — fixed_tri_planar', () => {
  it('reproduces every currently-committed governance file byte-for-byte', async () => {
    runGenerator(['fixed_tri_planar', '--target-dir', scratchDir]);

    for (const relativePath of GOVERNANCE_FILES) {
      const generated = await readFile(join(scratchDir, relativePath), 'utf8');
      const committed = await readFile(join(REPO_ROOT, relativePath), 'utf8');
      expect(generated, `${relativePath} should be byte-identical to the committed file`).toBe(
        committed,
      );
    }
  });

  it('rejects worker arguments, since fixed_tri_planar takes none', () => {
    expect(() =>
      runGenerator(['fixed_tri_planar', '--target-dir', scratchDir, 'a:claude_code']),
    ).toThrow();
  });
});

describe('scripts/init-orchestration.sh — hierarchical_n_worker', () => {
  it('rejects being run with zero worker arguments', () => {
    expect(() => runGenerator(['hierarchical_n_worker', '--target-dir', scratchDir])).toThrow();
  });

  it('generates worker-list-aware governance files across all three planes', async () => {
    runGenerator([
      'hierarchical_n_worker',
      '--target-dir',
      scratchDir,
      'architecture:claude_code',
      'contracts:copilot_cli',
    ]);

    const claudeMd = await readFile(join(scratchDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('architecture');
    expect(claudeMd).toContain('contracts');
    expect(claudeMd).toContain('currently **2** configured');

    const copilotInstructions = await readFile(
      join(scratchDir, '.github/copilot-instructions.md'),
      'utf8',
    );
    expect(copilotInstructions).toContain('Currently: **contracts**');

    for (const mirrorPaths of [
      [
        '.claude/skills/code-gen-dag/SKILL.md',
        '.github/skills/code-gen-dag/SKILL.md',
        '.agents/skills/code-gen-dag/SKILL.md',
        '.claude/commands/code-gen-dag.md',
      ],
      [
        '.claude/skills/plan-gen-dag/SKILL.md',
        '.github/skills/plan-gen-dag/SKILL.md',
        '.agents/skills/plan-gen-dag/SKILL.md',
        '.claude/commands/plan-gen-dag.md',
      ],
    ]) {
      const [first, ...rest] = mirrorPaths;
      const firstContent = await readFile(join(scratchDir, first as string), 'utf8');
      for (const mirrorPath of rest) {
        const mirrorContent = await readFile(join(scratchDir, mirrorPath), 'utf8');
        expect(mirrorContent, `${mirrorPath} should mirror ${first}`).toBe(firstContent);
      }
    }

    const codeGenDagJson = JSON.parse(
      await readFile(join(scratchDir, '.antigravity/workflows/code-gen-dag.json'), 'utf8'),
    ) as {
      metadata: { workerCount: number };
      agents: { workers: Array<{ id: string }> };
      phases: Array<{ branches?: Array<{ branchId: string }> }>;
    };
    expect(codeGenDagJson.metadata.workerCount).toBe(2);
    expect(codeGenDagJson.agents.workers.map((w) => w.id)).toEqual(['architecture', 'contracts']);
    expect(codeGenDagJson.phases[1]?.branches?.map((b) => b.branchId)).toEqual([
      'architecture',
      'contracts',
    ]);

    const planGenDagJson = JSON.parse(
      await readFile(join(scratchDir, '.antigravity/workflows/plan-gen-dag.json'), 'utf8'),
    ) as { metadata: { workerCount: number } };
    expect(planGenDagJson.metadata.workerCount).toBe(2);
  });

  it('appends a parseable orchestration: section to an existing orquestia.config.yaml', async () => {
    const configPath = join(scratchDir, 'orquestia.config.yaml');
    await writeFile(configPath, 'version: "3.0"\nproject_name: "Test"\n', 'utf8');

    runGenerator([
      'hierarchical_n_worker',
      '--target-dir',
      scratchDir,
      'architecture:claude_code',
      'contracts:copilot_cli',
    ]);

    const config = await new YamlConfigReader(configPath).loadConfig();
    const orchestration = parseOrchestrationConfig(config.raw);

    expect(orchestration).toEqual({
      architecture: 'hierarchical_n_worker',
      hierarchicalNWorker: {
        workers: [
          { name: 'architecture', agent: 'claude_code' },
          { name: 'contracts', agent: 'copilot_cli' },
        ],
      },
    });
  });

  it('does not overwrite an orquestia.config.yaml that already has an orchestration: section', async () => {
    const configPath = join(scratchDir, 'orquestia.config.yaml');
    const original =
      'version: "3.0"\nproject_name: "Test"\n\norchestration:\n  architecture: "fixed_tri_planar"\n';
    await writeFile(configPath, original, 'utf8');

    runGenerator(['hierarchical_n_worker', '--target-dir', scratchDir, 'architecture:claude_code']);

    const afterRun = await readFile(configPath, 'utf8');
    expect(afterRun).toBe(original);
  });

  it('skips the orchestration: section entirely when orquestia.config.yaml does not exist', async () => {
    runGenerator(['hierarchical_n_worker', '--target-dir', scratchDir, 'architecture:claude_code']);

    await expect(readFile(join(scratchDir, 'orquestia.config.yaml'), 'utf8')).rejects.toThrow();
  });
});

describe('scripts/init-orchestration.sh — handoff_swarm', () => {
  it('rejects being run with zero worker arguments', () => {
    expect(() => runGenerator(['handoff_swarm', '--target-dir', scratchDir])).toThrow();
  });

  it('generates a sequential handoff chain reflecting the given argument order', async () => {
    runGenerator([
      'handoff_swarm',
      '--target-dir',
      scratchDir,
      'first:claude_code',
      'second:copilot_cli',
    ]);

    const claudeMd = await readFile(join(scratchDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('dispatched **in this order**');
    expect(claudeMd).toContain('currently **2** configured');

    const codeGenDagJson = JSON.parse(
      await readFile(join(scratchDir, '.antigravity/workflows/code-gen-dag.json'), 'utf8'),
    ) as {
      metadata: { workerCount: number };
      phases: Array<{ chain?: Array<{ branchId: string }> }>;
    };
    expect(codeGenDagJson.metadata.workerCount).toBe(2);
    expect(codeGenDagJson.phases[1]?.chain?.map((c) => c.branchId)).toEqual(['first', 'second']);

    const codeGenDagMd = await readFile(
      join(scratchDir, '.antigravity/workflows/code-gen-dag.md'),
      'utf8',
    );
    expect(codeGenDagMd).toContain('W0 --> W1');
    expect(codeGenDagMd).toContain('W1 --> P3');
  });

  it('appends a parseable orchestration: section keyed by "workers"', async () => {
    const configPath = join(scratchDir, 'orquestia.config.yaml');
    await writeFile(configPath, 'version: "3.0"\nproject_name: "Test"\n', 'utf8');

    runGenerator([
      'handoff_swarm',
      '--target-dir',
      scratchDir,
      'first:claude_code',
      'second:copilot_cli',
    ]);

    const config = await new YamlConfigReader(configPath).loadConfig();
    const orchestration = parseOrchestrationConfig(config.raw);

    expect(orchestration).toEqual({
      architecture: 'handoff_swarm',
      handoffSwarm: {
        workers: [
          { name: 'first', agent: 'claude_code' },
          { name: 'second', agent: 'copilot_cli' },
        ],
      },
    });
  });
});

describe('scripts/init-orchestration.sh — blackboard', () => {
  it('rejects being run with zero contributor arguments', () => {
    expect(() => runGenerator(['blackboard', '--target-dir', scratchDir])).toThrow();
  });

  it('generates shared-workspace governance files with no disjoint-ownership language', async () => {
    runGenerator([
      'blackboard',
      '--target-dir',
      scratchDir,
      'alpha:claude_code',
      'beta:copilot_cli',
    ]);

    const claudeMd = await readFile(join(scratchDir, 'CLAUDE.md'), 'utf8');
    expect(claudeMd).toContain('do NOT own disjoint file paths');
    expect(claudeMd).toContain('currently **2** configured');

    const copilotInstructions = await readFile(
      join(scratchDir, '.github/copilot-instructions.md'),
      'utf8',
    );
    expect(copilotInstructions).toContain('Currently: **beta**');
    expect(copilotInstructions).not.toContain('--worker-scope "<your-worker-name>');

    const codeGenDagJson = JSON.parse(
      await readFile(join(scratchDir, '.antigravity/workflows/code-gen-dag.json'), 'utf8'),
    ) as { metadata: { workerCount: number; conflictResolution: string } };
    expect(codeGenDagJson.metadata.workerCount).toBe(2);
    expect(codeGenDagJson.metadata.conflictResolution).toBe('last_writer_wins');
  });

  it('appends a parseable orchestration: section keyed by "contributors"', async () => {
    const configPath = join(scratchDir, 'orquestia.config.yaml');
    await writeFile(configPath, 'version: "3.0"\nproject_name: "Test"\n', 'utf8');

    runGenerator([
      'blackboard',
      '--target-dir',
      scratchDir,
      'alpha:claude_code',
      'beta:copilot_cli',
    ]);

    const config = await new YamlConfigReader(configPath).loadConfig();
    const orchestration = parseOrchestrationConfig(config.raw);

    expect(orchestration).toEqual({
      architecture: 'blackboard',
      blackboard: {
        contributors: [
          { name: 'alpha', agent: 'claude_code' },
          { name: 'beta', agent: 'copilot_cli' },
        ],
      },
    });
  });
});
