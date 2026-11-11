// Validate the checked-in runtime without requiring a Rust toolchain or checkout.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bundleHash, readBundle, validateBundle } from './runtime-bundle.mjs';
import { lessons } from '../web/lessons.js';

const pkg = fileURLToPath(new URL('../web/pkg/', import.meta.url));
let directory;
let expectedHash;
if (process.argv[2]) {
  directory = resolve(process.argv[2]);
} else {
  const manifest = JSON.parse(readFileSync(join(pkg, 'manifest.json'), 'utf8'));
  assert.match(manifest.build, /^[a-f0-9]{64}$/, 'invalid runtime build hash');
  expectedHash = manifest.build;
  directory = join(pkg, expectedHash);
}
const files = readBundle(directory);
validateBundle(files);
if (expectedHash)
  assert.equal(bundleHash(files), expectedHash, 'versioned bundle has changed');
const { initSync, run_script } = await import(
  pathToFileURL(join(directory, 'scripturec.js')).href
);
initSync({ module: readFileSync(join(directory, 'scripturec_bg.wasm')) });
for (const [name, lesson] of Object.entries(lessons)) {
  const report = JSON.parse(await run_script(lesson.source));
  assert.equal(report.error, null, `${name}: ${report.error}`);
  if (lesson.output) assert.deepEqual(report.output, lesson.output, name);
}
const failure = JSON.parse(
  await run_script('genesis: praise "before"; confess "oops" amen'),
);
assert.deepEqual(failure.output, ['before']);
assert.match(failure.error, /uncaught sin: oops/);
const delayed = JSON.parse(
  await run_script('genesis: pray 0.01; praise "after" amen'),
);
assert.equal(delayed.error, null);
assert.deepEqual(delayed.output, ['after']);
console.log(
  'Bundled Wasm runtime: guided lessons, partial output, errors, and async execution passed.',
);
