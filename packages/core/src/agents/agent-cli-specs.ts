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

interface AgyPrintModeEnvelope {
  readonly status?: unknown;
  readonly response?: unknown;
}

/**
 * `agy --output-format json` wraps the actual answer in an envelope —
 * `{"status":"SUCCESS","response":"<answer>",...}` — confirmed directly
 * against a real `agy` invocation, not assumed. Unwraps it to the answer
 * text `extractJsonObject`/`JSON.parse` actually need. Falls back to the
 * raw text unchanged (not a throw) whenever the envelope doesn't parse or
 * `response` isn't a string — e.g. a future error-status shape with no
 * `response` field — so a genuinely malformed/absent answer still reaches
 * the existing `Malformed*OutputError` paths downstream with something to
 * report, rather than this helper swallowing it.
 */
function extractAgyResponse(rawStdout: string): string {
  let parsed: AgyPrintModeEnvelope;
  try {
    parsed = JSON.parse(rawStdout) as AgyPrintModeEnvelope;
  } catch {
    return rawStdout;
  }
  return typeof parsed.response === 'string' ? parsed.response : rawStdout;
}

/**
 * `agy -p "<prompt>" --mode plan --dangerously-skip-permissions
 * --output-format json`, run with the process `cwd` set to the task
 * worktree. `agy` is Google Antigravity's real headless CLI binary
 * (confirmed via `agy --help`); `antigravity` only launches the desktop
 * editor.
 *
 * `--mode plan` alone is NOT "read-only" the way the name suggests: a real
 * run confirmed it instead does actual planning work (exploring the repo,
 * writing its own `implementation_plan.md` outside the project) and
 * answers conversationally, taking minutes and never emitting the bare
 * JSON this protocol needs. `--output-format json` fixes both: a real
 * invocation with it returned in ~5s with the prompt's exact requested
 * text, instead of free-form prose. `extractResponse` above unwraps its
 * envelope shape.
 *
 * `--dangerously-skip-permissions` is still required: a headless `-p` run
 * has no TTY to answer a permission prompt for whatever tool calls `agy`
 * makes, so without it such a call would hang forever instead of being
 * denied.
 */
export const antigravityCliSpec: AgentCliSpec = {
  name: 'antigravity',
  executable: 'agy',
  buildArgs: (request) => [
    ...promptArgs(request),
    '--mode',
    'plan',
    '--dangerously-skip-permissions',
    '--output-format',
    'json',
  ],
  extractResponse: extractAgyResponse,
};
