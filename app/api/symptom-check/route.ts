import { generateReply } from "@/lib/ai";
import { generateReply as generateGeminiReply } from "@/lib/gemini";
import { classifySkinPhoto, describeClassification } from "@/lib/skinClassifier";
import {
  buildSymptomPrompt,
  parseSymptomResult,
  type SymptomInput,
} from "@/lib/symptomCheck";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const input: SymptomInput = {
    bodyPart: body?.bodyPart ?? "",
    symptoms: Array.isArray(body?.symptoms) ? body.symptoms : [],
    duration: body?.duration ?? "",
    severity: body?.severity ?? "",
    note: body?.note ?? "",
  };
  const photo: string | undefined =
    typeof body?.photo === "string" && body.photo.length > 0
      ? body.photo
      : undefined;

  if (!input.bodyPart || input.symptoms.length === 0) {
    return Response.json(
      { error: "아픈 부위와 증상을 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const classification = photo ? await classifySkinPhoto(photo) : null;
    const classificationNote = classification
      ? describeClassification(classification)
      : undefined;
    const prompt = buildSymptomPrompt(input, classificationNote);
    // classification 성공 여부로 라우팅 — ml-service가 꺼져있으면 lib/ai.ts의 기본 경로(Gemini)로 폴백
    const raw = classification
      ? await generateGeminiReply([{ role: "user", content: prompt }])
      : await generateReply([{ role: "user", content: prompt }]);
    const result = parseSymptomResult(raw);
    return Response.json({ ...result, photoClassification: classificationNote });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
