import type { AgentCliSpec, AgentInvocationRequest } from './types.js';

function promptArgs(request: AgentInvocationRequest): readonly string[] {
  return ['-p', request.prompt];
}

/**
 * `claude -p "<prompt>" --permission-mode plan --permission-prompts none
 * --disallowedTools "Bash,Edit,Write,NotebookEdit,Agent"`, run with the
 * process `cwd` set to the task worktree.
 *
 * Every dispatch prompt (planning, synthesis, remediation) already tells
 * the agent "do not use any tools" / "this is read-only analysis," but
 * that alone is only a request, not an enforced restriction (see
 * `code-command.ts`'s own doc comment: "no unsupervised tool access").
 * `--permission-mode plan` alone (ORQ-54) correctly blocks every short,
 * direct test — but confirmed live not to hold over a longer, more
 * ambiguous dispatch: Branch 2A explored at length, spawned background
 * subagents, and ended up with real, substantive edits to pre-existing
 * files before finally giving up and answering in prose instead of the
 * required JSON (ORQ-56). `--disallowedTools` closes that gap at the
 * tool level, independent of session length or "mode" semantics:
 * `Bash` can mutate files directly even with Edit/Write denied (`echo ...
 * > file`); the subagent-spawning tool in this environment is named
 * `Agent`, not the more commonly assumed `Task`. Confirmed against a
 * deliberately adversarial repro (ambiguous pre-existing files, an
 * explicit invitation to explore at length and spawn subagents) that this
 * combination still returns a clean JSON response with zero file
 * mutation. `--permission-prompts none` denies anything that would
 * otherwise prompt instead of hanging (no TTY in a headless dispatch) or
 * silently inheriting an ambient allow-rule.
 */
export const claudeCodeCliSpec: AgentCliSpec = {
  name: 'claude_code',
  executable: 'claude',
  buildArgs: (request) => [
    ...promptArgs(request),
    '--permission-mode',
    'plan',
    '--permission-prompts',
    'none',
    '--disallowedTools',
    'Bash,Edit,Write,NotebookEdit,Agent',
  ],
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
