# Orquestia: Technical Specification & Architecture Design Document

**Document Version**: 3.2.0  
**Status**: APPROVED / ARCHITECTURE BASELINE  
**Classification**: Technical Design Specification  
**Language**: English  
**Artifact Extension**: `.md`  

---

## 1. Executive Summary & Vision

### 1.1 Context & Problem Statement
Modern software engineering organizations and individual developers routinely subscribe to multiple consumer-tier artificial intelligence services (e.g., Claude Pro, ChatGPT Plus, GitHub Copilot Pro, and Google Antigravity) alongside self-hosted open-weight model instances (e.g., DeepSeek, Qwen 2.5-Coder, Codestral, Llama 3.3). However, these platforms remain fragmented. Because consumer subscriptions impose browser-first rate-limiting policies and anti-scraping Terms of Service (ToS), developers cannot easily integrate them into programmatic, end-to-end backend automation pipelines without purchasing parallel Pay-As-You-Go API keys.

Furthermore, single-model bottlenecks create severe failure modes:
1. Hourly rate limits (HTTP 429 / quota exhaustion) halt entire automation pipelines.
2. Inefficient model assignment routes simple lint repairs to costly frontier reasoning models while starving complex domain architectures of deep-thinking tokens.
3. Lack of air-gapped support prevents privacy-critical enterprise codebases from using local open-weight inference hardware.

### 1.2 The Orquestia Solution
**Orquestia** is an open-source, multi-agent development lifecycle orchestrator and Application Lifecycle Management (ALM) bridge. It acts as an **Outer-Loop Orchestration Controller** that binds disparate agent subscriptions and open-weight models through a non-invasive **Local Session Bridge** and **OpenAI-Compatible Gateway** model.

Orquestia drives tasks across two primary macro-workflows governed by deterministic Directed Acyclic Graphs (DAGs):
1. **Planning DAG (`/orquestia-plan-dag`)**: A strictly read-only, 5-phase exploratory and architecture synthesis protocol.
2. **Coding DAG (`/orquestia-code-dag`)**: An isolated, 5-phase implementation and self-healing protocol executed inside dedicated Git Worktrees.

Both workflows interact directly with enterprise ALM infrastructure (**Atlassian Jira & Confluence**), secure multi-tier credential storage (**SQLCipher & HashiCorp Vault**), and a dynamic **Layer-by-Layer Load Balancer** with optional toggleability (`enabled: true/false`).

---

## 2. High-Level Architecture Overview

Orquestia is structured around a decoupled, layered micro-kernel architecture with event-driven state propagation, layer load balancing, and deterministic oracle gates.

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
│   Layer Load Balancer    │ │   Workspace Engine    │ │      Security Vault Layer         │
│  (Configurable Pools)    │ │                       │ │         (IVaultProvider)          │
│                          │ │ ├── AST / Tree-sitter │ │                                   │
│ ├── Strategy Router      │ │ │   (Repo-Map Engine) │ │ ├── SQLCipher Provider (Local)    │
│ │   (Round-Robin/Quota/  │ │ ├── Git Worktree Pool │ │ │   (AES-256 + OS Keyring)        │
│ │    Least-Cost/Latency) │ │ │   (Isolated Sandbox)│ │ └── HashiCorp Provider (Corp)     │
│ ├── Frontier Subscriptions│ │ ├── Checkpoint Engine │ │     (Enterprise Vault KV v2)      │
│ ├── Global / Chinese LLMs│ │ └── Atlassian Client  │ └───────────────────────────────────┘
│ └── Local / Ollama Nodes │ │     (Jira/Confluence) │
└──────────────────────────┘ └───────────────────────┘
```

> The diagram above (and §3 below) describes the **default** DAG topology — fixed 2A/2B branch roles. This is one of four implemented, config-selectable orchestration architectures (`orchestration.architecture` in `orquestia.config.yaml`); see §9 and `packages/core/src/orchestration/` for the others (`hierarchical_n_worker`, `handoff_swarm`, `blackboard`).

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
  ├─► Branch 2A (Architecture & Domain): Claude 3.5 / DeepSeek-R1 / o3-mini (`coreLogicSpec`)
  └─► Branch 2B (Contracts & QA Matrix): Copilot / Codestral / Qwen 2.5-Coder (`contractsAndTestsSpec`)
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

## 4. Layer-by-Layer Model Load Balancing & Model Diversity

### 4.1 Architecture & Balancing Policies
Orquestia introduces a dedicated **`LayerLoadBalancer`** that sits between DAG phase execution and model providers. It allows independent model pools per stage with dynamic activation (`enabled: true/false`).

```
                  ┌───────────────────────────────────────────────┐
                  │             DAG Phase / Runner                │
                  │   (e.g., Phase 2A: Architecture & Domain)     │
                  └───────────────────────┬───────────────────────┘
                                          │
                                          ▼
                  ┌───────────────────────────────────────────────┐
                  │          LayerLoadBalancer (Phase 2A)         │
                  │  - Enabled: true / false (direct passthrough) │
                  │  - Strategy Router: round_robin / quota_aware │
                  │                     least_cost / latency      │
                  │  - Health Check / Rate-Limit Monitor          │
                  └───────────────┬───────────────┬───────────────┘
                                  │               │
                     Active Pool: │               │
                                  ▼               ▼
                       ┌────────────────┐ ┌────────────────┐
                       │ Claude 3.5     │ │ DeepSeek-R1    │
                       │ (Subscription) │ │ (API / vLLM)   │
                       └────────────────┘ └────────────────┘
```

#### Balancing Strategies:
1. **`quota_aware` (Smart Weighted)**: Checks `vault.db` for rate-limit cooldown timestamps (`rate_limit_reset_at`) and dynamically shifts traffic away from models nearing quota exhaustion.
2. **`least_cost`**: Prioritizes local/free inference endpoints (Ollama/vLLM) first, spilling over to commercial APIs only when local queues or hardware saturate.
3. **`latency_priority`**: Favors ultra-high-speed inference accelerators (e.g., Groq LPU, Cerebras, fast local 7B models) for rapid compile-fix iterations.
4. **`round_robin`**: Uniformly distributes requests across identical or peer-tier accounts to multiply rate limits.

### 4.2 Expanded Model Support Matrix

| Category | Representative Models | Ideal Orquestia Role | Primary Advantage |
| :--- | :--- | :--- | :--- |
| **Frontier Reasoning** | Claude 3.5 Sonnet, OpenAI o1/o3-mini | Planning (2A), Core Domain (2A) | Highest architectural precision and SOLID compliance |
| **Chinese Frontier & Open Weights** | DeepSeek-R1, DeepSeek-V3, Qwen 2.5-Coder (32B/7B), GLM-4-Plus, Kimi K2 | Architecture (2A), Scaffolding (2B), Fallbacks | 1/10th cost, Apache 2.0 open weights, top coding benchmarks |
| **European Open Weights** | Mistral Codestral (22B), Mistral Large 2 | Scaffolding & Tests (2B), Code Review (Phase 3) | Native Fill-In-The-Middle (FIM) across 80+ languages |
| **Open Source / Enterprise Air-Gapped** | Meta Llama 3.3 (70B), Microsoft Phi-4 (14B), CodeGemma | Local Sandbox, Self-Healing Retries (Phase 4) | Fully local, zero data egress, runs on local GPUs |
| **High-Throughput Inference Engines** | Groq, Cerebras, vLLM, Ollama | Phase 4 Self-Healing Loops | Sub-second inference (300–800 tps) for fast convergence |

### 4.3 Hardware Sizing Matrix for Local LLM Deployments

| Model Size Tier | Representative Models | Min VRAM (4-bit Q4) | Recommended PC GPU | Apple Silicon Unified RAM | Target Orquestia Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **7B – 9B** | `Qwen2.5-Coder-7B`, `Gemma-2-9B` | **6 – 8 GB** | RTX 3060 / 4060 Ti | **16 GB** | Phase 4 Formatting & Lint Fixes |
| **14B – 22B** | `Phi-4 (14B)`, `Codestral (22B)` | **12 – 16 GB** | RTX 4070 Ti / 4080 | **24 – 32 GB** | Contract & Scaffolding (2B) |
| **32B (Sweet Spot)**| `Qwen2.5-Coder-32B` | **20 – 24 GB** | **1× RTX 3090 / 4090** | **36 – 48 GB** (Pro/Max) | **Full Domain Coding (2A & 2B)** |
| **70B – 72B** | `Llama 3.3 70B`, `Qwen2.5 72B` | **40 – 48 GB** | **2× RTX 3090 / 4090** | **64 – 96 GB** (Max/Ultra) | Planning (2A) & Deep Review |
| **Large MoE** | `DeepSeek-R1` (Full 671B) | **~400 GB** | 8× A100 / H100 (80GB) | 512 GB+ Cluster | Enterprise Datacenter Reasoning |

---

## 5. Multi-Tier Security & Secret Storage Architecture

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

### 5.1 SQLCipher Database Schema (`~/.orquestia/vault.db`)
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

### 5.2 Atlassian OAuth 2.0 (3LO) with PKCE
Rather than persisting insecure long-lived static API tokens, Orquestia implements an automated loopback server OAuth 2.0 flow:
1. Spawns an ephemeral HTTP listener at `http://localhost:8085/callback`.
2. Generates cryptographic PKCE `code_verifier` and `code_challenge` (S256).
3. Opens the default browser to Atlassian authorization endpoint with scopes:
   `read:jira-work write:jira-work read:confluence-space.summary write:confluence-content offline_access`.
4. Exchanges authorization code for `access_token` (1-hour lifespan) and rotating `refresh_token`.
5. Background token rotator seamlessly renews tokens 5 minutes prior to expiration.

---

## 6. Advanced Resilience & Context Management

### 6.1 Token-Aware Context Condenser (AST Repo-Map)
To minimize token consumption and avoid context window saturation on consumer LLMs, Orquestia integrates a Tree-sitter-based abstract syntax tree analyzer:
- Strips function implementations, internal private variables, and comments from peripheral codebase files.
- Extracts an **ISP Minimal Context Projection ($\pi_k$)** consisting strictly of exported interfaces, abstract signatures, data transfer models, and port definitions.

### 6.2 Smart Fallback Routing & Rate-Limit Tracking
When a primary agent subscription encounters a rate limit (HTTP 429 or CLI quota exhaustion):
- The `RateLimitTracker` flags the subscription and calculates `rate_limit_reset_at`.
- The `SmartFallbackRouter` automatically redirects subsequent task steps to an auxiliary provider (e.g., fallback from Claude Code to DeepSeek-R1 or local Qwen).
- Upon expiration of the cooldown period, traffic automatically falls back to the primary subscription.

### 6.3 Bounded Self-Healing with Dual Rollback ($f^{op}$)
Iterative code repair can compound regressions. Orquestia implements transactional checkpoints:
- Before each self-healing attempt in Phase 4, a Git stash checkpoint is committed: `git stash create`.
- If a repair attempt introduces additional compiler diagnostics or test failures, Orquestia triggers an immediate rollback ($f^{op}$) to the checkpoint before attempting an alternate reasoning strategy.

### 6.4 Durable Human-in-the-Loop Approvals
Configurable approval gates freeze pipeline execution in non-volatile storage (`.orquestia/state.json`):
- Pushes, rebases, and pull request shipments can be gated to require explicit developer sign-off in the terminal or VS Code notification panel.

---

## 7. Monorepo Structure & Directory Organization

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
│   │   │   ├── load_balancer/         # LayerLoadBalancer & Scheduling Strategies
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

## 8. Master Configuration Specification (`orquestia.config.yaml`)

```yaml
version: "3.2"
project_name: "fintech-payment-gateway"

# ==============================================================================
# 1. SECRET MANAGEMENT (SQLCipher vs HashiCorp)
# ==============================================================================
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

# ==============================================================================
# 2. ATLASSIAN SUITE INTEGRATION (JIRA & CONFLUENCE)
# ==============================================================================
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

# ==============================================================================
# 3. CONCURRENCY & DURABLE APPROVALS
# ==============================================================================
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

# ==============================================================================
# 4. AST REPO-MAP CONTEXT CONDENSER
# ==============================================================================
context_condenser:
  engine: "tree_sitter"
  max_context_tokens: 16000
  include_signatures_only: true
  prune_irrelevant_files: true

# ==============================================================================
# 5. LAYER-BY-LAYER MODEL LOAD BALANCING (Toggleable per Stage)
# ==============================================================================
load_balancing:
  global_enabled: true
  cooldown_on_429_seconds: 300

# Matches the real parser shipped in packages/core/src/load-balancer/
# layer-pools-config.ts exactly: "providers" (not "pool"), and a BOOLEAN
# "primary_fallback" — required on every layer, including disabled ones.
# (An earlier revision of this example used "pool" and a string
# primary_fallback value; that shape predates the real parser and would
# fail validation if used verbatim.)
layers:
  # Layer 1: Planning Architecture & Deep Domain Reasoning (Phase 2A)
  planning_architecture:
    enabled: true
    strategy: "quota_aware" # 'quota_aware' | 'round_robin' | 'least_cost' | 'latency_priority'
    primary_fallback: true
    providers:
      - name: "claude_pro_account_1"
        provider: "claude_code"
        base_url: "n/a" # CLI-invoked, not an HTTP endpoint — base_url/model are still required by the parser
        model: "claude-sonnet"
        weight: 60
      - name: "deepseek_r1_cloud"
        provider: "openai_compatible"
        base_url: "https://api.deepseek.com/v1"
        model: "deepseek-reasoner"
        weight: 40

  # Layer 2: Scaffolding, Contracts & Test Suites (Phase 2B)
  coding_scaffolding_tests:
    enabled: true
    strategy: "least_cost" # Prefers local Ollama; spills to Mistral Codestral
    primary_fallback: true
    providers:
      - name: "local_qwen_coder"
        provider: "ollama"
        base_url: "http://localhost:11434/v1"
        model: "qwen2.5-coder:32b"
        priority: 1 # Priority 1: Free local inference
      - name: "mistral_codestral"
        provider: "openai_compatible"
        base_url: "https://api.mistral.ai/v1"
        model: "codestral-latest"
        priority: 2
      - name: "copilot_cli"
        provider: "github_copilot"
        base_url: "n/a"
        model: "copilot"
        priority: 3

  # Layer 3: Code Review & Jira Audit (Phase 3)
  code_review_qa:
    enabled: false # Disabled layers still need a syntactically valid strategy/primary_fallback/providers
    strategy: "quota_aware"
    primary_fallback: false
    providers: []

  # Layer 4: Self-Healing Compile, Lint & Invariant Retries (Phase 4)
  self_healing_retries:
    enabled: true
    strategy: "latency_priority" # Sub-second fixes for rapid compilation feedback
    primary_fallback: true
    providers:
      - name: "groq_fast_llama"
        provider: "groq"
        base_url: "https://api.groq.com/openai/v1"
        model: "llama-3.3-70b-versatile" # 300+ tokens/sec
        priority: 1
      - name: "local_small_qwen"
        provider: "ollama"
        base_url: "http://localhost:11434/v1"
        model: "qwen2.5-coder:7b"
        priority: 2

# ==============================================================================
# 6. STACK DEFINITION & DETERMINISTIC COMMANDS
# ==============================================================================
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

# ==============================================================================
# 7. PLANNING DAG SPECIFICATION
# ==============================================================================
planning_dag:
  enabled: true
  invariant: "zero_repo_mutations"
  base_branch: "origin/develop"
  max_self_heal_retries: 3
  gates:
    gate_0: { name: "Zero-Mutation Invariant", fail_code: 2, action: "abort" }
    gate_1: { name: "Disjoint Ownership (2A ∩ 2B = ∅)", fail_code: 10, remediate_with: "branch_2b" }
    gate_2: { name: "Static Rules & Banned APIs", fail_code: 20, remediate_with: "branch_2a" }
    gate_3: { name: "Architecture & Coverage Check", fail_code: 30, remediate_with: ["branch_2a", "branch_2b"] }
  delivery:
    specs_dir: ".orquestia/specs"
    sync_confluence: true
    sync_jira: true

# ==============================================================================
# 8. CODING DAG SPECIFICATION
# ==============================================================================
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
      action: "run_format_fix"
    exit_20:
      name: "Compiler / Linter Violation"
      action: "repair_types_and_diagnostics"
    exit_30:
      name: "Test / Invariant Failure"
      action: "repair_assertion_or_domain_logic"
  shipment:
    target_branch: "develop"
    auto_rebase: true
    reverify_post_rebase: true
    commit_convention: "conventional_commits_with_jira"
    sync_jira_status: true

# ==============================================================================
# 9. ORCHESTRATION ARCHITECTURE (pluggable DAG topology — implemented)
# ==============================================================================
# Selects the shape of the DAG itself: how many workers, how they're
# dispatched and joined — orthogonal to the model-routing "layers:" above,
# which only selects which model backs an already-fixed phase. Four
# architectures are implemented (packages/core/src/orchestration/):
# fixed_tri_planar (the 2A/2B shape this document otherwise assumes
# throughout §§1-3), hierarchical_n_worker (open worker list, parallel
# fan-out + join), handoff_swarm (open worker list, sequential handoff,
# no join barrier), and blackboard (open contributor list, shared
# workspace, no disjoint ownership — conflicts resolved by last-writer-
# wins). scripts/init-orchestration.sh regenerates CLAUDE.md,
# .github/copilot-instructions.md, the code-gen-dag/plan-gen-dag skill
# mirrors, and .antigravity/workflows/* to match whichever architecture
# is selected here; see the root README's "Switching Orchestration
# Architectures".
orchestration:
  architecture: "fixed_tri_planar"
  # hierarchical_n_worker / handoff_swarm / blackboard each require their
  # own sub-section (workers[] or contributors[]) — see
  # packages/core/src/orchestration/orchestration-config.ts for the exact
  # schema, or run `./scripts/init-orchestration.sh --help`.
```

---

## 9. Product Distribution & Packaging Model

Orquestia adopts a **Dual-Delivery Model**:

1. **Autonomous CLI (`@orquestia/cli`)**:
   - Installed globally via `npm install -g @orquestia/cli` or compiled into a single self-contained binary via Bun/Node Single Executable Applications (SEA).
   - Manages background daemon processes, worktree pools, and CI/CD headless execution without requiring an active graphical desktop.

2. **VS Code / Cursor Extension (`.vsix`)**:
   - Packaged via `@vscode/vsce package` yielding `orquestia-3.2.0.vsix`.
   - Embeds visual Kanban views for Jira, real-time diff previews for active worktrees, task palette integration, and one-click execution of `/orquestia-plan-dag` and `/orquestia-code-dag`.
   - Communicates seamlessly with the background Orquestia daemon via IPC/JSON-RPC.
