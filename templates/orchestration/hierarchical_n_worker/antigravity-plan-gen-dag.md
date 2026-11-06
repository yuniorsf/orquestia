# Hierarchical N-Worker Read-Only Planning Blueprint (`/plan-gen-dag`)

Declarative read-only planning specification ([`plan-gen-dag.json`](plan-gen-dag.json)) for **Google Antigravity** coordinating the **{{WORKER_COUNT}}** workers configured in `orquestia.config.yaml`'s `orchestration.hierarchical_n_worker.workers[]` with **zero working-tree mutations**, producing a ready-to-execute handoff artifact for `/code-gen-dag`.
