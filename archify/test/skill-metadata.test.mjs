import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.join(here, '..');
const skill = readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
const authoringContract = readFileSync(path.join(skillRoot, 'references', 'authoring-contract.md'), 'utf8');
const authoringDefaults = readFileSync(path.join(skillRoot, 'references', 'authoring-defaults.md'), 'utf8');
const updateAwareness = readFileSync(path.join(skillRoot, 'references', 'update-awareness.md'), 'utf8');
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);

test('skill description is portable across 1024-character runtimes and remains searchable', () => {
  assert.ok(frontmatter, 'SKILL.md must start with YAML frontmatter');
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  assert.ok(description, 'frontmatter must include a one-line description');
  assert.ok(description.length <= 1024, `description is ${description.length} characters; maximum is 1024`);
  assert.ok(Buffer.byteLength(description, 'utf8') <= 1024, 'description must also fit a 1024-byte runtime limit');

  for (const trigger of ['architecture', 'workflow', 'sequence', 'data-flow', 'lifecycle', 'Mermaid']) {
    assert.match(description, new RegExp(`\\b${trigger}\\b`, 'i'), `description must retain the ${trigger} trigger`);
  }
  assert.match(description, /standalone HTML/i);
  assert.match(description, /Use when/i);
});

test('literal packaged-skill path references resolve inside the installed skill root', () => {
  const references = [...skill.matchAll(/`((?:assets|bin|examples|recipes|references|renderers|schemas|scripts)\/[^`\s]+)`/g)]
    .map((match) => match[1])
    .filter((reference) => !/[<>{}*\[\]]/.test(reference));

  assert.ok(references.length > 0, 'expected literal packaged-skill references');
  for (const reference of new Set(references)) {
    assert.equal(existsSync(path.join(skillRoot, reference)), true, `SKILL.md references missing packaged path ${reference}`);
  }
});

test('main skill stays a bounded authoring router with progressive references', () => {
  const lines = skill.trimEnd().split('\n');
  assert.ok(lines.length <= 160, `SKILL.md is ${lines.length} lines; keep the entrypoint at 160 or fewer`);
  assert.ok(Buffer.byteLength(skill, 'utf8') <= 13000, `SKILL.md is ${Buffer.byteLength(skill, 'utf8')} bytes; keep branch-specific rules progressively disclosed`);
  for (const reference of [
    'references/authoring-defaults.md',
    'references/authoring-contract.md',
    'references/update-awareness.md',
    'references/viewer-runtime.md',
    'references/delivery-contract.md',
  ]) {
    assert.match(skill, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(existsSync(path.join(skillRoot, reference)), true, `${reference} must ship with the skill`);
  }
});

test('fresh authoring routes directly to a starter or full schema example without directory discovery', () => {
  assert.match(skill, /do not list `schemas\/` or `examples\/` first/i);
  const routes = {
    architecture: ['schemas/architecture.schema.json', 'examples/starter.architecture.json'],
    workflow: ['schemas/workflow.schema.json', 'examples/starter.workflow.json'],
    sequence: ['schemas/sequence.schema.json', 'examples/cache-miss-request.sequence.json'],
    dataflow: ['schemas/dataflow.schema.json', 'examples/event-stream.dataflow.json'],
    lifecycle: ['schemas/lifecycle.schema.json', 'examples/deployment-release.lifecycle.json'],
  };
  for (const [type, references] of Object.entries(routes)) {
    const row = skill.split('\n').find((line) => line.startsWith(`| \`${type}\``));
    assert.ok(row, `missing Type router row for ${type}`);
    for (const reference of references) {
      assert.match(row, new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(existsSync(path.join(skillRoot, reference)), true, `${reference} must ship with the skill`);
    }
  }
});

test('update awareness is notification-only and never replaces the requested workflow', () => {
  assert.match(skill, /`scripts\/check-update\.mjs`/);
  assert.match(skill, /Batch it with the next independent validation or `finalize` command/i);
  assert.match(skill, /Never delay a required gate while waiting for update information/i);
  assert.match(skill, /`silent`[\s\S]*without mentioning/i);
  assert.match(skill, /`update_available`[\s\S]*references\/update-awareness\.md/i);
  assert.match(updateAwareness, /compact notice/i);
  assert.match(updateAwareness, /information, not permission/i);
  assert.match(updateAwareness, /`severity` is `security`[\s\S]*security update[\s\S]*emphasis only, never reduced user autonomy/i);
  assert.match(updateAwareness, /continue the user's original task/i);
  assert.match(updateAwareness, /installed version unchanged/i);
  assert.doesNotMatch(`${skill}\n${updateAwareness}`, /npx skills update|gh skill update/i);
});

test('language behavior stays within the bounded locale contract', () => {
  assert.match(skill, /references\/authoring-defaults\.md/);
  assert.match(authoringDefaults, /one primary authored language/);
  assert.match(authoringDefaults, /explicit user choice; otherwise follow the request or conversation's dominant language/);
  assert.match(authoringDefaults, /`meta\.locale` controls only renderer-owned Viewer UI/);
  assert.match(authoringDefaults, /use `"en"`, `"zh-CN"`, or `"es"`/);
  assert.match(authoringDefaults, /For every other language, omit `meta\.locale`/);
  assert.match(authoringDefaults, /fixed Viewer UI and `<html lang>` fall back to English/);
  assert.match(authoringDefaults, /renderer never translates authored content/i);
  assert.match(authoringDefaults, /product names.*code identifiers.*protocols.*API paths.*environment names/);
  assert.match(authoringContract, /`meta\.locale` controls only renderer-owned reader surfaces/);
  assert.match(authoringContract, /outside `en`, `zh-CN`, and `es`/);
  assert.match(authoringContract, /artifact is\s+not fully localized/);
  assert.match(authoringContract, /Do not silently substitute\s+`zh-CN` for another language or Chinese locale/);
  assert.match(authoringContract, /It never translates authored content/);
  assert.match(authoringContract, /Renderer-owned default legend labels follow `meta\.locale`/);
  assert.match(authoringContract, /The fallback\s+applies only to renderer-owned surfaces/);
});

test('skill keeps the title hierarchy compact by default', () => {
  assert.match(skill, /references\/authoring-defaults\.md/);
  assert.match(authoringDefaults, /Omit `meta\.subtitle` by default/);
  assert.match(authoringDefaults, /Never invent a subtitle that restates the title, nodes, or cards/);
  assert.match(authoringContract, /omitted or blank subtitle must not leave an empty visual row/);
});
