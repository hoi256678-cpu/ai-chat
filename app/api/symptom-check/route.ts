import { generateReply } from "@/lib/gemini";
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

  if (!input.bodyPart || input.symptoms.length === 0) {
    return Response.json(
      { error: "아픈 부위와 증상을 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const prompt = buildSymptomPrompt(input);
    const raw = await generateReply([{ role: "user", content: prompt }]);
    const result = parseSymptomResult(raw);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
