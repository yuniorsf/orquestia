# Blackboard Code Generation Blueprint (`/code-gen-dag`)

Declarative workflow specification ([`code-gen-dag.json`](code-gen-dag.json)) for **Google Antigravity** acting as the Outer-Loop DAG Orchestrator over the **{{WORKER_COUNT}}** contributors configured in `orquestia.config.yaml`'s `orchestration.blackboard.contributors[]`, dispatched in parallel against a shared workspace and merged by last-writer-wins, across any programming stack configured in [`.harness/harness.env`](../../.harness/harness.env).

```mermaid
flowchart TD
    subgraph ControlPlane["Outer Loop — Google Antigravity (Orchestrator)"]
        P1["Phase 1: Task Decomposition & Worktree Init (scripts/agent-sandbox.sh)"]
        P3["Merge (BlackboardTopology last-writer-wins) then Deterministic Oracle (verify-agent-worktree.sh — no disjoint-scope check)"]
        P4["Phase 4: Bounded Self-Healing Router (Max 3 Retries + Tree Snapshot Rewind)"]
        P5["Phase 5: Rebase on origin/develop, Post-Rebase Re-Verify & Merge Prep"]
    end

    subgraph SharedWorkspace["Inner Loop — Shared Workspace (../worktrees/<task-id>), no disjoint ownership"]
{{MERMAID_WORKER_NODES}}
    end

    P1 --> |dispatch all, in parallel| SharedWorkspace
{{MERMAID_WORKER_EDGES}}
    P3 -- "Exit 0 (Pass)" --> P5
    P3 -- "Exit 10 (Format only)" --> P4
    P3 -- "Exit 20 (Build/Typecheck/Lint)" --> P4
    P3 -- "Exit 30 (SOLID/Arch/Test)" --> P4
    P4 -- "Exit 10/20/30" --> SharedWorkspace
```
