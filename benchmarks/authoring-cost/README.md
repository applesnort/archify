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

## Review and reporting

After the author terminates, `verify-run.py` checks its frozen candidate and
artifact with the common B package and captures the registered viewports.
It also diagnoses the first complete snapshot. A common rerender never upgrades
a failed native delivery. Independent source and actual image review writes
`quality.json` with `native_acceptance`, `common_acceptance`, `semantic.status`,
`visual.status`, `first_candidate.status`, and audited `repair_edits`.

Timing fields are `final_machine_duration_ms`, `review_duration_ms`, and the
separate `first_snapshot_audit_ms`. The runner records setup in `run-setup.json`;
the first three development attempts lack this measurement and retain nulls.
The summarizer's `accepted_total_ms` is the sum of measured setup, author,
final machine verification, and independent review work when every gate passes.
It is an active-work cost, not continuous dispatch-to-acceptance wall time:
reviewer queue delays and shared/unallocated adjudication time are disclosed
separately. Missing components never become zero. Failed outputs retain their
process timing but have no successful delivery latency.

Run `summarize.py --manifest <manifest> --evidence <private-output> --output
<report-output>` to emit all registered rows, per-case comparisons, and a local
timeline. Optional `annotate.py --spans <spans.jsonl> --output
<annotated-spans.jsonl>` labels only recognizable simple commands; compound
commands remain unclassified and raw events are unchanged.

`fixed-json.py --manifest <manifest> --candidate <json> --repo-root <source>
--output <new-directory> --chrome <executable>` compares the same supported
validate/deliver/check/visual-check stages on A/B/C. It retains one
warmup and three balanced repetitions, including failures. Run it without
concurrent author or regression workloads. It is separate from the ordinary
author's native CLI path and from semantic/perceptual acceptance.

Legacy A accepts no options on `check` and only `--json` on `visual-check`.
Its successful native `deliver` stdout binds specification and artifact hashes;
the harness verifies these hashes for every fixed-input variant. B/C additionally
require their persistent provenance sidecars. The original fixed-input attempts
that sent unsupported flags to A remain recorded as adapter failures. Corrected
comparisons use new output directories and do not consume new author attempts.

For A author artifacts, common B inspection omits the unavailable provenance
requirement, records that capability gap, and binds identity from captured native
delivery output, actual bytes, and target revision. It never creates a synthetic
delivery sidecar. `--out-name machine-review-compatible` retains a post-hoc audit
beside the original report. B's rerendered JSON geometry is diagnostic for A;
actual A artifact checks and its native browser result remain authoritative for
A-native acceptance. Native policies differ on readable vertical scrolling;
report this difference separately from timing and semantic quality.

The reports also retain `dispatch_to_accepted_wall_ms`, measured from the
observed author process start to the independent review completion UTC timestamp.
This includes orchestration and review queues, unlike `accepted_active_work_ms`.
It is not a controlled estimate of product-only latency; the two measures must
not be added together. Shared preparation or adjudication costs remain separate
when their per-run allocation is unknown.

`observer-overhead.py --repeats 5 --output <receipt.json>` checks deterministic
producer output hashes with collection on/off and measures the local wrapper
delta. Run it outside formal author timing. Its tiny synthetic producer measures
collection mechanics only; it is not a substitute for actual author or renderer
performance and cannot establish a percentage overhead for long model sessions.
