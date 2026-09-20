#!/usr/bin/env python3
"""Add conservative display labels to observed spans without changing them."""

from __future__ import annotations

import argparse
import json
import pathlib
import shlex
from typing import Any, Mapping


READ_TOOLS = {"cat", "head", "tail", "sed", "nl", "awk", "grep", "rg", "find", "ls", "pwd", "stat", "wc", "realpath"}
CLI_PHASES = {"validate", "render", "finalize", "deliver", "check"}


def _unwrap_shell(command: str) -> tuple[list[str] | None, str]:
    """Unwrap one exact shell ``-lc``/``-c`` payload, rejecting compounds."""
    try:
        outer = shlex.split(command)
    except ValueError:
        return None, "unparseable command"
    if not outer:
        return None, "empty command"
    executable = pathlib.Path(outer[0]).name.lower()
    if executable not in {"sh", "bash", "zsh", "dash", "fish"}:
        return outer, "direct command"
    if len(outer) != 3 or outer[1] not in {"-c", "-lc"}:
        return None, "shell form is not exact single payload"
    payload = outer[2]
    if any(token in payload for token in ("&&", "||", ";", "|", ">", "<", "\n", "\r", "<<")):
        return None, "compound shell payload"
    try:
        inner = shlex.split(payload)
    except ValueError:
        return None, "unparseable shell payload"
    return inner if inner else None, "exact shell payload"


def classify(command: Any) -> tuple[str, str]:
    if not isinstance(command, str) or not command.strip():
        return "unknown", "missing command"
    tokens, basis = _unwrap_shell(command)
    if tokens is None:
        return "unknown", basis
    executable = pathlib.Path(tokens[0]).name.lower()
    if executable == "rg" and "--files" in tokens and "source" in " ".join(tokens).lower():
        return "repo_discovery", "exact rg --files source operation"
    if executable in READ_TOOLS:
        joined = " ".join(tokens[1:]).lower()
        if executable in {"cat", "nl"} and ("skill.md" in joined or "references/" in joined):
            return "run_setup", "exact Skill/reference read"
        if executable in {"cat", "nl"} and "source" in joined:
            return "evidence_read", "exact source read executable"
        return "evidence_read", "exact simple read executable"
    if executable == "git" and len(tokens) > 1 and tokens[1].lower() in {"show", "diff", "log", "status", "ls-files", "rev-parse"}:
        return "repo_discovery", "exact git read operation"
    for index, token in enumerate(tokens):
        if pathlib.Path(token).name == "archify.mjs" and index + 1 < len(tokens) and tokens[index + 1].lower() in CLI_PHASES:
            operation = tokens[index + 1].lower()
            if operation == "validate":
                return "input_schema", "exact Archify validate operation"
            if operation in {"finalize", "deliver"}:
                return "combined_pipeline", "exact Archify finalize/deliver operation"
            return "delivery_finish", "exact Archify CLI operation"
    return "unknown", "compound or unclassified command"


def annotate(spans: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for source in spans:
        row = dict(source)
        phase, basis = classify(source.get("command"))
        row["raw_phase"] = source.get("phase")
        row["annotated_phase"] = phase
        row["annotation_basis"] = basis
        output.append(row)
    return output


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spans", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args(argv)
    rows = []
    if args.spans.exists():
        for line in args.spans.read_text(encoding="utf-8").splitlines():
            try:
                value = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(value, Mapping):
                rows.append(value)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as handle:
        for row in annotate(rows):
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"spans": len(rows), "output": str(args.output)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
