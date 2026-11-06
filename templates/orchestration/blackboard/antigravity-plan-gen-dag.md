# Blackboard Read-Only Planning Blueprint (`/plan-gen-dag`)

Declarative read-only planning specification ([`plan-gen-dag.json`](plan-gen-dag.json)) for **Google Antigravity** coordinating the **{{WORKER_COUNT}}** contributors configured in `orquestia.config.yaml`'s `orchestration.blackboard.contributors[]`, dispatched in parallel against a shared workspace and merged by last-writer-wins, with **zero working-tree mutations**, producing a ready-to-execute handoff artifact for `/code-gen-dag`.
