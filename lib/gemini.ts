export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export async function generateReply(messages: ChatMessage[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요."
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
    throw new Error(`Gemini API 오류 (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof reply !== "string") {
    throw new Error("Gemini가 유효한 응답을 반환하지 않았습니다.");
  }

  return reply;
}
