export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export async function generateReply(messages: ChatMessage[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Gemini API 오류 (${res.status}):`, errorBody);
    throw new Error("AI가 응답하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof reply !== "string") {
    throw new Error("AI가 응답을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply;
}
