# Repository authoring cost experiment

This is an experiment runner, not part of the shipped Skill. It compares the frozen current main (A), the pre-change development head (B), and a candidate from B (C). The author is a fresh `codex exec --json` session using the same `gpt-6-astra` / `high` configuration in all groups. Auxiliary implementation/review agents are not timed author subjects.

The initial protocol and package hashes are in the external evidence directory's `experiment-manifest.initial.json`; the final manifest records the complete task catalog and candidate commit. No author invocation may run before task registration. Once holdout execution begins, product inputs are frozen. All 36 attempts (nine development, 27 holdout) are retained; no environment retry substitutes for a failed sample.

## Run one registered attempt

The runner currently targets the measured macOS host: Python 3, Codex CLI 0.153.4, Node 22, and installed Chrome. Paths and versions are recorded in the manifest; adapting hosts requires a new environmental preflight.

```sh
python3 benchmarks/authoring-cost/run.py \
  --manifest /private/tmp/archify-authoring-20260920-evidence/experiment-manifest.json \
  --run-id dev-01-A \
  --sessions /private/tmp/archify-authoring-sessions-20260920 \
  --evidence /private/tmp/archify-authoring-20260920-evidence
```

Existing attempt directories cause failure rather than replacement. Authentication is copied into a private disposable home on the same machine; credentials are never placed in reports or archives. A macOS sandbox makes other attempts, global Skills, source worktrees, and evaluation files unreadable. A canary denial is checked before dispatch. Source and packaged Skill are read-only. Chrome runs inside the same outer sandbox with its incompatible nested sandbox disabled; this setting is identical across variants and does not alter diagram checks.

Only the ordinary prompt, selected packaged Skill, target source, and common execution limits enter the author context. The scoring catalog and source maps are private evaluator material. Public events are observed with a monotonic clock at receipt time; they are not exact model or function timestamps. Reasoning content is discarded. Native receipts supply their own process timing, while unavailable sub-stages remain null.

The first observed complete JSON and all subsequent versions are preserved. Completion requires independent source entailment, full requested semantic coverage, native acceptance and common validation, and actual visual review. A quick first JSON, CLI exit zero, or correct citation line existence alone does not satisfy that definition. Evaluation time is recorded separately and included when discussing total accepted delivery cost. First-pass quality is evaluated on the first complete snapshot, not the final repaired candidate.

Raw events, screenshots, authentication homes and original artifacts remain outside this repository. Checked-in reports contain redacted indices, hashes and derived observations. The runner does not install or update any live Skill and never merges or pushes branches.
