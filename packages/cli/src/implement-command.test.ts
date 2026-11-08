import { describe, expect, it } from 'vitest';
import { ImplementCommand } from './implement-command.js';
import { FakeCommand } from './test-builders.js';

describe('ImplementCommand', () => {
  it('reports usage with exit 1 when taskId is missing', async () => {
    const command = new ImplementCommand({ buildCodeCommand: () => new FakeCommand('code', '') });

    const result = await command.run([]);

    expect(result).toEqual({
      exitCode: 1,
      stdout: '',
      stderr: 'Usage: orquestia implement <taskId> "<prompt text>" [--ship]\n',
    });
  });

  it('reports usage with exit 1 when the prompt is missing', async () => {
    const command = new ImplementCommand({ buildCodeCommand: () => new FakeCommand('code', '') });

    const result = await command.run(['ORQ-47']);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage: orquestia implement');
  });

  it('reports usage with exit 1 when only --ship is passed', async () => {
    const command = new ImplementCommand({ buildCodeCommand: () => new FakeCommand('code', '') });

    const result = await command.run(['--ship']);

    expect(result.exitCode).toBe(1);
  });

  it('builds the code command with the joined free-text prompt and runs it with taskId', async () => {
    let capturedDescription: string | undefined;
    const fake = new FakeCommand('code', '', { exitCode: 0, stdout: 'ok\n', stderr: '' });
    const command = new ImplementCommand({
      buildCodeCommand: (taskDescription) => {
        capturedDescription = taskDescription;
        return fake;
      },
    });

    const result = await command.run(['ORQ-47', 'add', 'a', 'retry', 'flag']);

    expect(capturedDescription).toBe('add a retry flag');
    expect(fake.calls).toEqual([['ORQ-47']]);
    expect(result).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' });
  });

  it('forwards --ship to the built code command regardless of its position', async () => {
    const fake = new FakeCommand('code', '');
    const command = new ImplementCommand({ buildCodeCommand: () => fake });

    await command.run(['--ship', 'ORQ-47', 'add', 'feature']);

    expect(fake.calls).toEqual([['ORQ-47', '--ship']]);
  });

  it('propagates the built code command exit code and output unchanged', async () => {
    const fake = new FakeCommand('code', '', {
      exitCode: 2,
      stdout: 'Code synthesis failed\n',
      stderr: '',
    });
    const command = new ImplementCommand({ buildCodeCommand: () => fake });

    const result = await command.run(['ORQ-47', 'add', 'feature']);

    expect(result).toEqual({ exitCode: 2, stdout: 'Code synthesis failed\n', stderr: '' });
  });

  it('exposes name and a non-empty summary', () => {
    const command = new ImplementCommand({ buildCodeCommand: () => new FakeCommand('code', '') });
    expect(command.name).toBe('implement');
    expect(command.summary).not.toBe('');
  });
});
