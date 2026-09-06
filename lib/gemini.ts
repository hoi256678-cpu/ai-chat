export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

export async function generateReply(messages: ChatMessage[], context?: string) {
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

  const body: Record<string, unknown> = { contents };
  if (context) {
    body.systemInstruction = { parts: [{ text: context }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

export type ExtractedMedicine = {
  name: string;
  intervalHours: number | null;
};

export async function extractMedicineNames(
  photoDataUrl: string
): Promise<ExtractedMedicine[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("사진 형식을 읽을 수 없어요.");
  }
  const [, mimeType, base64Data] = match;

  const prompt =
    "이 사진은 처방전 또는 진단서예요. 사진에서 보이는 약 이름과 복용법(투여 횟수/간격)을 찾아서 " +
    'JSON 배열로만 응답하세요. 각 항목은 {"name": 약 이름, "intervalHours": 복용 간격(시간 단위 숫자)} ' +
    "형태예요. 복용법이 '1일 3회'처럼 하루 횟수로만 적혀 있으면 24를 그 횟수로 나눠 반올림한 정수를 " +
    "intervalHours로 쓰고, '4시간마다'처럼 간격이 직접 적혀 있으면 그 값을 그대로 쓰세요. 복용법을 알 수 " +
    '없으면 intervalHours를 null로 하세요. 예: [{"name":"타이레놀정500mg","intervalHours":8},' +
    '{"name":"지르텍정","intervalHours":null}]. ' +
    "약 이름을 하나도 찾을 수 없으면 빈 배열 []을 응답하세요. " +
    "다른 설명이나 마크다운 코드펜스 없이 JSON 배열만 응답하세요.";

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Gemini API 오류 (${res.status}):`, errorBody);
    throw new Error("AI가 사진을 분석하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== "string") return [];

  const cleaned = reply
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    const items: ExtractedMedicine[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || typeof item.name !== "string") continue;
      const rawInterval = (item as Record<string, unknown>).intervalHours;
      const intervalHours =
        typeof rawInterval === "number" && rawInterval > 0 && rawInterval <= 24
          ? Math.round(rawInterval)
          : null;
      items.push({ name: item.name, intervalHours });
    }
    return items;
  } catch {
    return [];
  }
}
