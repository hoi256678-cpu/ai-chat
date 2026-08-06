const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export type SkinClassification = {
  class: string;
  confidence: number;
};

// ml-service/organize_ham10000.py의 TARGET_CLASSES(HAM10000 dx 코드)와 1:1 대응.
// classes.json 순서가 바뀌면(재학습 시 클래스 조합을 바꾸면) 이 맵도 함께 갱신할 것.
const CLASS_LABELS: Record<string, string> = {
  akiec: "광선각화증/보웬병(전암성 병변) 의심 소견",
  bcc: "기저세포암 의심 소견",
  df: "피부섬유종(양성 종양) 의심 소견",
  vasc: "혈관종/혈관 관련 병변 의심 소견",
};

export async function classifySkinPhoto(
  photoDataUrl: string
): Promise<SkinClassification | null> {
  const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64Data] = match;

  try {
    const bytes = Buffer.from(base64Data, "base64");
    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: mimeType }), "photo.jpg");

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (typeof data.class !== "string" || typeof data.confidence !== "number") {
      return null;
    }
    return { class: data.class, confidence: data.confidence };
  } catch {
    // ml-service가 꺼져있거나(연결 거부), 8초 내 응답이 없는 경우(AbortSignal.timeout) —
    // 두 경우 모두 분류 없이 텍스트 전용 플로우로 폴백시키는 게 목적이므로 에러를 삼킨다.
    return null;
  }
}

export function describeClassification(classification: SkinClassification): string {
  const label = CLASS_LABELS[classification.class] ?? classification.class;
  const percent = Math.round(classification.confidence * 100);
  return `${label} (모델 확신도 ${percent}%)`;
}
