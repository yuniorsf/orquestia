# Orquestia: Technical Specification & Architecture Design Document

**Document Version**: 3.0.0  
**Status**: APPROVED / ARCHITECTURE BASELINE  
**Classification**: Technical Design Specification  
**Language**: English  
**Artifact Extension**: `.md`  

---

## 1. Executive Summary & Vision

### 1.1 Context & Problem Statement
Modern software engineering organizations and individual developers routinely subscribe to multiple consumer-tier artificial intelligence services (e.g., Claude Pro, ChatGPT Plus, GitHub Copilot Pro, and Google Antigravity). However, these platforms remain fragmented. Because consumer subscriptions impose browser-first rate-limiting policies and anti-scraping Terms of Service (ToS), developers cannot easily integrate them into programmatic, end-to-end backend automation pipelines without purchasing parallel Pay-As-You-Go API keys.

As a result, engineers spend substantial cognitive effort manually copying prompts, context, architectural designs, code snippets, and verification errors across disparate browser tabs and local IDE sessions.

### 1.2 The Orquestia Solution
**Orquestia** is an open-source, multi-agent development lifecycle orchestrator and Application Lifecycle Management (ALM) bridge. It acts as an **Outer-Loop Orchestration Controller** that binds disparate agent subscriptions through a non-invasive **Local Session Bridge** model. 

Orquestia drives tasks across two primary macro-workflows governed by deterministic Directed Acyclic Graphs (DAGs):
1. **Planning DAG (`/orquestia-plan-dag`)**: A strictly read-only, 5-phase exploratory and architecture synthesis protocol.
2. **Coding DAG (`/orquestia-code-dag`)**: An isolated, 5-phase implementation and self-healing protocol executed inside dedicated Git Worktrees.

Both workflows interact directly with enterprise ALM infrastructure (**Atlassian Jira & Confluence**) and secure multi-tier credential storage (**SQLCipher & HashiCorp Vault**).

---

## 2. High-Level Architecture Overview

Orquestia is structured around a decoupled, layered micro-kernel architecture with event-driven state propagation and deterministic oracle gates.

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Presentation & Delivery                                  │
│         VS Code / Cursor Extension (.vsix)          Autonomous CLI (orquestia binary)    │
│         - Command Palette / Interactive Panels      - Headless Pipelines & CI Runners    │
└──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                           │
┌──────────────────────────────────────────▼───────────────────────────────────────────────┐
│                               Workflow Engine (Core Kernel)                              │
│  ┌────────────────────────────────────┐    ┌──────────────────────────────────────────┐  │
│  │      DURABLE APPROVAL MANAGER      │    │         CONCURRENT QUEUE MANAGER         │  │
│  │  Freezes state & serializes tokens │    │  Orchestrates isolated Git worktrees     │  │
│  │  (before_coding, ship, destructive)│    │  (../worktrees/task-A, ../worktrees/B)   │  │
│  └────────────────────────────────────┘    └──────────────────────────────────────────┘  │
│                                                                                          │
│  ┌────────────────────────────────────┐    ┌──────────────────────────────────────────┐  │
│  │        PLANNING DAG SUBSYSTEM      │    │           CODING DAG SUBSYSTEM           │  │
│  │  - Zero-Mutation Check (Gate 0)    │    │  - Checkpoint Engine (Stash/Rollback)    │  │
│  │  - AST Context Condenser (Repo-Map)│    │  - Concurrent 2A ║ 2B Execution          │  │
│  │  - Disjoint Ownership 2A ∩ 2B = ∅  │    │  - Multi-Stage Deterministic Oracle      │  │
│  │  - Confluence / Jira ALM Sync      │    │  - Self-Healing Loop with Dual Rollback  │  │
│  └────────────────────────────────────┘    └──────────────────────────────────────────┘  │
└─────────────┬──────────────────────────┬─────────────────────────────┬───────────────────┘
              │                          │                             │
┌─────────────▼────────────┐ ┌───────────▼───────────┐ ┌───────────────▼───────────────────┐
│      Agent Adapters      │ │   Workspace Engine    │ │      Security Vault Layer         │
│  (Smart Fallback Router) │ │                       │ │         (IVaultProvider)          │
│                          │ │ ├── AST / Tree-sitter │ │                                   │
│ ├── Antigravity Bridge   │ │ │   (Repo-Map Engine) │ │ ├── SQLCipher Provider (Local)    │
│ ├── Claude Code (2A)     │ │ ├── Git Worktree Pool │ │ │   (AES-256 + OS Keyring)        │
│ ├── Copilot CLI (2B)     │ │ │   (Isolated Sandbox)│ │ └── HashiCorp Provider (Corp)     │
│ ├── Fallback LLM (GPT-4o)│ │ ├── Checkpoint Engine │ │     (Enterprise Vault KV v2)      │
│ └── Rate Limit Tracker   │ │ └── Atlassian Client  │ └───────────────────────────────────┘
└──────────────────────────┘ │     (Jira/Confluence) │
                             └───────────────────────┘
```

---

## 3. Core Functional Subsystems

### 3.1 Subsystem A: The Planning DAG (`/orquestia-plan-dag`)
The Planning DAG enforces an exploratory, zero-mutation protocol that synthesizes domain models, architectural contracts, and test matrices without modifying the user's workspace.

```
[User / Jira Trigger]
         │
         ▼
[Phase 1: Baseline Snapshot & Scope Grounding]
  - Execute: `git status --porcelain && git rev-parse --short HEAD` -> `baselineGitStatus`
  - Ingest: `orquestia.config.yaml`, project conventions, and Jira Issue details.
         │
         ▼
[Phase 2: Parallel Specialist Dispatch (Read-Only)]
  ├─► Branch 2A (Architecture & Domain): Claude Code / Antigravity (`coreLogicSpec`)
  └─► Branch 2B (Contracts & QA Matrix): Copilot CLI / Assistant (`contractsAndTestsSpec`)
         │
         ▼
[Join Barrier: Await 2A and 2B Structured Outputs]
         │
         ▼
[Phase 3: Deterministic Plan Oracle]
  ├─► Gate 0: Zero-Mutation Invariant (`git status` identical to baseline) [Code 2]
  ├─► Gate 1: Path Verification & Disjoint File Scope (`2A ∩ 2B = ∅`) [Code 10]
  ├─► Gate 2: Static Guardrails & Banned Symbols Audit [Code 20]
  └─► Gate 3: Layer Isolation & Test Coverage Matrix Audit [Code 30]
         │
         ├── [Failure: Attempt <= maxRetries] ──► [Phase 4: Bounded Self-Healing Loop]
         │                                                      │
         │                                                      └──► (Route to 2A/2B & re-evaluate)
         ▼ [Success: Code 0]
[Phase 5: Synthesis & ALM Synchronization]
  - Write verified Markdown specification: `.orquestia/specs/plan-<taskId>.md`
  - Publish architecture page to Confluence Space.
  - Update Jira issue status to `To Do` / `Ready for Dev`.
```

### 3.2 Subsystem B: The Coding DAG (`/orquestia-code-dag`)
The Coding DAG consumes a verified plan or Jira key, creates an isolated physical sandbox via Git Worktrees, executes concurrent code synthesis over disjoint file ownerships, and subjects the build to multi-stage compiler/test verification.

```
[Trigger: /orquestia-code-dag <taskId>]
         │
         ▼
[Phase 1: Task Decomposition & Worktree Provisioning]
  - Validate disjoint file allocations: `coreLogicSpec ∩ testAndBoilerplateSpec = ∅`
  - Provision isolated tree: `git worktree add ../worktrees/<taskId> -b feature/<taskId> <baseRef>`
         │
         ▼
[Phase 2: Parallel Code Synthesis (Concurrent)]
  ├─► Branch 2A (`coder_core`): Implements domain models, algorithms, ports in worktree
  └─► Branch 2B (`coder_tests`): Implements DTOs, mocks, and full unit test suite in worktree
         │
         ▼
[Join Barrier: Await Completion]
         │
         ▼
[Phase 3: Multi-Stage Deterministic Oracle]
  ├─► Stage 1: Fast SOLID & Disjoint Scope Pre-Flight (< 1s)
  ├─► Stage 2: Code Formatting & Linting Check (`commands.format_check`) [Exit 10]
  ├─► Stage 3: Strict Compilation & Static Guardrails (`commands.build_check`) [Exit 20]
  └─► Stage 4: Test Suite & Layer Invariant Execution (`commands.test_run`) [Exit 30]
         │
         ├── [Exit 10 / 20 / 30 & Retries Remaining] ──► [Phase 4: Bounded Self-Healing Loop]
         │                                                            │
         │                                                            ├── Checkpoint Git Stash Snapshot
         │                                                            ├── Target Remediation to Agent
         │                                                            └── Dual Rollback on Regression ($f^{op}$)
         ▼ [Exit 0: Complete Success]
[Phase 5: Rebase, Post-Rebase Verification & Merge/Ship]
  - Execute: `git fetch origin <baseRef> && git rebase <baseRef>`
  - Mandatory Re-run of Phase 3 Oracle (Never trust pre-rebase green)
  - If `--ship` flag passed:
      * Commit semantic message: `<type>(<scope>): <summary> (<JIRA_KEY>)`
      * Push branch and create GitHub Pull Request via `gh pr create`
      * Transition Jira issue to `In Review` / `Done`
```

---

## 4. Multi-Tier Security & Secret Storage Architecture

Orquestia decouples secret storage through the `IVaultProvider` abstraction. The engine dynamically chooses between a native local embedded vault and a remote enterprise vault.

```
                               ┌───────────────────────────────────────────────┐
                               │           IVaultProvider Interface            │
                               │  - getSecret(id, key)                         │
                               │  - setSecret(id, key, record)                 │
                               │  - healthCheck()                              │
                               └───────────────────────┬───────────────────────┘
                                                       │
                                ┌──────────────────────┴──────────────────────┐
                                ▼                                             ▼
                 [SQLCipherVaultProvider]                          [HashiCorpVaultProvider]
                 - Engine: Embedded SQLCipher                      - Engine: HashiCorp Vault HTTP API
                 - Storage: `~/.orquestia/vault.db`                - Mount: `secret/data/developers`
                 - Encryption: AES-256-GCM / CBC                   - Auth: OIDC / AppRole / Token
                 - Key Derivation: OS Keyring Hardware             - Features: Corporate audit & RBAC
                   (macOS Keychain / Windows Credential)
```

### 4.1 SQLCipher Database Schema (`~/.orquestia/vault.db`)
```sql
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    auth_type TEXT NOT NULL,
    account_email TEXT,
    status TEXT DEFAULT 'active',
    rate_limit_reset_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE credentials (
    id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    secret_type TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    expires_at INTEGER,
    metadata_json TEXT,
    updated_at INTEGER NOT NULL
);

CREATE TABLE agent_access_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    subscription_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    accessed_at INTEGER NOT NULL
);
```

### 4.2 Atlassian OAuth 2.0 (3LO) with PKCE
Rather than persisting insecure long-lived static API tokens, Orquestia implements an automated loopback server OAuth 2.0 flow:
1. Spawns an ephemeral HTTP listener at `http://localhost:8085/callback`.
2. Generates cryptographic PKCE `code_verifier` and `code_challenge` (S256).
3. Opens the default browser to Atlassian authorization endpoint with scopes:
   `read:jira-work write:jira-work read:confluence-space.summary write:confluence-content offline_access`.
4. Exchanges authorization code for `access_token` (1-hour lifespan) and rotating `refresh_token`.
5. Background token rotator seamlessly renews tokens 5 minutes prior to expiration.

---

## 5. Advanced Resilience & Context Management

### 5.1 Token-Aware Context Condenser (AST Repo-Map)
To minimize token consumption and avoid context window saturation on consumer LLMs, Orquestia integrates a Tree-sitter-based abstract syntax tree analyzer:
- Strips function implementations, internal private variables, and comments from peripheral codebase files.
- Extracts an **ISP Minimal Context Projection ($\pi_k$)** consisting strictly of exported interfaces, abstract signatures, data transfer models, and port definitions.

### 5.2 Smart Fallback Routing & Rate-Limit Tracking
When a primary agent subscription encounters a rate limit (HTTP 429 or CLI quota exhaustion):
- The `RateLimitTracker` flags the subscription and calculates `rate_limit_reset_at`.
- The `SmartFallbackRouter` automatically redirects subsequent task steps to an auxiliary provider (e.g., fallback from Claude Code to GPT-4o).
- Upon expiration of the cooldown period, traffic automatically falls back to the primary subscription.

### 5.3 Bounded Self-Healing with Dual Rollback ($f^{op}$)
Iterative code repair can compound regressions. Orquestia implements transactional checkpoints:
- Before each self-healing attempt in Phase 4, a Git stash checkpoint is committed: `git stash create`.
- If a repair attempt introduces additional compiler diagnostics or test failures, Orquestia triggers an immediate rollback ($f^{op}$) to the checkpoint before attempting an alternate reasoning strategy.

### 5.4 Durable Human-in-the-Loop Approvals
Configurable approval gates freeze pipeline execution in non-volatile storage (`.orquestia/state.json`):
- Pushes, rebases, and pull request shipments can be gated to require explicit developer sign-off in the terminal or VS Code notification panel.

---

## 6. Monorepo Structure & Directory Organization

```text
orquestia-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── orquestia.config.yaml
│
├── packages/
│   ├── core/                          # Kernel Engine
│   │   ├── src/
│   │   │   ├── dag/                   # DAG Runners (Planning & Coding)
│   │   │   ├── oracles/               # Deterministic Validation Gates
│   │   │   ├── approvals/             # Durable Human-in-the-loop Gates
│   │   │   ├── queue/                 # Worktree Pool & Concurrent Task Queue
│   │   │   ├── security/              # IVaultProvider, SQLCipher, HashiCorp
│   │   │   └── workspace/             # Git, Worktrees, AST Repo-Map, Atlassian
│   │   └── package.json
│   │
│   ├── cli/                           # Autonomous CLI Executable (`orquestia`)
│   │   ├── src/
│   │   │   ├── commands/              # plan, code, auth, queue, approvals
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── vscode/                        # Visual Studio Code Extension (.vsix)
│       ├── src/
│       │   ├── extension.ts
│       │   ├── task_provider.ts
│       │   └── views/
│       └── package.json
│
└── .orquestia/                        # Local Workspace Runtime Directory
    ├── specs/                         # Generated architecture specs (plan-*.md)
    ├── worktrees/                     # Isolated concurrent task worktrees
    ├── state.json                     # State-machine serialization
    └── vault.db                       # Encrypted SQLCipher database
```

---

## 7. Configuration Specification (`orquestia.config.yaml`)

```yaml
version: "3.0"
project_name: "fintech-payment-gateway"

# 1. SECRET MANAGEMENT (SQLCipher vs HashiCorp)
vault:
  provider: "sqlcipher" # 'sqlcipher' | 'hashicorp'
  sqlcipher:
    path: "~/.orquestia/vault.db"
    keyring_service: "orquestia_master_vault"
  # hashicorp:
  #   address: "https://vault.corp.internal:8200"
  #   engine_path: "secret/data/developers"
  #   auth:
  #     method: "oidc"
  #     role: "developer-agent-role"

# 2. ATLASSIAN SUITE INTEGRATION (JIRA & CONFLUENCE)
atlassian:
  auth_mode: "oauth2" # OAuth 2.0 3LO with PKCE loopback
  cloud_domain: "fintech.atlassian.net"
  jira:
    project_key: "PAY"
    issue_type: "Story"
    transitions:
      plan_approved: "To Do"
      start_coding: "In Progress"
      review_ready: "In Review"
      completed: "Done"
  confluence:
    space_key: "ARCH"
    parent_page_title: "Technical Specifications"

# 3. CONCURRENCY & DURABLE APPROVALS
runtime:
  worktrees_dir: "../worktrees"
  concurrency:
    max_parallel_tasks: 3
    auto_cleanup_on_merge: true
  approval_gates:
    after_planning: "auto"
    before_coding: "prompt"
    before_rebase: "auto"
    before_ship: "manual_token"

# 4. AST REPO-MAP CONTEXT CONDENSER
context_condenser:
  engine: "tree_sitter"
  max_context_tokens: 16000
  include_signatures_only: true
  prune_irrelevant_files: true

# 5. AGENTS & SMART FALLBACK ROUTER
agents:
  branch_2a:
    primary: "claude"
    cli_command: "claude"
    fallback:
      on_rate_limit: "chatgpt"
      model: "gpt-4o"
      auto_resume_primary_after_cooldown: true
  branch_2b:
    primary: "copilot"
    cli_command: "gh copilot"
    fallback:
      on_rate_limit: "chatgpt"
      model: "gpt-4o-mini"

# 6. STACK DEFINITION & DETERMINISTIC COMMANDS
stack:
  language: "typescript"
  package_manager: "pnpm"
  commands:
    format_check: "pnpm prettier --check src/"
    format_fix: "pnpm prettier --write src/"
    build_check: "pnpm tsc --noEmit"
    test_run: "pnpm vitest run --coverage"
  guardrails:
    banned_symbols:
      - pattern: "Date.now()"
        replacement: "TimeProvider.now()"
      - pattern: "any"
        replacement: "unknown or strict generic"
      - pattern: "console.log"
        replacement: "LoggerService"
    required_signatures:
      async_requires_cancellation: true
      max_interface_methods: 5
    layer_isolation:
      core_dir: "src/domain"
      forbidden_dependencies:
        - "express"
        - "prisma"
        - "axios"

# 7. PLANNING DAG SPECIFICATION
planning_dag:
  enabled: true
  invariant: "zero_repo_mutations"
  base_branch: "origin/develop"
  max_self_heal_retries: 3
  specialists:
    branch_2a:
      role: "architecture_and_domain"
      cli_flags: "--allowedTools 'Read,Glob,Grep'"
      output_manifest: "coreLogicSpec"
    branch_2b:
      role: "contracts_and_qa_matrix"
      cli_flags: "--read-only"
      output_manifest: "testAndBoilerplateSpec"
  gates:
    gate_0: { name: "Zero-Mutation Invariant", fail_code: 2, action: "abort" }
    gate_1: { name: "Disjoint Ownership (2A ∩ 2B = ∅)", fail_code: 10, remediate_with: "branch_2b" }
    gate_2: { name: "Static Rules & Banned APIs", fail_code: 20, remediate_with: "branch_2a" }
    gate_3: { name: "Architecture & Coverage Check", fail_code: 30, remediate_with: ["branch_2a", "branch_2b"] }
  delivery:
    specs_dir: ".orquestia/specs"
    sync_confluence: true
    sync_jira: true

# 8. CODING DAG SPECIFICATION
coding_dag:
  enabled: true
  base_branch: "origin/develop"
  max_self_heal_retries: 3
  transactional:
    create_checkpoint_before_retry: true
    revert_on_regression: true
  self_healing:
    exit_10:
      name: "Formatting Drift"
      remediate_with: "branch_2b"
      action: "run_format_fix"
    exit_20:
      name: "Compiler / Linter Violation"
      remediate_with: "branch_2a"
      action: "repair_types_and_diagnostics"
    exit_30:
      name: "Test / Invariant Failure"
      remediate_with: "branch_2a"
      action: "repair_assertion_or_domain_logic"
  shipment:
    target_branch: "develop"
    auto_rebase: true
    reverify_post_rebase: true
    commit_convention: "conventional_commits_with_jira"
    sync_jira_status: true
```

---

## 8. Product Distribution & Packaging Model

Orquestia adopts a **Dual-Delivery Model**:

1. **Autonomous CLI (`@orquestia/cli`)**:
   - Installed globally via `npm install -g @orquestia/cli` or compiled into a single self-contained binary via Bun/Node Single Executable Applications (SEA).
   - Manages background daemon processes, worktree pools, and CI/CD headless execution without requiring an active graphical desktop.

2. **VS Code / Cursor Extension (`.vsix`)**:
   - Packaged via `@vscode/vsce package` yielding `orquestia-3.0.0.vsix`.
   - Embeds visual Kanban views for Jira, real-time diff previews for active worktrees, task palette integration, and one-click execution of `/orquestia-plan-dag` and `/orquestia-code-dag`.
   - Communicates seamlessly with the background Orquestia daemon via IPC/JSON-RPC.
