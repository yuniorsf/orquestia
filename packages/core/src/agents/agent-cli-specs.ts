import type { AgentCliSpec, AgentInvocationRequest } from './types.js';

function promptArgs(request: AgentInvocationRequest): readonly string[] {
  return ['-p', request.prompt];
}

/** `claude -p "<prompt>"`, run with the process `cwd` set to the task worktree. */
export const claudeCodeCliSpec: AgentCliSpec = {
  name: 'claude_code',
  executable: 'claude',
  buildArgs: promptArgs,
};

/**
 * `copilot -p "<prompt>" --allow-all-tools --silent`, run with the process
 * `cwd` set to the task worktree. `--silent` ("Output only the agent
 * response (no stats), useful for scripting with -p" per `copilot --help`)
 * keeps Copilot's own tool-call transcript and session-summary footer out
 * of stdout, so they can't be mistaken for part of the JSON answer this
 * protocol expects (see `extractJsonObject` in `../shared/json-response-extractor.js`).
 */
export const copilotCliSpec: AgentCliSpec = {
  name: 'copilot_cli',
  executable: 'copilot',
  buildArgs: (request) => [...promptArgs(request), '--allow-all-tools', '--silent'],
};

/**
 * Google Antigravity has no publicly documented headless CLI contract at
 * time of writing; this spec follows the same `-p "<prompt>"` convention
 * shared by {@link claudeCodeCliSpec}/{@link copilotCliSpec} and is the
 * override point (`AgentCliSpec.buildArgs`) once Antigravity ships one.
 */
export const antigravityCliSpec: AgentCliSpec = {
  name: 'antigravity',
  executable: 'antigravity',
  buildArgs: promptArgs,
};
