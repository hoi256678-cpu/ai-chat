import type { ChatMessage } from "@/lib/gemini";
import {
  generateReply as generateGeminiReply,
  generateReplyWithCrisisJudgment as generateGeminiReplyWithCrisisJudgment,
} from "@/lib/gemini";
import { generateReply as generateOllamaReply } from "@/lib/ollama";
import { extractCrisisTag } from "@/lib/crisisNotice";

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

// 답장 + "실제 위기인가" 판단을 함께 받는다(crisisLevel "normalized"일 때만 쓴다).
// Gemini는 응답 형식으로 판단 칸을 강제한다. 로컬 Ollama는 그 기능이 없어 [위기] 표시로 대신한다.
export async function generateReplyWithCrisisJudgment(
  messages: ChatMessage[],
  context?: string
): Promise<{ reply: string; crisis: boolean }> {
  if (process.env.AI_PROVIDER === "ollama") {
    const { reply, flagged } = extractCrisisTag(await generateOllamaReply(messages, context));
    return { reply, crisis: flagged };
  }
  return generateGeminiReplyWithCrisisJudgment(messages, context);
}
