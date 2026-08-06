import type { ChatMessage } from "@/lib/gemini";
import { generateReply as generateGeminiReply } from "@/lib/gemini";
import { generateReply as generateOllamaReply } from "@/lib/ollama";

export type { ChatMessage };

// Single entry point both API routes call. Defaults to Gemini (works in
// prod/Vercel with no config); set AI_PROVIDER=ollama in .env.local to
// route to a self-hosted open-source model instead. Ollama only listens
// on localhost, so this switch is dev/test-only — Vercel can't reach it.
export async function generateReply(messages: ChatMessage[], context?: string) {
  if (process.env.AI_PROVIDER === "ollama") {
    return generateOllamaReply(messages, context);
  }
  return generateGeminiReply(messages, context);
}
