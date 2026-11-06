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
 * `agy -p "<prompt>" --mode plan --dangerously-skip-permissions`, run with
 * the process `cwd` set to the task worktree. `agy` is Google Antigravity's
 * real headless CLI binary (confirmed via `agy --help`); `antigravity` only
 * launches the desktop editor. `--mode plan` structurally prevents it from
 * editing files at all — consistent with every other agent here, since
 * Orquestia never lets an agent write via its own tools; it always parses
 * the agent's JSON response and writes the files itself.
 * `--dangerously-skip-permissions` is still required alongside `--mode
 * plan`: a headless `-p` run has no TTY to answer a permission prompt for
 * whatever read-only tool calls (e.g. reading a file) plan mode does allow,
 * so without it such a call would hang forever instead of being denied.
 */
export const antigravityCliSpec: AgentCliSpec = {
  name: 'antigravity',
  executable: 'agy',
  buildArgs: (request) => [
    ...promptArgs(request),
    '--mode',
    'plan',
    '--dangerously-skip-permissions',
  ],
};
