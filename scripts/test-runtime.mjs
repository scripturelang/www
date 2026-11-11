// Validate the checked-in runtime without requiring a Rust toolchain or checkout.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, run_script } from '../web/pkg/scripturec.js';
import { lessons } from '../web/lessons.js';

initSync({ module: readFileSync(new URL('../web/pkg/scripturec_bg.wasm', import.meta.url)) });
for (const [name, lesson] of Object.entries(lessons)) {
  const report = JSON.parse(await run_script(lesson.source));
  assert.equal(report.error, null, `${name}: ${report.error}`);
  if (lesson.output) assert.deepEqual(report.output, lesson.output, name);
}
const failure = JSON.parse(await run_script('genesis: praise "before"; confess "oops" amen'));
assert.deepEqual(failure.output, ['before']);
assert.match(failure.error, /uncaught sin: oops/);
const delayed = JSON.parse(await run_script('genesis: pray 0.01; praise "after" amen'));
assert.equal(delayed.error, null);
assert.deepEqual(delayed.output, ['after']);
console.log('Bundled Wasm runtime: guided lessons, partial output, errors, and async execution passed.');
