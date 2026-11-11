import assert from 'node:assert/strict';
import { loadRuntime } from '../web/runtime.js';

let build = 'a'.repeat(64);
const requests = [];
const loaded = [];
let initialized = 0;
const runtime = {
  default: async () => {
    initialized++;
  },
  run_script: () => {},
};
const fetchManifest = async (url, options) => {
  requests.push({ url, options });
  return { ok: true, json: async () => ({ build }) };
};
const importRuntime = async (url) => {
  loaded.push(url);
  return runtime;
};

assert.equal(await loadRuntime(fetchManifest, importRuntime), runtime);
build = 'b'.repeat(64);
assert.equal(await loadRuntime(fetchManifest, importRuntime), runtime);
assert.equal(initialized, 2);
assert.equal(requests.length, 2, 'each run must revalidate the manifest');
for (const { url, options } of requests) {
  assert.ok(url.href.endsWith('/web/pkg/manifest.json'));
  assert.equal(options.cache, 'no-cache');
}
assert.ok(loaded[0].endsWith(`/pkg/${'a'.repeat(64)}/scripturec.js`));
assert.ok(loaded[1].endsWith(`/pkg/${'b'.repeat(64)}/scripturec.js`));

for (const invalid of [
  null,
  {},
  { build: '../escape' },
  { build: 12 },
  { build: 'a'.repeat(63) },
]) {
  await assert.rejects(
    loadRuntime(
      async () => ({ ok: true, json: async () => invalid }),
      importRuntime,
    ),
    /invalid build hash/,
  );
}
assert.equal(loaded.length, 2, 'invalid manifests must never import code');
await assert.rejects(
  loadRuntime(async () => ({ ok: false, status: 404 }), importRuntime),
  /manifest \(HTTP 404\)/,
);
await assert.rejects(
  loadRuntime(async () => {
    throw new Error('offline');
  }, importRuntime),
  /offline/,
);
await assert.rejects(
  loadRuntime(fetchManifest, async () => {
    throw new Error('missing bundle');
  }),
  /missing bundle/,
);
await assert.rejects(
  loadRuntime(fetchManifest, async () => ({
    default: async () => {
      throw new Error('invalid Wasm');
    },
  })),
  /invalid Wasm/,
);
console.log(
  'Runtime loader: per-run build changes, cache revalidation, invalid manifests, and loading errors passed.',
);
