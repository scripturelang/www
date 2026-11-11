import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Hash names and bytes, never timestamps or directory enumeration order.
export function readBundle(directory) {
  const files = [];
  function visit(relative) {
    const path = join(directory, relative);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink())
      throw new Error(`Bundle contains a symlink: ${path}`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) {
        visit(relative ? `${relative}/${name}` : name);
      }
    } else if (stat.isFile()) {
      files.push({ name: relative, bytes: readFileSync(path) });
    } else {
      throw new Error(`Unsupported bundle entry: ${path}`);
    }
  }
  visit('');
  return files;
}

export function bundleHash(files) {
  const hash = createHash('sha256');
  for (const { name, bytes } of files) {
    hash.update(JSON.stringify([name, bytes.length]) + '\n');
    hash.update(bytes);
  }
  return hash.digest('hex');
}

export function validateBundle(files) {
  const byName = new Map(files.map(({ name, bytes }) => [name, bytes]));
  for (const name of [
    'package.json',
    'scripturec.js',
    'scripturec_bg.wasm',
    'scripturec.d.ts',
    'scripturec_bg.wasm.d.ts',
  ]) {
    if (!byName.get(name)?.length)
      throw new Error(`Missing bundle file: ${name}`);
  }
  if (JSON.parse(byName.get('package.json').toString()).type !== 'module') {
    throw new Error('The runtime package.json must specify type: module.');
  }
  if (!WebAssembly.validate(byName.get('scripturec_bg.wasm'))) {
    throw new Error('The runtime contains an invalid WebAssembly binary.');
  }
}
