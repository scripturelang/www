import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { bundleHash, readBundle } from './runtime-bundle.mjs';

const website = fileURLToPath(new URL('../', import.meta.url));
const checkedIn = JSON.parse(
  readFileSync(join(website, 'web/pkg/manifest.json'), 'utf8'),
);
const fixture = mkdtempSync(join(tmpdir(), 'scripture-update-'));
const site = join(fixture, 'website with spaces');
const source = join(fixture, 'scripturec/pkg');
const pkg = join(site, 'web/pkg');
const manifest = join(pkg, 'manifest.json');

function update(...args) {
  return spawnSync(
    process.execPath,
    [join(site, 'scripts/update-runtime.mjs'), ...args],
    {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 40_000,
    },
  );
}
function succeeds(...args) {
  const result = update(...args);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(readFileSync(manifest, 'utf8')).build;
}
function fails(message, ...args) {
  const before = readFileSync(manifest, 'utf8');
  const result = update(...args);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, message);
  assert.equal(
    readFileSync(manifest, 'utf8'),
    before,
    'failed updates must preserve the current build',
  );
  assert.ok(
    !readdirSync(pkg).some((name) => name.startsWith('.update-')),
    'temporary directories must be cleaned up',
  );
}

try {
  mkdirSync(join(site, 'scripts'), { recursive: true });
  mkdirSync(join(site, 'web'), { recursive: true });
  for (const file of [
    'update-runtime.mjs',
    'runtime-bundle.mjs',
    'test-runtime.mjs',
  ]) {
    cpSync(join(website, 'scripts', file), join(site, 'scripts', file));
  }
  cpSync(join(website, 'web/lessons.js'), join(site, 'web/lessons.js'));
  cpSync(join(website, 'web/pkg', checkedIn.build), source, {
    recursive: true,
  });

  const first = succeeds();
  assert.equal(first, checkedIn.build);
  const manifestTime = statSync(manifest).mtimeMs;
  const binaryTime = statSync(join(pkg, first, 'scripturec_bg.wasm')).mtimeMs;
  assert.equal(succeeds(source), first);
  assert.equal(
    statSync(manifest).mtimeMs,
    manifestTime,
    'identical updates must not rewrite the manifest',
  );
  assert.equal(
    statSync(join(pkg, first, 'scripturec_bg.wasm')).mtimeMs,
    binaryTime,
  );

  mkdirSync(join(pkg, '.update-lock'));
  const lockedManifest = readFileSync(manifest, 'utf8');
  const locked = update(source);
  assert.notEqual(locked.status, 0);
  assert.match(locked.stderr, /Another runtime update/);
  assert.equal(readFileSync(manifest, 'utf8'), lockedManifest);
  assert.ok(
    existsSync(join(pkg, '.update-lock')),
    'another updater owns the lock',
  );
  rmSync(join(pkg, '.update-lock'), { recursive: true });

  // A helper-only change must produce a new build, while preserving the old one.
  const helper = readBundle(source).find(
    (file) => file.name.startsWith('snippets/') && file.name.endsWith('.js'),
  );
  assert.ok(helper);
  writeFileSync(
    join(source, helper.name),
    Buffer.concat([helper.bytes, Buffer.from('\n// Updated helper\n')]),
  );
  const second = succeeds(source);
  assert.notEqual(second, first);
  assert.equal(bundleHash(readBundle(join(pkg, first))), first);
  assert.equal(bundleHash(readBundle(join(pkg, second))), second);

  fails(/Run cargo web/, join(fixture, 'missing'));
  const wasm = readFileSync(join(source, 'scripturec_bg.wasm'));
  writeFileSync(join(source, 'scripturec_bg.wasm'), 'broken');
  fails(/invalid WebAssembly/, source);
  writeFileSync(join(source, 'scripturec_bg.wasm'), wasm);
  const loader = readFileSync(join(source, 'scripturec.js'));
  writeFileSync(
    join(source, 'scripturec.js'),
    "throw new Error('broken loader');",
  );
  fails(/Runtime validation failed/, source);
  writeFileSync(join(source, 'scripturec.js'), loader);
  rmSync(join(source, helper.name));
  fails(/Runtime validation failed/, source);
  writeFileSync(
    join(source, helper.name),
    Buffer.concat([helper.bytes, Buffer.from('\n// Updated helper\n')]),
  );
  symlinkSync(join(source, 'scripturec.js'), join(source, 'linked.js'));
  fails(/symlink/, source);
  rmSync(join(source, 'linked.js'));

  writeFileSync(
    join(pkg, second, 'package.json'),
    '{"type":"module","changed":true}',
  );
  fails(/has been modified/, source);
  assert.ok(existsSync(join(pkg, first)), 'old builds must remain available');
  console.log(
    'Runtime updater: hashed copies, idempotence, old-build retention, invalid bundles, and failed-update rollback passed.',
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
