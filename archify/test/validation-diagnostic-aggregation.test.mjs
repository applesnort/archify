import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compactFinalizeReceipt } from '../bin/finalize.mjs';
import { validateRepositoryDeclaration, verifyRepositoryEvidence } from '../renderers/shared/repository-evidence.mjs';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const CASES = {
  architecture: ['web-app.architecture.json', 'components'],
  workflow: ['agent-tool-call.workflow.json', 'nodes'],
  sequence: ['cache-miss-request.sequence.json', 'participants'],
  dataflow: ['product-analytics.dataflow.json', 'nodes'],
  lifecycle: ['agent-run.lifecycle.json', 'states'],
};

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-diagnostic-aggregation-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fixture(type = 'architecture') {
  return JSON.parse(fs.readFileSync(path.join(skillRoot, 'examples', CASES[type][0]), 'utf8'));
}

function independentErrors(type = 'architecture') {
  const document = fixture(type);
  document.meta.views = [{ id: 'overview', label: 'Overview', focus: ['absent-target'], note: 'n'.repeat(141) }];
  document.meta.repository = { url: 'https://forge.example.test/team/service', revision: 'a'.repeat(40) };
  document[CASES[type][1]][0].sources = [{ path: 'src/service.mjs', label: 's'.repeat(49) }];
  return document;
}

// Load the real shared entry in a fresh process. Imports finish before side-effect
// sentinels are installed. Only the requested input read is allowed afterward.
// Named spawnSync bindings are synchronized so a hidden Git call also fails.
function probe(t, document, { type = 'architecture', raw, fault = false } = {}) {
  const cwd = workspace(t);
  const input = path.join(cwd, 'input.json');
  const output = path.join(cwd, 'trusted.html');
  const bytes = raw ?? JSON.stringify(document);
  fs.writeFileSync(input, bytes);
  fs.writeFileSync(output, 'trusted artifact');
  const cliUrl = pathToFileURL(path.join(skillRoot, 'renderers/shared/cli.mjs')).href;
  const diagnosticUrl = pathToFileURL(path.join(skillRoot, 'renderers/shared/diagnostics.mjs')).href;
  const script = `
    import fs from 'node:fs';
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    const { loadDiagram } = await import(${JSON.stringify(cliUrl)});
    const { rendererFailure } = await import(${JSON.stringify(diagnosticUrl)});
    const input = ${JSON.stringify(input)};
    const source = fs.readFileSync(input, 'utf8');
    if (${fault}) {
      const originalParse = JSON.parse;
      const document = originalParse(source);
      document.meta.views.forEach = () => { throw new TypeError('injected guided implementation fault'); };
      JSON.parse = (text, ...rest) => text === source ? document : originalParse(text, ...rest);
    }
    const counts = { inputRead: 0, otherRead: 0, realpath: 0, git: 0, write: 0 };
    const originalRead = fs.readFileSync;
    fs.readFileSync = (file, ...rest) => {
      if (String(file) === input) { counts.inputRead += 1; return originalRead(file, ...rest); }
      counts.otherRead += 1; throw new Error('unexpected post-input file read');
    };
    fs.realpathSync = () => { counts.realpath += 1; throw new Error('unexpected repository/output realpath'); };
    fs.writeFileSync = () => { counts.write += 1; throw new Error('unexpected artifact write'); };
    childProcess.spawnSync = () => { counts.git += 1; throw new Error('unexpected child/Git spawn'); };
    syncBuiltinESMExports();
    process.env.ARCHIFY_REPO_ROOT = ${JSON.stringify(cwd)};
    let failure = null;
    try {
      loadDiagram({ rendererDir: ${JSON.stringify(path.join(skillRoot, 'renderers', type))},
        diagramType: ${JSON.stringify(type)}, defaultExample: '',
        argv: ['node', 'renderer', input, ${JSON.stringify(output)}] });
    } catch (error) { failure = rendererFailure(error); }
    console.log(JSON.stringify({ failure, counts }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd, encoding: 'utf8', timeout: 10000,
    env: { ...process.env, ARCHIFY_DIAGNOSTIC_FORMAT: 'json', ARCHIFY_UPDATE_CHECK_DISABLED: '1' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  const observed = JSON.parse(result.stdout);
  assert.ok(observed.failure, 'invalid input must not leave the loader');
  assert.deepEqual(observed.counts, { inputRead: 1, otherRead: 0, realpath: 0, git: 0, write: 0 });
  assert.equal(fs.readFileSync(input, 'utf8'), bytes, 'input must remain unchanged');
  assert.equal(fs.readFileSync(output, 'utf8'), 'trusted artifact');
  return observed.failure;
}

function codes(failure) { return failure.diagnostics.map((entry) => entry.code); }

for (const type of Object.keys(CASES)) {
  test(`${type}: independent display, focus and declaration errors are exposed before I/O`, (t) => {
    const failure = probe(t, independentErrors(type), { type });
    assert.deepEqual(codes(failure), ['schema/maxLength', 'schema/maxLength', 'guided-view/invalid', 'repository-evidence/links-unsupported']);
    const schemaPaths = failure.diagnostics.filter((entry) => entry.code === 'schema/maxLength').map((entry) => entry.subject.path).sort();
    assert.deepEqual(schemaPaths, [`/${CASES[type][1]}/0/sources/0/label`, '/meta/views/0/note'].sort());
    assert.match(failure.diagnostics[2].message, /\/meta\/views\/0\/focus\/0 references unknown semantic id "absent-target"/);
    assert.equal(failure.diagnostics[3].subject.path, '/meta/repository/url');
  });
}

test('repairing display and focus errors does not bypass the full repository gate', (t) => {
  const document = independentErrors();
  document.meta.views[0].note = 'A short note';
  document.components[0].sources[0].label = 'Source';
  assert.deepEqual(codes(probe(t, document)), ['guided-view/invalid', 'repository-evidence/links-unsupported']);
  document.meta.views[0].focus = [document.components[0].id];
  assert.deepEqual(codes(probe(t, document)), ['repository-evidence/links-unsupported']);
  document.meta.repository.link_mode = 'local-only';
  assert.doesNotThrow(() => validateRepositoryDeclaration('architecture', document));
  assert.throws(() => verifyRepositoryEvidence('architecture', document),
    (error) => error.archifyDiagnostics?.[0]?.code === 'repository-evidence/root-required');
});

test('parsed-identical JSON whitespace variants have exactly the same diagnostics', (t) => {
  const document = independentErrors();
  const compact = JSON.stringify(document);
  const spaced = ` \n${JSON.stringify(document, null, 2)}\n\t `;
  assert.deepEqual(JSON.parse(compact), JSON.parse(spaced));
  assert.notEqual(compact, spaced);
  assert.deepEqual(probe(t, document, { raw: compact }).diagnostics,
    probe(t, document, { raw: spaced }).diagnostics);
});

const unsafeShapes = {
  'null meta': (doc) => { doc.meta = null; },
  'missing collection': (doc) => { delete doc.components; },
  'non-array collection': (doc) => { doc.components = {}; },
  'null node': (doc) => { doc.components[0] = null; },
  'non-array focus': (doc) => { doc.meta.views[0].focus = 'absent-target'; },
  'wrong focus item type': (doc) => { doc.meta.views[0].focus = [null]; },
  'missing view label': (doc) => { delete doc.meta.views[0].label; },
  'extra view property': (doc) => { doc.meta.views[0].unsupported = true; },
  'invalid view id': (doc) => { doc.meta.views[0].id = '!'; },
  'too many source entries': (doc) => { doc.components[0].sources = Array(4).fill({ path: 'src/a.mjs' }); },
};
for (const [name, mutate] of Object.entries(unsafeShapes)) {
  test(`${name}: mixed schema errors retain the structural hard stop`, (t) => {
    const document = independentErrors(); mutate(document);
    const failure = probe(t, document);
    assert.ok(codes(failure).every((code) => code.startsWith('schema/')));
    assert.ok(codes(failure).some((code) => code !== 'schema/maxLength'));
  });
}

test('maxLength on a source path does not enable cross-field aggregation', (t) => {
  const document = independentErrors();
  document.components[0].sources[0].path = 'x'.repeat(241);
  const failure = probe(t, document);
  assert.ok(codes(failure).every((code) => code === 'schema/maxLength'));
  assert.ok(failure.diagnostics.some((entry) => entry.subject.path === '/components/0/sources/0/path'));
});

test('malformed JSON retains only its input parse failure', (t) => {
  assert.deepEqual(codes(probe(t, null, { raw: '{"meta":' })), ['input/json-parse']);
});

test('a valid declaration cannot cause Git access while a display error remains', (t) => {
  const document = independentErrors();
  document.meta.views[0].focus = [document.components[0].id];
  document.meta.repository.link_mode = 'local-only';
  assert.deepEqual(codes(probe(t, document)), ['schema/maxLength', 'schema/maxLength']);
});

test('an unclassified guided exception is not hidden by an earlier captured schema error', (t) => {
  const failure = probe(t, independentErrors(), { fault: true });
  assert.deepEqual(codes(failure), ['internal/unclassified']);
  assert.match(failure.error, /injected guided implementation fault/);
});

test('declaration parsing preserves dependency order and does not claim verified evidence', () => {
  const document = independentErrors();
  document.meta.repository = { url: 'https://github.com/example/project', revision: 'a'.repeat(40) };
  const declaration = validateRepositoryDeclaration('architecture', document);
  assert.equal(declaration.linkMode, 'web');
  assert.equal(Object.hasOwn(declaration, 'verified'), false);
  document.meta.repository.url = 'https://user:password@example.test/team/project';
  assert.throws(() => validateRepositoryDeclaration('architecture', document),
    (error) => error.archifyDiagnostics?.[0]?.code === 'repository-evidence/url-invalid'
      && error.archifyDiagnostics.length === 1);
  delete document.meta.repository;
  assert.throws(() => validateRepositoryDeclaration('architecture', document),
    (error) => error.archifyDiagnostics?.[0]?.code === 'repository-evidence/repository-required');
  delete document.components[0].sources;
  assert.equal(validateRepositoryDeclaration('architecture', document), null);
});

test('compact finalize preserves seven independently constructed findings without inventing success', (t) => {
  const document = independentErrors();
  document.meta.views[0].label = 'l'.repeat(49);
  document.meta.views.push({ id: 'detail', label: 'Detail', focus: ['second-absent-target'], note: 'n'.repeat(141) });
  const failure = probe(t, document);
  assert.deepEqual(codes(failure), ['schema/maxLength', 'schema/maxLength', 'schema/maxLength', 'schema/maxLength',
    'guided-view/invalid', 'guided-view/invalid', 'repository-evidence/links-unsupported']);
  assert.deepEqual(failure.diagnostics.filter((entry) => entry.code === 'schema/maxLength')
    .map((entry) => entry.subject.path).sort(),
  ['/meta/views/0/label', '/meta/views/0/note', '/meta/views/1/note', '/components/0/sources/0/label'].sort());
  const compact = compactFinalizeReceipt({ ok: false, status: 'fail', failedStage: 'validate',
    type: 'architecture', quality: 'showcase', specification: { path: 'candidate.json' },
    stages: { validate: { status: 'fail' } }, diagnostics: failure.diagnostics });
  assert.equal(compact.ok, false);
  assert.deepEqual(compact.diagnosticSummary, { total: 7, shown: 7, truncated: false });
  assert.deepEqual(new Set(compact.diagnostics.map((entry) => entry.code)),
    new Set(['schema/maxLength', 'guided-view/invalid', 'repository-evidence/links-unsupported']));
  assert.equal(compact.gates.deliver, 'not-run');
});

test('public validate/deliver keep failure status, surface every family and preserve trusted output', (t) => {
  const cwd = workspace(t);
  const input = path.join(cwd, 'input.json');
  const output = path.join(cwd, 'trusted.html');
  const bytes = JSON.stringify(independentErrors());
  fs.writeFileSync(input, bytes); fs.writeFileSync(output, 'trusted artifact');
  for (const command of ['validate', 'deliver']) {
    const args = [path.join(skillRoot, 'bin/archify.mjs'), command, 'architecture', input,
      ...(command === 'deliver' ? [output] : []), '--json'];
    const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, ARCHIFY_UPDATE_CHECK_DISABLED: '1' } });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const failure = JSON.parse(result.stdout);
    assert.equal(failure.ok, false);
    assert.deepEqual(codes(failure), ['schema/maxLength', 'schema/maxLength', 'guided-view/invalid', 'repository-evidence/links-unsupported']);
    assert.equal(fs.readFileSync(input, 'utf8'), bytes);
    assert.equal(fs.readFileSync(output, 'utf8'), 'trusted artifact');
  }
});
