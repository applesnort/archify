import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import {
  compactFinalizeReceipt,
  defaultFinalizeReceiptPath,
  defaultFinalizeSummaryPath,
  runFinalize,
} from '../bin/finalize.mjs';

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-finalize-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function result(receipt, status = 0, stderr = '') {
  return { status, signal: null, stdout: `${JSON.stringify(receipt)}\n`, stderr };
}

test('finalize reuses delivery validation, runs one build, and keeps full stage receipts out of its compact summary', t => {
  const directory = workspace(t);
  const input = path.join(directory, 'diagram.json');
  const output = path.join(directory, 'diagram.html');
  const outDir = path.join(directory, 'evidence');
  const source = '{"meta":{"quality_profile":"showcase"}}';
  fs.writeFileSync(input, source);
  const specificationSha256 = createHash('sha256').update(source).digest('hex');
  const calls = [];
  const runCommand = ({ stage, args }) => {
    calls.push({ stage, args });
    if (stage === 'deliver') {
      fs.writeFileSync(output, '<!doctype html><title>verified</title>');
      return result({
        schemaVersion: 1,
        ok: true,
        command: 'deliver',
        specification: { sha256: specificationSha256, bytes: source.length },
        artifact: { path: output, sha256: 'delivery-sha', bytes: 46 },
        validation: {
          checksPassed: 9,
          checkCount: 9,
          compositionStatus: 'pass',
          errors: 0,
          warnings: 0,
        },
      });
    }
    if (stage === 'check') return result({
      schemaVersion: 1,
      ok: true,
      artifact: { sha256: 'check-sha', bytes: 46 },
      checks: [{ name: 'artifact', ok: true }],
      provenance: 'current',
    });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'diagram.browser-check.json'), 'browser evidence');
    return result({
      schemaVersion: 1,
      ok: true,
      command: 'browser-check',
      status: 'pass',
      visualReview: 'not-requested',
      diagnostics: [],
      sidecars: { directory: outDir, receipt: 'diagram.browser-check.json' },
      containment: { viewports: [{ large: 'large-stage-array-is-kept-only-in-full-receipt' }] },
      captures: { status: 'not-requested', screenshots: [], contactSheet: null, contactSheetImage: null },
    });
  };

  const finalized = runFinalize({
    cliPath: '/fake/archify.mjs',
    type: 'architecture',
    input,
    output,
    outDir,
    runCommand,
  });

  assert.equal(finalized.exitCode, 0);
  assert.equal(finalized.receipt.ok, true);
  assert.deepEqual(calls.map(({ stage }) => stage), ['deliver', 'check', 'browser-check']);
  assert.deepEqual(finalized.summary.gates, {
    validate: 'pass', deliver: 'pass', check: 'pass', 'browser-check': 'pass',
  });
  assert.equal(finalized.summary.evidence.browserCheckReceipt, path.join(outDir, 'diagram.browser-check.json'));
  assert.equal(finalized.summary.visualReview, 'not-requested');
  assert.equal('stages' in finalized.summary, false);
  assert.equal(JSON.stringify(finalized.summary).includes('large-stage-array'), false);
  assert.equal(finalized.receipt.stages['browser-check'].receipt.containment.viewports.length, 1);

  const receiptPath = defaultFinalizeReceiptPath(output, { outDir });
  assert.equal(finalized.summary.evidence.receipt, receiptPath);
  const summaryPath = defaultFinalizeSummaryPath(receiptPath);
  assert.equal(finalized.summary.evidence.summaryReceipt, summaryPath);
  const persisted = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  assert.equal(persisted.ok, true);
  assert.equal(persisted.stages.validate.execution, 'embedded-in-deliver');
  assert.equal(persisted.stages.validate.receipt.validation.checkCount, 9);
  const persistedSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.equal(persistedSummary.ok, true);
  assert.equal('stages' in persistedSummary, false);
});

test('finalize stops at the failed gate and persists actionable failure evidence', t => {
  const directory = workspace(t);
  const input = path.join(directory, 'diagram.json');
  const output = path.join(directory, 'diagram.html');
  fs.writeFileSync(input, '{}');
  const calls = [];
  const finalized = runFinalize({
    cliPath: '/fake/archify.mjs',
    type: 'workflow',
    input,
    output,
    runCommand: ({ stage }) => {
      calls.push(stage);
      return result({
        ok: false,
        command: 'deliver',
        stage: 'render',
        diagnostics: [{
          code: 'composition/route-crossing',
          severity: 'error',
          message: 'A route crosses an unrelated node.',
          subject: { edge: 'a-b' },
          evidence: { intersection: [12, 40] },
          supportedFixes: ['move the diagnosed route'],
        }],
      }, 1);
    },
  });

  assert.equal(finalized.exitCode, 1);
  assert.deepEqual(calls, ['deliver']);
  assert.equal(finalized.receipt.failedStage, 'validate');
  assert.equal(finalized.summary.gates.deliver, 'not-run');
  assert.equal(finalized.summary.gates.check, 'not-run');
  assert.equal(finalized.summary.gates['browser-check'], 'not-run');
  assert.deepEqual(finalized.summary.diagnostics, [{
    code: 'composition/route-crossing',
    severity: 'error',
    message: 'A route crosses an unrelated node.',
    subject: { edge: 'a-b' },
    evidence: { intersection: [12, 40] },
    supportedFixes: ['move the diagnosed route'],
  }]);
  assert.deepEqual(finalized.summary.diagnosticSummary, { total: 1, shown: 1, truncated: false });
  assert.deepEqual(finalized.summary.nextAction, {
    action: 'edit-in-place',
    candidate: input,
    constraint: 'Preserve unaffected semantics and geometry; do not replace the whole candidate.',
    then: 'validate-once',
  });
  assert.equal(finalized.receipt.diagnostics[0].evidence.intersection[1], 40);
  assert.equal(JSON.parse(fs.readFileSync(finalized.summary.evidence.receipt)).status, 'fail');
  const persistedSummary = JSON.parse(fs.readFileSync(finalized.summary.evidence.summaryReceipt));
  assert.deepEqual(persistedSummary, finalized.summary);
});

test('compact finalize receipts preserve the acceptance boundary', () => {
  const compact = compactFinalizeReceipt({
    ok: true,
    status: 'pass',
    type: 'sequence',
    quality: 'showcase',
    specification: { path: '/tmp/spec.json', sha256: 'spec' },
    artifact: { path: '/tmp/artifact.html', sha256: 'artifact' },
    stages: Object.fromEntries(['validate', 'deliver', 'check', 'browser-check'].map((stage) => [stage, { status: 'pass' }])),
    diagnostics: [],
    evidence: { receipt: '/tmp/artifact.finalize.json', browserCheckReceipt: '/tmp/artifact.browser-check.json' },
    visualReview: 'not-requested',
    durationMs: 4200,
  });
  assert.equal(compact.ok, true);
  assert.equal(compact.visualReview, 'not-requested');
  assert.equal(compact.gates['browser-check'], 'pass');
  assert.equal(compact.evidence.browserCheckReceipt.endsWith('.json'), true);
  assert.deepEqual(compact.diagnosticSummary, { total: 0, shown: 0, truncated: false });
  assert.equal('nextAction' in compact, false);
});

test('compact failure receipts retain diverse actionable subjects without embedding full stage evidence', () => {
  const diagnostics = Array.from({ length: 20 }, (_, index) => ({
    code: 'composition/proper-crossing',
    severity: 'error',
    message: `Connection edge-${index} crosses another route.`,
    subject: { id: `edge-${index}`, collection: 'connections', index },
    evidence: { crossing: { x: index * 10, y: index * 20 } },
    supportedFixes: [`move edge-${index} without changing its endpoints`],
  }));
  const receipt = {
    ok: false,
    status: 'fail',
    failedStage: 'validate',
    type: 'architecture',
    quality: 'showcase',
    specification: { path: '/tmp/spec.json', sha256: 'spec' },
    artifact: { path: '/tmp/artifact.html' },
    stages: { validate: { status: 'fail', receipt: { diagnostics, renderedHtml: 'x'.repeat(100000) } } },
    diagnostics,
    evidence: {
      receipt: '/tmp/artifact.finalize.json',
      summaryReceipt: '/tmp/artifact.finalize-summary.json',
    },
  };

  const compact = compactFinalizeReceipt(receipt);
  assert.equal(compact.diagnostics.length, 8);
  assert.equal(new Set(compact.diagnostics.map(({ subject }) => subject.id)).size, 8);
  assert.deepEqual(compact.diagnosticSummary, { total: 20, shown: 8, truncated: true });
  assert.equal(compact.nextAction.action, 'edit-in-place');
  assert.equal('stages' in compact, false);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(receipt).length / 4);
});

test('finalize refuses a receipt path that aliases a gate sidecar', t => {
  const directory = workspace(t);
  const input = path.join(directory, 'diagram.json');
  const output = path.join(directory, 'diagram.html');
  const visualReceipt = path.join(directory, 'diagram.browser-check.json');
  fs.writeFileSync(input, '{}');
  fs.writeFileSync(visualReceipt, 'preserve me');
  let invoked = false;

  assert.throws(() => runFinalize({
    cliPath: '/fake/archify.mjs',
    type: 'architecture',
    input,
    output,
    receiptPath: visualReceipt,
    runCommand: () => { invoked = true; return result({ ok: true }); },
  }), /gate sidecars/);
  assert.equal(invoked, false);
  assert.equal(fs.readFileSync(visualReceipt, 'utf8'), 'preserve me');
});

test('finalize binds a passing validate receipt to the unchanged candidate', t => {
  const directory = workspace(t);
  const input = path.join(directory, 'diagram.json');
  const output = path.join(directory, 'diagram.html');
  const source = '{"meta":{"quality_profile":"showcase"}}';
  fs.writeFileSync(input, source);
  const candidateSha256 = createHash('sha256').update(source).digest('hex');
  const calls = [];
  const pass = runFinalize({
    cliPath: '/fake/archify.mjs',
    type: 'architecture',
    input,
    output,
    candidateSha256,
    runCommand: ({ stage }) => {
      calls.push(stage);
      if (stage === 'deliver') fs.writeFileSync(output, '<!doctype html>');
      if (stage === 'deliver') return result({
        ok: true,
        command: stage,
        specification: { sha256: candidateSha256, bytes: source.length },
        artifact: { path: output },
        validation: {
          checksPassed: 9,
          checkCount: 9,
          compositionStatus: 'pass',
          errors: 0,
          warnings: 0,
        },
      });
      if (stage === 'check') return result({
        ok: true,
        artifact: { path: output },
        checks: [{ ok: true }],
        provenance: 'current',
      });
      return result({ ok: true, command: stage, status: 'pass', sidecars: {} });
    },
  });
  assert.equal(pass.exitCode, 0);
  assert.deepEqual(calls, ['deliver', 'check', 'browser-check']);

  fs.writeFileSync(input, `${source}\n`);
  assert.throws(() => runFinalize({
    cliPath: '/fake/archify.mjs',
    type: 'architecture',
    input,
    output: path.join(directory, 'changed.html'),
    candidateSha256,
    runCommand: () => { throw new Error('must not run'); },
  }), error => {
    assert.equal(error.finalizeCode, 'finalize/candidate-changed');
    assert.equal(error.finalizeEvidence.expectedSha256, candidateSha256);
    return true;
  });
});

test('finalize fails closed when a stage exits zero without a valid passing receipt', t => {
  const invalidOutputs = [
    '',
    'not json',
    '{}',
    '"success"',
    '{"ok":true,"status":"fail","command":"validate","checks":[]}',
  ];

  for (const [index, stdout] of invalidOutputs.entries()) {
    const directory = workspace(t);
    const input = path.join(directory, `diagram-${index}.json`);
    const output = path.join(directory, `diagram-${index}.html`);
    fs.writeFileSync(input, '{}');
    const calls = [];
    const finalized = runFinalize({
      cliPath: '/fake/archify.mjs',
      type: 'architecture',
      input,
      output,
      runCommand: ({ stage }) => {
        calls.push(stage);
        return { status: 0, signal: null, stdout, stderr: '' };
      },
    });
    assert.equal(finalized.exitCode, 1, `invalid receipt ${index} must fail`);
    assert.deepEqual(calls, ['deliver']);
    assert.equal(finalized.receipt.failedStage, 'deliver');
    assert.equal(finalized.summary.diagnostics[0].code, 'finalize/invalid-stage-receipt');
  }
});
