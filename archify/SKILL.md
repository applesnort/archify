---
name: archify
description: Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with inline SVG, dark/light themes, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accept plain-language requirements or pasted Mermaid flowchart, sequenceDiagram, and stateDiagram input; inspect repository evidence when the diagram must reflect real code. Use when the user asks to visualize system architecture, infrastructure, cloud/security/network topology, technical workflows, API call sequences, request lifecycles, data pipelines, ETL/ELT, data lineage, state machines, or to convert/beautify Mermaid.
license: MIT
metadata:
  version: "2.17"
  author: tt-a1i
  based_on: Cocoon-AI/architecture-diagram-generator (MIT, v1.0)
---

# Archify

Create a self-contained, interactive HTML diagram from a small typed JSON specification. Static output is the default; enable motion only when the user asks for a demo or presentation.

## Existing candidate handoff

When the user supplies a frozen candidate and asks to validate, deliver, check provenance, and collect browser evidence, run `finalize` first as one CLI invocation. Those gate names describe the required outcomes; they do not request four standalone commands unless the user explicitly says to execute each command separately. A passing receipt completes the ordinary handoff without screenshots or an image-capable model. If it fails and the candidate needs repair, use standalone validation during that repair loop, then rerun `finalize` once.

The update check and `finalize` are independent. Once the frozen candidate exists, issue both commands in the same parallel tool batch when the harness supports parallel calls; otherwise run them sequentially. Never delay a required gate while waiting for update information.

## Fast authoring path

Use this bounded path for ordinary generation. Do not read the optional Viewer Runtime reference unless the user asks about those features.

1. Choose `architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle` from the question.
2. Use the exact paths in the Type router; do not list `schemas/` or `examples/` first. For Architecture, Workflow, or Sequence, read `references/authoring-defaults.md` and the matching starter example in one parallel tool batch. The starter covers ordinary field shapes; read the mode schema and `schemas/common.schema.json` before using a field absent from it, or when a schema diagnostic needs clarification. For Dataflow and Lifecycle, read defaults, the mode schema, common schema, and example together. Fresh authorship means new stable IDs, domain wording, and layout; use examples for field shape, not facts. When real product identity matters, query `node bin/archify.mjs brands "<name>" --json`; read `references/brand-marks.md` only for an unknown brand with a user-provided URL.
3. Artifact first: the next tool action must write the candidate. Write the candidate before inspecting renderer internals. Do not plan exact coordinates in prose. Start with one clear main path, short side branches, and sparse labels. Use roughly 12 primary nodes as an initial readability budget. Preserve every node and relationship required by the user's question; for larger diagrams, group related content where the selected schema supports it. Set `meta.quality_profile` to `"showcase"` unless the user explicitly requests a dense `standard` map. Start with automatic routes and labels. Do not add `via`, `channelX`, `channelY`, or `labelAt` before a diagnostic calls for one; test one repair hypothesis per round. When geometry fails or repeats, read the repair order in `references/authoring-contract.md` and inspect measured layout before manual routing: use `validate <type> <candidate.json> --layout-json` for architecture/workflow; for other types, use validation diagnostics and the rendered SVG geometry. Check whether unnecessary agent-added controls disable automatic port spread; preserve user-required route intent. If several edges share a constrained channel, compare a small node-layout change with adding route controls; validate the coupled change together while preserving required nodes, relationships, labels, and boundary membership.
4. Once the complete first candidate is written, run `finalize` directly. Its first gate is showcase validation; successful first drafts need no separate pre-validation. Keep the candidate unchanged while the command runs:

   ```bash
   node bin/archify.mjs finalize <type> <candidate.json> <output.html> --quality showcase --json
   ```

   A passing receipt proves that the included `validate`, `deliver`, strict `check`, and deterministic real-browser `browser-check` gates passed. When a request names those gates or asks that each pass, do not rerun the individual commands afterward; use a standalone command only for an explicitly separate execution or focused failure diagnosis.

5. A non-zero exit can never be described as success. If a gate fails, read the reported full receipt, use its diagnosed subjects and measured evidence to choose one repair hypothesis, then rerun. Use standalone `validate <type> <candidate.json> --quality showcase --json` during a known repair loop, and `--layout-json` when measured layout is needed. A receipt with only 4 artifact checks is basic validation, never showcase acceptance: require all 9 artifact checks with 0 composition errors and 0 warnings. Fix a missing or misspelled `meta.quality_profile` before geometry. For workflow v2, use the stable compiler receipt; solver internals are not authoring controls. A passing final validation freezes the candidate; run `finalize` once to finish delivery. Missing evidence is a reason to inspect layout, not guess a constraint from the message. Compare remaining diagnostic codes and subjects within the same validation stage; a later stage can reveal new issues. If the same issue survives two focused repairs, inspect its measured geometry or the relevant implementation before changing that hypothesis. If it remains unresolved after that investigation and one evidence-based repair, stop and report it truthfully. A lower error count does not justify changing the diagram’s meaning.

## Update awareness

After the first candidate exists, run the packaged checker `scripts/check-update.mjs` once with Node. Batch it with the next independent validation or `finalize` command when the harness supports parallel tool calls. If the checker cannot run, continue without mentioning it.

- For `silent`, continue without mentioning the update check.
- For `update_available`, read `references/update-awareness.md`, follow it, then continue the requested task.

Do not read `renderers/shared/geometry.mjs`, renderer source, validator source, tests, or benchmarks before the first candidate. Inspect implementation only for a diagnostic without actionable evidence or after two focused repairs fail.

## Type router

| Type | Use for | Schema | Example |
|---|---|---|---|
| `architecture` | Components, services, cloud/security boundaries, infrastructure | `schemas/architecture.schema.json` | `examples/starter.architecture.json` |
| `workflow` | Processes, approval gates, tool calls, runbooks, CI/CD | `schemas/workflow.schema.json` | `examples/starter.workflow.json` |
| `sequence` | API call chains, request lifecycles, async traces, returns | `schemas/sequence.schema.json` | `examples/starter.sequence.json` |
| `dataflow` | Pipelines, ETL/ELT, lineage, governance, consumers | `schemas/dataflow.schema.json` | `examples/event-stream.dataflow.json` |
| `lifecycle` | State/status transitions, retries, waiting and terminal states | `schemas/lifecycle.schema.json` | `examples/deployment-release.lifecycle.json` |

When ambiguous, run `node bin/archify.mjs guide "<scenario>" --json`. Scenario proof examples are structural references, not facts to copy.

## Mermaid input

Read Mermaid for topology and meaning, then author fresh Archify JSON; do not mechanically render Mermaid styling.

- `flowchart` / `graph` → `workflow`, or `architecture` for a component map.
- `sequenceDiagram` → `sequence`; participants become semantic participants and arrows become messages.
- `stateDiagram` → `lifecycle`; states and transitions retain meaning, not Mermaid style.

## Delivery

Run the complete acceptance path directly on a first candidate, or after standalone validation completes a repair loop:

```bash
node bin/archify.mjs finalize <type> <candidate.json> <output.html> --quality showcase --json
```

`finalize` stops at the first non-passing gate. Its compact stdout is enough for a successful handoff; read the full `<output-stem>.finalize.json` only after failure or when detailed evidence is requested. A passing ordinary handoff reports `visualReview: "not-requested"` and creates no screenshots.

Escalate to perceptual review only when the user requests an aesthetic review, a template/renderer/viewer change needs visual regression evidence, a novel layout or browser diagnostic leaves low confidence, or the run is a sampled audit. Run `visual-check` on the finalized artifact, inspect its `.visual-check.contact.png` once with a capable image reader or human, and record that judgment separately. Open an individual viewport PNG only when the contact sheet shows a possible defect. Model image capability is optional because this path is not part of ordinary acceptance.

For recovery, the required order stays `deliver` → strict provenance `check` → `browser-check`. Run optional `visual-check` only against a strict-provenance artifact. Read `references/delivery-contract.md` for standalone syntax, any failed gate, stale provenance, recovery metadata, repeated delivery to one path, export evidence, or post-delivery opening.

For workflow viewport overflow, read [Workflow viewport repair](references/authoring-contract.md#workflow-viewport-repair) before the next layout edit.

`browser-check` collects machine-readable browser evidence from the exact delivered HTML without modifying, rerendering, or capturing it. `visual-check` is the capture-producing command for an escalated perceptual review.

Keep the claims separate: `deliver` proves deterministic artifact checks, `browser-check` proves bounded behavior in a real browser, `visual-check` adds artifact-bound captures, and perceptual review requires an actual human or image-capable reviewer. Report optional perceptual review only when it was requested or triggered by the escalation rules above.

Add `--open` only when the user wants an immediate local preview. For an active desktop authoring loop, the optional command is:

```bash
node bin/archify.mjs preview <type> <input>.json <output>.html --quality showcase
```

Never start preview by default.

## Optional viewer capabilities

Generated HTML already contains theme switching, pan/zoom, search, focus, relationship tracing, semantic views, presentation, and truthful exports. These are reader capabilities, not extra authoring work. `meta.animation: "trace"` is opt-in; `meta.views` is optional and should contain at most five curated chapters.

Read `references/viewer-runtime.md` only when the user explicitly asks for Share Cards, Route/Reach cards, motion, guided stories, deep links, presentation, search/focus, or another Viewer Runtime feature.

## Setup and fallback

No install is required inside the skill package. Verify with:

```bash
node bin/archify.mjs doctor
node bin/archify.mjs demo <output-directory>
```

When shell access is unavailable, hand-place architecture SVG into `assets/template.html`, use CSS semantic classes rather than inline colors, and follow the visual review contract in `references/delivery-contract.md`.

## Output

Return the checked HTML path, diagram type, validation summary, specification/artifact receipt, browser-evidence status, and truthful visual-review status. Do not claim success for a non-zero command or claim visual inspection you did not perform.
