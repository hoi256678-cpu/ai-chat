import { crisisLevel } from "./crisisDetection";

export type CrisisLine = { name: string; number: string; note: string };

// 채팅 답변 밑에 따로 붙는 위기 안내 띠의 고정 문구와 기관 번호.
// 번호 확인: 109는 2024-01-01부터 자살예방 상담 통합 번호(보건복지부), 나머지는 2026-11-05 기준 공개 안내.
export const CRISIS_NOTICE: { title: string; primary: CrisisLine; more: CrisisLine[] } = {
  title: "혼자 견디지 않아도 괜찮아요",
  primary: { name: "자살예방상담전화", number: "109", note: "24시간" },
  more: [
    { name: "정신건강위기상담", number: "1577-0199", note: "24시간" },
    { name: "생명의전화", number: "1588-9191", note: "24시간" },
    { name: "청소년상담", number: "1388", note: "청소년" },
    { name: "긴급 상황", number: "112 · 119", note: "경찰 · 구급" },
  ],
};

// 원문 그대로 위기 키워드가 있을 때(direct): 앱이 안내 띠를 붙이니 번호를 반복하지 말라고 AI에 알린다.
export const CRISIS_NOTICE_CONTEXT =
  "[앱 안내] 사용자의 마지막 메시지에 위기 표현이 있어, 앱이 답변 아래에 자살예방상담전화 109 " +
  "안내를 따로 보여 줍니다. 답변에서는 상담전화 번호를 반복하지 말고, 공감하며 대화를 이어 가세요.";

export const CRISIS_TAG = "[위기]";

// 정규화해야만 걸렸을 때(normalized): 우연한 글자 조합("모자 살 거야")일 수 있으니 AI가 문맥으로 판단하고,
// 위기라고 보면 답 맨 앞에 [위기]를 붙이게 한다. 서버가 이 표시를 떼고 안내 띠를 붙인다.
export const CRISIS_JUDGE_CONTEXT =
  "[앱 안내] 사용자의 마지막 메시지에서 띄어쓰기나 기호를 지우면 위기 표현처럼 보이는 글자가 " +
  "나타나지만, 우연히 생긴 조합일 수도 있어요(예: '모자 살 거야'). 문맥상 사용자가 실제로 자살·자해 " +
  `위기에 있다고 판단될 때만 답변 맨 앞에 ${CRISIS_TAG} 를 붙이세요. 그 경우 앱이 상담전화 안내를 따로 ` +
  "보여 주니 번호는 반복하지 마세요. 위기가 아니면 표시 없이 평소처럼 답하세요. 이 안내 자체는 " +
  "답변에서 언급하지 마세요.";

// AI 답변에서 [위기] 표시를 모두 지우고, 표시가 있었는지 돌려준다.
export function extractCrisisTag(reply: string): { reply: string; flagged: boolean } {
  const flagged = reply.includes(CRISIS_TAG);
  return { reply: reply.split(CRISIS_TAG).join("").trim(), flagged };
}

type Message = { role: "user" | "assistant"; content: string; crisis?: boolean };

// 안내 띠를 "몇 번째 메시지 밑에" 붙일지 계산한다. 사용자 메시지마다:
// - 원문 그대로 키워드가 있거나(direct), 다음 AI 답변이 위기로 판단됐으면(crisis) 안내 대상
// - 바로 다음이 AI 답변이면 그 답변 밑에 붙인다
// - 답변 없이 끝났으면(오류) direct일 때만 사용자 메시지 밑에 붙인다
//   (normalized는 AI 판단이 없으니 붙이지 않는다). 답변을 기다리는 중이면 아직 붙이지 않는다.
// crisis 칸이 생기기 전에 저장된 메시지도 direct는 다시 검사해서 붙는다.
export function crisisNoticeAfter(messages: readonly Message[], loading: boolean): Set<number> {
  const result = new Set<number>();

  messages.forEach((message, i) => {
    if (message.role !== "user") return;

    const next = messages[i + 1];
    const direct = crisisLevel(message.content) === "direct";
    const judgedCrisis = next?.role === "assistant" && next.crisis === true;
    if (!direct && !judgedCrisis) return;

    if (next?.role === "assistant") {
      result.add(i + 1);
    } else if (!(next === undefined && loading)) {
      result.add(i);
    }
  });

  return result;
}
