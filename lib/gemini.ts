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
    "JSON 배열로만 응답하세요. 약 이름 앞에 붙은 조제번호·일련번호 같은 숫자 코드(예: " +
    "'(643503422) 약이름'에서 '(643503422)')는 약 이름이 아니니 제외하고, mg·mL 같은 " +
    "용량·함량 표기는 약 이름의 일부이니 그대로 포함하세요. " +
    'JSON 배열의 각 항목은 {"name": 약 이름, "intervalHours": 복용 간격(시간 단위 숫자)} ' +
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

export async function getMedicationPrecautions(
  name: string,
  photoDataUrl?: string | null
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const prompt =
    `"${name}"이라는 약의 복용 주의사항을 알려주세요. ` +
    "흔한 부작용, 함께 먹으면 안 되는 약/음식(병용금기), 복용 시 지켜야 할 점을 " +
    "짧은 문장이나 불릿 3~5개로 한국어로 정리해주세요. " +
    "이건 의학적 진단이나 처방이 아니라 일반적인 참고 정보이며, " +
    "정확한 복용법은 반드시 의사·약사와 상담해야 한다는 점을 마지막에 한 줄로 덧붙이세요. " +
    "마크다운 코드펜스 없이 텍스트로만 응답하세요.";

  const parts: Record<string, unknown>[] = [{ text: prompt }];

  if (photoDataUrl) {
    const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const [, mimeType, base64Data] = match;
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    }
  }

  const body = {
    contents: [{ role: "user", parts }],
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
    throw new Error("AI가 주의사항을 확인하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI가 주의사항을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply.trim();
}

export async function getBiometricAnalysis(
  readings: { measuredAt: string; heartRate: number }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const readingsText = readings
    .map((r) => `- ${r.measuredAt}: ${r.heartRate} bpm`)
    .join("\n");

  const prompt =
    "다음은 갤럭시 워치로 측정된 사용자의 최근 심박수 기록입니다.\n" +
    `${readingsText}\n\n` +
    "이 기록을 보고 평소와 다른 점이나 주의할 만한 패턴이 있는지 짧은 문장이나 " +
    "불릿 2~4개로 한국어로 정리해주세요. 이건 의학적 진단이 아니라 일반적인 참고 " +
    "정보이며, 심박수가 지속적으로 비정상적이거나 어지러움·가슴 통증 등 다른 증상이 " +
    "함께 있다면 반드시 병원에서 상담해야 한다는 점을 마지막에 한 줄로 덧붙이세요. " +
    "마크다운 코드펜스 없이 텍스트로만 응답하세요.";

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
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
    throw new Error("AI가 분석하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI가 분석 결과를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply.trim();
}
