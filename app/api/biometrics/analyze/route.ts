import { getBiometricAnalysis } from "@/lib/gemini";

type ReadingInput = { measuredAt: string; heartRate: number };

function isReadingInput(value: unknown): value is ReadingInput {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ReadingInput).measuredAt === "string" &&
    typeof (value as ReadingInput).heartRate === "number"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const readings: ReadingInput[] = Array.isArray(body?.readings)
    ? body.readings.filter(isReadingInput)
    : [];

  if (readings.length === 0) {
    return Response.json({ error: "분석할 측정값이 없어요." }, { status: 400 });
  }

  try {
    const analysis = await getBiometricAnalysis(readings);
    return Response.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
