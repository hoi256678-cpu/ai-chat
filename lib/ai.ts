import type { ChatMessage } from "@/lib/gemini";
import { generateReply as generateGeminiReply } from "@/lib/gemini";
import { generateReply as generateOllamaReply } from "@/lib/ollama";

export type { ChatMessage };

// `local-ollama` branch: defaults to the local Ollama model (opposite of
// `master`, which defaults to Gemini). Set AI_PROVIDER=gemini in
// .env.local on this branch to fall back to Gemini if Ollama isn't
// running. Ollama only listens on localhost, so this branch is only
// meant to be run locally, never deployed — a Vercel build of this
// branch would fail every AI call.
export async function generateReply(messages: ChatMessage[], context?: string) {
  if (process.env.AI_PROVIDER === "gemini") {
    return generateGeminiReply(messages, context);
  }
  return generateOllamaReply(messages, context);
}
