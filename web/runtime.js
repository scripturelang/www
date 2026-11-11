// Resolve the build for each run. All imports inside its directory use the same
// immutable bundle, even if a deployment changes the manifest during execution.
export async function loadRuntime(
  fetchResource = fetch,
  importModule = (url) => import(url),
) {
  const response = await fetchResource(
    new URL('./pkg/manifest.json', import.meta.url),
    {
      cache: 'no-cache',
    },
  );
  if (!response.ok) {
    throw new Error(
      `Could not load the interpreter manifest (HTTP ${response.status}).`,
    );
  }
  const manifest = await response.json();
  if (
    !manifest ||
    typeof manifest.build !== 'string' ||
    !/^[a-f0-9]{64}$/.test(manifest.build)
  ) {
    throw new Error('The interpreter manifest contains an invalid build hash.');
  }
  const runtime = await importModule(
    new URL(`./pkg/${manifest.build}/scripturec.js`, import.meta.url).href,
  );
  await runtime.default();
  return runtime;
}
