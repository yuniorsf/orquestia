#!/usr/bin/env bash
# ==============================================================================
# Orchestration Architecture Generator
# ==============================================================================
# Generates, from templates/orchestration/<architecture>/, every governance
# file that describes the selected orchestration topology to Claude Code,
# GitHub Copilot, and Google Antigravity — CLAUDE.md, .github/copilot-
# instructions.md, the code-gen-dag/plan-gen-dag skills on both planes, and
# .antigravity/workflows/*. Generated files are starting points: customize
# or replace them freely afterward.
#
# Usage:
#   ./scripts/init-orchestration.sh fixed_tri_planar [--target-dir <dir>]
#   ./scripts/init-orchestration.sh <hierarchical_n_worker|handoff_swarm|blackboard> [--target-dir <dir>] <name:agent> [<name:agent> ...]
#
# fixed_tri_planar takes no worker arguments — it is the default, fixed 2A/2B
# topology. Every other architecture requires at least one "name:agent" pair,
# e.g. "architecture:claude_code" "contracts:copilot_cli" (handoff_swarm
# treats the argument order as the dispatch sequence; blackboard calls them
# "contributors" rather than "workers" — same "name:agent" shape either way).
#
# Also appends an "orchestration:" section to <target-dir>/orquestia.config.yaml
# — only if that file has none already (switching an existing selection is a
# deliberate manual edit, not something this script will silently rewrite).
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATES_ROOT="${REPO_ROOT}/templates/orchestration"

ARCHITECTURE="${1:-}"
if [[ -z "${ARCHITECTURE}" || "${ARCHITECTURE}" == "-h" || "${ARCHITECTURE}" == "--help" ]]; then
    cat <<EOF
Usage: $(basename "$0") <architecture> [--target-dir <dir>] [name:agent ...]

  fixed_tri_planar        No worker arguments. Regenerates the default, fixed 2A/2B governance files.
  hierarchical_n_worker   One or more "name:agent" pairs, parallel fan-out + join, e.g. "architecture:claude_code" "contracts:copilot_cli".
  handoff_swarm           One or more "name:agent" pairs, dispatched strictly in the order given (sequential handoff, no join barrier).
  blackboard              One or more "name:agent" pairs ("contributors"); shared workspace, no disjoint ownership, merged by last-writer-wins.
EOF
    exit 0
fi
shift

TARGET_DIR="${REPO_ROOT}"
WORKER_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --target-dir)
            TARGET_DIR="$2"
            shift 2
            ;;
        *)
            WORKER_ARGS+=("$1")
            shift
            ;;
    esac
done

TEMPLATE_DIR="${TEMPLATES_ROOT}/${ARCHITECTURE}"
if [[ ! -d "${TEMPLATE_DIR}" ]]; then
    printf "\033[1;31m[INIT-ORCHESTRATION:ERROR]\033[0m Unknown architecture '%s'. Run with --help to list supported architectures.\n" "${ARCHITECTURE}" >&2
    exit 2
fi

if [[ "${ARCHITECTURE}" == "fixed_tri_planar" && ${#WORKER_ARGS[@]} -gt 0 ]]; then
    printf "\033[1;31m[INIT-ORCHESTRATION:ERROR]\033[0m fixed_tri_planar takes no worker arguments.\n" >&2
    exit 2
fi
if [[ "${ARCHITECTURE}" != "fixed_tri_planar" && ${#WORKER_ARGS[@]} -eq 0 ]]; then
    printf "\033[1;31m[INIT-ORCHESTRATION:ERROR]\033[0m %s requires at least one \"name:agent\" argument.\n" "${ARCHITECTURE}" >&2
    exit 2
fi

mkdir -p "${TARGET_DIR}/.claude/skills/code-gen-dag" "${TARGET_DIR}/.claude/skills/plan-gen-dag"
mkdir -p "${TARGET_DIR}/.github/skills/code-gen-dag" "${TARGET_DIR}/.github/skills/plan-gen-dag"
mkdir -p "${TARGET_DIR}/.antigravity/workflows"

python3 - "${TEMPLATE_DIR}" "${TARGET_DIR}" "${ARCHITECTURE}" "${WORKER_ARGS[@]+"${WORKER_ARGS[@]}"}" <<'PY'
import json
import sys
from pathlib import Path

template_dir = Path(sys.argv[1])
target_dir = Path(sys.argv[2])
architecture = sys.argv[3]
worker_args = sys.argv[4:]

workers = []
for arg in worker_args:
    name, _, agent = arg.partition(":")
    if not name or not agent:
        print(f'[INIT-ORCHESTRATION:ERROR] Invalid worker argument "{arg}" (expected "name:agent").', file=sys.stderr)
        sys.exit(2)
    workers.append({"name": name, "agent": agent})

def agent_display(agent: str) -> str:
    return agent.replace("_", "-")

MULTI_WORKER_ARCHITECTURES = {"hierarchical_n_worker", "handoff_swarm", "blackboard"}

tokens = {}
if architecture in MULTI_WORKER_ARCHITECTURES:
    tokens["{{WORKER_COUNT}}"] = str(len(workers))
    tokens["{{WORKER_TABLE}}"] = "\n".join(
        ["| Worker | Agent |", "|---|---|"]
        + [f"| `{w['name']}` | `{w['agent']}` |" for w in workers]
    )
    copilot_workers = [w["name"] for w in workers if w["agent"] == "copilot_cli"]
    tokens["{{COPILOT_WORKERS}}"] = ", ".join(copilot_workers) if copilot_workers else "(none configured)"

    tokens["{{MERMAID_WORKER_NODES}}"] = "\n".join(
        f'        W{i}["{w["name"]} ({agent_display(w["agent"])})"]' for i, w in enumerate(workers)
    )
    tokens["{{MERMAID_WORKER_EDGES}}"] = "\n".join(
        f"    W{i} --> P3" for i in range(len(workers))
    )
    # handoff_swarm's diagram is a linear chain (W0 --> W1 --> W2 --> P3),
    # not parallel fan-in — order is the dispatch sequence.
    chain_links = [f"W{i}" for i in range(len(workers))] + ["P3"]
    tokens["{{MERMAID_WORKER_CHAIN}}"] = "\n".join(
        f'        W{i}["{w["name"]} ({agent_display(w["agent"])})"]' for i, w in enumerate(workers)
    ) + "\n" + "\n".join(f"        {a} --> {b}" for a, b in zip(chain_links[:-1], chain_links[1:]))

    tokens["{{WORKERS_JSON}}"] = json.dumps(
        [
            {
                "id": w["name"],
                "agent": agent_display(w["agent"]),
                "plane": "ExecutionPlane-InnerLoop",
                "contractFile": "CLAUDE.md" if w["agent"] == "claude_code" else ".github/copilot-instructions.md",
            }
            for w in workers
        ],
        indent=2,
    )
    tokens["{{BRANCHES_JSON}}"] = json.dumps(
        [
            {
                "branchId": w["name"],
                "agent": agent_display(w["agent"]),
                "workingDirectory": "../worktrees/{{parameters.taskId}}",
                "inputs": ["sharedContractSpec", "perWorkerSpec"],
                "outputs": ["modifiedFiles"],
            }
            for w in workers
        ],
        indent=2,
    )
    # Embedded in a JSON string value (the "command" field below), so quotes
    # must be JSON-escaped rather than literal. blackboard omits this
    # entirely from its own template (no --worker-scope is passed), but the
    # token is still computed uniformly here in case a future template needs it.
    tokens["{{WORKER_SCOPE_FLAGS}}"] = " ".join(
        f'--worker-scope \\"{w["name"]}:<{w["name"]}-paths>\\"' for w in workers
    )

def render(text: str) -> str:
    for token, value in tokens.items():
        text = text.replace(token, value)
    return text

FILE_DESTINATIONS = {
    "CLAUDE.md": ["CLAUDE.md"],
    "copilot-instructions.md": [".github/copilot-instructions.md"],
    "code-gen-dag-SKILL.md": [".claude/skills/code-gen-dag/SKILL.md", ".github/skills/code-gen-dag/SKILL.md"],
    "plan-gen-dag-SKILL.md": [".claude/skills/plan-gen-dag/SKILL.md", ".github/skills/plan-gen-dag/SKILL.md"],
    "antigravity-code-gen-dag.md": [".antigravity/workflows/code-gen-dag.md"],
    "antigravity-plan-gen-dag.md": [".antigravity/workflows/plan-gen-dag.md"],
    "antigravity-code-gen-dag.json": [".antigravity/workflows/code-gen-dag.json"],
    "antigravity-plan-gen-dag.json": [".antigravity/workflows/plan-gen-dag.json"],
}

for template_name, destinations in FILE_DESTINATIONS.items():
    source_path = template_dir / template_name
    content = render(source_path.read_text(encoding="utf-8"))
    for destination in destinations:
        destination_path = target_dir / destination
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        destination_path.write_text(content, encoding="utf-8")

config_path = target_dir / "orquestia.config.yaml"
if config_path.exists():
    existing = config_path.read_text(encoding="utf-8")
    if "\norchestration:" in existing or existing.startswith("orchestration:"):
        print(
            f'[INIT-ORCHESTRATION:INFO] "{config_path}" already has an "orchestration:" section — leaving it untouched. Remove it manually first to regenerate.',
        )
    else:
        if architecture == "fixed_tri_planar":
            section = "\norchestration:\n  architecture: \"fixed_tri_planar\"\n"
        else:
            entries_yaml = "\n".join(
                f'      - name: "{w["name"]}"\n        agent: "{w["agent"]}"' for w in workers
            )
            # blackboard calls its entries "contributors"; the other two call
            # them "workers" — same WorkerSpec shape either way.
            list_key = "contributors" if architecture == "blackboard" else "workers"
            section = (
                "\norchestration:\n"
                f'  architecture: "{architecture}"\n'
                f"  {architecture}:\n"
                f"    {list_key}:\n"
                f"{entries_yaml}\n"
            )
        with config_path.open("a", encoding="utf-8") as handle:
            handle.write(section)
        print(f'[INIT-ORCHESTRATION:OK] Appended "orchestration:" section to "{config_path}".')
else:
    print(f'[INIT-ORCHESTRATION:INFO] "{config_path}" does not exist — skipping orchestration: section (governance files were still generated).')

print(f"[INIT-ORCHESTRATION:OK] Generated {architecture} governance files under \"{target_dir}\".")
PY
