# Hierarchical N-Worker Code Generation Blueprint (`/code-gen-dag`)

Declarative workflow specification ([`code-gen-dag.json`](code-gen-dag.json)) for **Google Antigravity** acting as the Outer-Loop DAG Orchestrator over the **{{WORKER_COUNT}}** workers configured in `orquestia.config.yaml`'s `orchestration.hierarchical_n_worker.workers[]`, across any programming stack configured in [`.harness/harness.env`](../../.harness/harness.env).

```mermaid
flowchart TD
    subgraph ControlPlane["Outer Loop — Google Antigravity (Orchestrator)"]
        P1["Phase 1: Task Decomposition & Worktree Init (scripts/agent-sandbox.sh)"]
        P3["Phase 3: Dual Deterministic Oracles (verify-solid-contracts.py + verify-agent-worktree.sh)"]
        P4["Phase 4: Bounded Self-Healing Router (Max 3 Retries + Tree Snapshot Rewind)"]
        P5["Phase 5: Rebase on origin/develop, Post-Rebase Re-Verify & Merge Prep"]
    end

    subgraph ExecutionPlane["Inner Loop — Isolated Git Worktree (../worktrees/<task-id>)"]
{{MERMAID_WORKER_NODES}}
    end

    P1 --> |dispatch| ExecutionPlane
{{MERMAID_WORKER_EDGES}}
    P3 -- "Exit 0 (Pass)" --> P5
    P3 -- "Exit 10 (Format/Scope)" --> P4
    P3 -- "Exit 20 (Build/Typecheck/Lint)" --> P4
    P3 -- "Exit 30 (SOLID/Arch/Test)" --> P4
    P4 -- "Exit 10/20/30" --> ExecutionPlane
```
