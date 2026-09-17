/**
 * LocalProvider — WebGPU/WASM-backed AI (stub for v1).
 *
 * v1 ships a stub that declares the 'rewrite' capability but yields no
 * tokens. This lets the UI render the "Local" option in settings without
 * a working backend; the diff renderer shows "Local AI not available yet".
 *
 * When a real WebGPU/WASM runtime lands, replace the generator body with
 * the streaming inference call.
 */
import type { AICapability, AIProvider, StreamParams } from './provider';

/**
 * Create a local (WebGPU/WASM) provider stub.
 *
 * The stub declares `rewrite` capability so the settings panel and
 * capability gating work end-to-end, but `stream()` yields nothing —
 * there is no local model to run yet.
 */
export function createLocalProvider(): AIProvider {
  return {
    name: 'Local (WebGPU)',
    capabilities: ['rewrite'] as const satisfies readonly AICapability[],
    async *stream(_params: StreamParams): AsyncIterable<string> {
      // Stub: no local model in v1. Yield nothing so the diff renderer
      // gets an empty proposal (which it treats as "no change").
      return;
      // Unreachable — keeps the generator typed as AsyncIterable<string>.
      yield* [] as const;
    },
  };
}
