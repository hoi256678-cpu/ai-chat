import type { ChatMessage } from "@/lib/gemini";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

export async function generateReply(messages: ChatMessage[], context?: string) {
  const ollamaMessages = [
    ...(context ? [{ role: "system", content: context }] : []),
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
      }),
    });
  } catch {
    throw new Error(
      "로컬 AI(Ollama)에 연결하지 못했어요. `ollama serve`가 실행 중인지 확인해주세요."
    );
  }

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Ollama API 오류 (${res.status}):`, errorBody);
    throw new Error("로컬 AI가 응답하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.message?.content;

  if (typeof reply !== "string") {
    throw new Error("로컬 AI가 응답을 만들지 못했어요.");
  }

  return reply;
}
