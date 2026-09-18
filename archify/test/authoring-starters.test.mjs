import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const type of ['architecture', 'workflow', 'sequence']) {
  test(`${type} starter passes showcase using current static authoring defaults`, () => {
    const input = path.join(skillRoot, 'examples', `starter.${type}.json`);
    const source = JSON.parse(readFileSync(input, 'utf8'));
    assert.equal(source.schema_version, type === 'workflow' ? 2 : 1);
    assert.equal(source.meta.quality_profile, 'showcase');
    for (const field of ['animation', 'visual_preset', 'subtitle', 'views', 'output']) {
      assert.equal(source.meta[field], undefined, `starter must not opt into ${field}`);
    }
    const result = spawnSync(process.execPath, [
      path.join(skillRoot, 'bin', 'archify.mjs'), 'validate', type, input, '--quality', 'showcase', '--json',
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.ok, true);
    assert.equal(receipt.checks.length, 9);
    assert.deepEqual(receipt.composition.summary, { errors: 0, warnings: 0 });
  });
}
