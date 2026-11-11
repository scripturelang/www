import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { bundleHash, readBundle, validateBundle } from './runtime-bundle.mjs';

const website = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(process.argv[2] || join(website, '../scripturec/pkg'));
const destination = join(website, 'web/pkg');
let staging;
let locked = false;
const lock = join(destination, '.update-lock');

try {
  if (process.argv.length > 3)
    throw new Error('Usage: node scripts/update-runtime.mjs [source-pkg]');
  if (source === destination)
    throw new Error(
      'The source must be a compiler bundle, not web/pkg itself.',
    );
  if (!existsSync(source))
    throw new Error(
      `No runtime bundle at ${source}. Run cargo web in scripturec first.`,
    );
  const files = readBundle(source);
  validateBundle(files);
  const build = bundleHash(files);
  mkdirSync(destination, { recursive: true });
  try {
    mkdirSync(lock);
    locked = true;
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(
        'Another runtime update is in progress (.update-lock exists).',
      );
    }
    throw error;
  }
  staging = mkdtempSync(join(destination, '.update-'));
  for (const { name, bytes } of files) {
    const path = join(staging, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, { flag: 'wx' });
  }

  // Test the exact copy, including the loader's relative helper imports, before
  // publishing either its immutable directory or the current-build pointer.
  const checks = spawnSync(
    process.execPath,
    [join(website, 'scripts/test-runtime.mjs'), staging],
    {
      encoding: 'utf8',
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (checks.status !== 0) {
    throw new Error(
      `Runtime validation failed; the current build is unchanged.\n${checks.error?.message || checks.stderr || checks.stdout}`,
    );
  }
  process.stdout.write(checks.stdout);

  const target = join(destination, build);
  if (existsSync(target)) {
    if (bundleHash(readBundle(target)) !== build) {
      throw new Error(
        `Existing bundle ${build} has been modified; refusing to overwrite it.`,
      );
    }
  } else {
    renameSync(staging, target);
    staging = undefined;
  }
  const manifest = join(destination, 'manifest.json');
  const contents = JSON.stringify({ build }, null, 2) + '\n';
  if (existsSync(manifest) && readFileSync(manifest, 'utf8') === contents) {
    console.log(`Runtime already current: ${build}`);
  } else {
    const manifestTemp = join(lock, 'manifest.json');
    writeFileSync(manifestTemp, contents, { flag: 'wx' });
    renameSync(manifestTemp, manifest);
    console.log(`Runtime updated: ${build}`);
  }
  console.log('Review and commit web/pkg/. Publishing is a separate step.');
} catch (error) {
  console.error(`make update: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (staging) rmSync(staging, { recursive: true, force: true });
  if (locked) rmSync(lock, { recursive: true, force: true });
}
