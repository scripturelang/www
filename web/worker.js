import { loadRuntime } from './runtime.js';

self.onmessage = async ({ data }) => {
  try {
    const { run_script } = await loadRuntime();
    self.postMessage(JSON.parse(await run_script(data.source)));
  } catch (error) {
    self.postMessage({ output: [], error: String(error?.message || error) });
  }
};
