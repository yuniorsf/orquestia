import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlanSpecWriterPort } from './types.js';

/**
 * Writes the verified plan Markdown to `<specsDir>/plan-<taskId>.md`
 * (`.orquestia/specs/` by default), creating the directory if needed.
 */
export class FsPlanSpecWriter implements PlanSpecWriterPort {
  constructor(private readonly specsDir: string) {}

  async writeSpec(taskId: string, markdown: string): Promise<string> {
    await mkdir(this.specsDir, { recursive: true });
    const specPath = join(this.specsDir, `plan-${taskId}.md`);
    await writeFile(specPath, markdown, 'utf8');
    return specPath;
  }
}
