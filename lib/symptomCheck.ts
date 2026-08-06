export type SymptomInput = {
  bodyPart: string;
  symptoms: string[];
  duration: string;
  severity: string;
  note: string;
};

export type SymptomResult = {
  conditions: string[];
  departments: string[];
  summary: string;
  disclaimer: string;
  homeCare: string[];
  foods: string[];
  // Only set on the live result screen for a photo-attached 피부 check —
  // not persisted to symptom_checks, so history replays never carry it.
  photoClassification?: string;
};

const FALLBACK_DISCLAIMER =
  "이 결과는 참고용 정보이며 의학적 진단이 아닙니다. 정확한 진단과 치료는 반드시 병원에서 의사와 상담하세요.";

export function buildSymptomPrompt(input: SymptomInput, classificationNote?: string) {
  const classificationSection = classificationNote
    ? `\n[AI 이미지 분류 결과 (참고용)]
- 사용자가 첨부한 피부 사진을 로컬 딥러닝 모델이 분석한 결과: ${classificationNote}
- 이 결과가 사용자가 보고한 증상과 일치하는지 검토하세요. 일치하면 안내에 반영하고, 불일치하는 듯하면 이를 명시적으로 언급하며 병원 방문을 권장하세요.
- 확신도가 낮게 표기되어 있다면(60% 미만) 참고 정보로만 다루고 과신하지 마세요.
- 이 모델은 akiec/bcc/df/vasc 4종 병변만 구분하도록 학습되어 '해당 없음'을 출력할 수 없습니다. 이 4종과 무관한 사진도 반드시 넷 중 하나로 분류되므로, 증상과 어긋나면 분류 결과를 배제하고 판단하세요.\n`
    : "";

  return `당신은 사용자가 병원에 가기 전 참고할 수 있도록 도와주는 의료 정보 안내 도우미입니다.
아래 증상 정보를 바탕으로 가능성 있는 질환 후보와 방문하면 좋을 병원 진료과를 안내해주세요.

[증상 정보]
- 아픈 부위: ${input.bodyPart}
- 증상: ${input.symptoms.join(", ")}
- 지속 기간: ${input.duration}
- 통증/불편함 정도: ${input.severity}
- 추가 설명: ${input.note || "없음"}
${classificationSection}규칙:
- 확정적인 진단 표현("~입니다") 대신 "~일 가능성이 있습니다" 같은 완곡한 표현을 사용하세요.
- 반드시 정확한 진단은 병원에서 받아야 한다는 점을 강조하세요.
- homeCare(응급처치·관리법)와 foods(추천 음식)는 병원 방문 전까지 집에서 시도해볼 수 있는 일반적이고 안전한 수준으로만 안내하고, 약물 복용량이나 구체적인 처치 지시는 하지 마세요. 증상이 심하거나 응급 상황일 수 있다고 판단되면 homeCare 항목에 즉시 병원 방문(또는 119)을 권하는 문구를 포함하세요.
- 아래 JSON 형식으로만 답변하고, 다른 텍스트나 마크다운 코드 블록은 포함하지 마세요.

{
  "conditions": ["가능성 있는 질환 후보 2~3개"],
  "departments": ["추천 진료과 1~2개, 예: 정형외과, 내과, 피부과 등"],
  "summary": "한두 문장으로 된 요약 설명",
  "disclaimer": "정확한 진단은 병원에서 받아야 한다는 안내 문구",
  "homeCare": ["집에서 시도해볼 수 있는 응급처치·관리법 2~4개"],
  "foods": ["증상 완화에 도움될 만한 음식/식이 요령 2~4개"]
}`;
}

export function parseSymptomResult(raw: string): SymptomResult {
  const cleaned = raw
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return {
      conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : raw,
      disclaimer:
        typeof parsed.disclaimer === "string" && parsed.disclaimer
          ? parsed.disclaimer
          : FALLBACK_DISCLAIMER,
      homeCare: Array.isArray(parsed.homeCare) ? parsed.homeCare : [],
      foods: Array.isArray(parsed.foods) ? parsed.foods : [],
    };
  } catch {
    return {
      conditions: [],
      departments: [],
      summary: raw,
      disclaimer: FALLBACK_DISCLAIMER,
      homeCare: [],
      foods: [],
    };
  }
}
