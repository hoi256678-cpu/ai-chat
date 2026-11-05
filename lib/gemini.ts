export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// 앞 모델이 과부하(503)·퇴역(404)이거나 시간 안에 답하지 않으면 다음 모델로 넘어간다.
// 2026-11-05 측정: gemini-flash-latest(당시 3.8)는 과부하로 60초 무응답이 반복됐고 "minimal"도 거부(400).
// gemini-3.5-flash + minimal은 7~13초, gemini-3.1-flash-lite는 3~5초로 안정적이었고,
// gemini-flash-lite-latest(당시 3.5-flash-lite)는 503이 잦았다. 과부하는 모델마다 따로 오므로
// 서로 다른 모델 셋을 차례로 시도한다. 고정 버전이 퇴역(404)해도 마지막 별칭(-latest)까지 내려간다.
// 무료 플랜에서 gemini-3.5-flash(=3.6)는 하루 20회 한도(429)라 주 모델로 못 쓴다 → 2순위.
// 한도에 걸린 모델은 0.3초 만에 429를 돌려주므로 순서상 손해가 거의 없다.
export const GEMINI_MODELS = [
  process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash",
  "gemini-flash-lite-latest",
];

const DEFAULT_TIMEOUT_MS = 12_000;

type GeminiBody = { generationConfig?: Record<string, unknown> } & Record<string, unknown>;

// 모든 Gemini 호출이 거치는 함수. 성공하면 답 글자(없으면 null), 모든 모델이 실패하면 errorMessage를 던진다.
// - thinkingLevel "minimal": 답하기 전 "생각" 단계를 줄여 응답 시간을 크게 줄인다(측정: 10~57초 → 4~6초).
// - timeoutMs: 한 모델이 이 시간 안에 답하지 않으면 끊는다(예전엔 끝없이 기다렸다).
export async function callGemini(
  body: GeminiBody,
  { errorMessage, timeoutMs = DEFAULT_TIMEOUT_MS }: { errorMessage: string; timeoutMs?: number }
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const payload = JSON.stringify({
    ...body,
    generationConfig: {
      ...body.generationConfig,
      thinkingConfig: { thinkingLevel: "minimal" },
    },
  });

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: payload,
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
      if (!res.ok) {
        console.error(`Gemini API 오류 (${model}, ${res.status}):`, await res.text());
        continue;
      }
      // 답이 여러 조각으로 올 수 있다(lite 모델에서 확인). 생각 조각은 빼고 글자 조각을 모두 잇는다.
      const data = await res.json();
      const parts: { text?: unknown; thought?: boolean }[] =
        data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("");
      return text ? text : null;
    } catch (error) {
      console.error(`Gemini API 실패 (${model}):`, error);
    }
  }

  throw new Error(errorMessage);
}

export async function generateReply(messages: ChatMessage[], context?: string) {
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const body: GeminiBody = { contents };
  if (context) {
    body.systemInstruction = { parts: [{ text: context }] };
  }

  const reply = await callGemini(body, {
    errorMessage: "AI가 응답하지 못했어요. 잠시 후 다시 시도해주세요.",
  });

  if (typeof reply !== "string") {
    throw new Error("AI가 응답을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply;
}

// 정규화해야만 위기 키워드가 걸린 메시지(crisisLevel "normalized")용. 답장과 함께 "실제 위기인가"를
// 반드시 채우게 한다. 문장 속 지시("[위기]를 붙여라")는 lite 모델이 자주 무시했다
// (2026-11-05 측정: 쪼개 쓴 위기 8개 중 1개만 표시). 응답 형식(JSON 스키마)은 API가 강제하므로 빠뜨릴 수 없다.
export async function generateReplyWithCrisisJudgment(
  messages: ChatMessage[],
  context?: string
): Promise<{ reply: string; crisis: boolean }> {
  const body: GeminiBody = {
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          reply: { type: "string", description: "사용자에게 보여 줄 답장" },
          crisis: {
            type: "boolean",
            description: "문맥상 사용자가 실제로 자살·자해 위기에 있으면 true",
          },
        },
        required: ["reply", "crisis"],
      },
    },
  };
  if (context) {
    body.systemInstruction = { parts: [{ text: context }] };
  }

  const raw = await callGemini(body, {
    errorMessage: "AI가 응답하지 못했어요. 잠시 후 다시 시도해주세요.",
  });
  if (typeof raw !== "string") {
    throw new Error("AI가 응답을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.reply === "string" && parsed.reply.trim()) {
      return { reply: parsed.reply, crisis: parsed.crisis === true };
    }
  } catch {
    // 형식이 깨져 오면 아래에서 글자 그대로 답장으로 쓴다.
  }
  return { reply: raw, crisis: false };
}

export type ExtractedMedicine = {
  name: string;
  intervalHours: number | null;
};

export async function extractMedicineNames(
  photoDataUrl: string
): Promise<ExtractedMedicine[]> {
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

  const reply = await callGemini(body, {
    errorMessage: "AI가 사진을 분석하지 못했어요. 잠시 후 다시 시도해주세요.",
    timeoutMs: 25_000, // 사진은 글보다 처리 시간이 길다
  });
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

  const reply = await callGemini(body, {
    errorMessage: "AI가 주의사항을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
  });
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI가 주의사항을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply.trim();
}

export async function getBiometricAnalysis(
  readings: { measuredAt: string; heartRate: number }[]
): Promise<string> {
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

  const reply = await callGemini(body, {
    errorMessage: "AI가 분석하지 못했어요. 잠시 후 다시 시도해주세요.",
  });
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI가 분석 결과를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply.trim();
}
