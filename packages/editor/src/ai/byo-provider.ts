/**
 * BYOKeyProvider — user-supplied API key, stored in memory only.
 *
 * The key is never written to localStorage, sessionStorage, or disk. It
 * lives only in the caller's memory and is passed into the constructor.
 * On page reload the key is gone and the user must re-enter it.
 *
 * The provider streams from a compatible OpenAI-style `/v1/chat/completions`
 * endpoint. Override via the `endpoint` parameter for non-OpenAI backends.
 */
import type { AICapability, AIProvider, StreamParams } from './provider';

/** Default endpoint — OpenAI-compatible chat completions. */
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * Create a BYO (bring-your-own) API key provider.
 *
 * @param apiKey - User's API key. Stored in memory only.
 * @param endpoint - Optional custom endpoint URL.
 */
export function createBYOKeyProvider(
  apiKey: string,
  endpoint: string = DEFAULT_ENDPOINT,
): AIProvider {
  return {
    name: 'BYO Key',
    capabilities: [
      'rewrite',
      'shorten',
      'translate',
      'structure',
      'explain',
    ] as const satisfies readonly AICapability[],
    async *stream(params: StreamParams): AsyncIterable<string> {
      const system = params.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
      const userMessage = buildUserMessage(params.prompt, params.context);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMessage },
          ],
        }),
        signal: params.signal,
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('AI response has no body');
      }

      yield* streamSse(response.body);
    },
  };
}

/** System prompt for rewrite requests. */
const DEFAULT_SYSTEM_PROMPT =
  'You are a writing assistant. Given the user\'s instruction and the selected text, ' +
  'produce ONLY the rewritten text. Do not include explanations, markdown fences, ' +
  'or any text other than the rewrite itself.';

/**
 * Build the user message combining the instruction and the selected context.
 */
function buildUserMessage(prompt: string, context: string): string {
  return `Instruction: ${prompt}\n\nSelected text:\n${context}`;
}

/**
 * Parse an SSE stream and yield text deltas from OpenAI-style chunk format.
 *
 * Handles the `data: {...}` line format and `[DONE]` terminator. Skips
 * keep-alive blank lines.
 */
async function* streamSse(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Malformed chunk — skip. Robustness over strictness for streaming.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
