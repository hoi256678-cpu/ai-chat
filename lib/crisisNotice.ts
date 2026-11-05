import { containsCrisisSignal } from "./crisisDetection";

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

// 위기 키워드가 있어 앱이 안내 띠를 따로 보여 줄 때, 같은 번호를 답변에서 반복하지 않도록 AI에 알리는 문장.
export const CRISIS_NOTICE_CONTEXT =
  "[앱 안내] 사용자의 마지막 메시지에 위기 표현이 있어, 앱이 답변 아래에 자살예방상담전화 109 " +
  "안내를 따로 보여 줍니다. 답변에서는 상담전화 번호를 반복하지 말고, 공감하며 대화를 이어 가세요.";

type Message = { role: "user" | "assistant"; content: string };

// 안내 띠를 "몇 번째 메시지 밑에" 붙일지 계산한다.
// 위기 키워드가 든 사용자 메시지마다: 바로 다음이 AI 답변이면 그 답변 밑,
// 답변 없이 끝났거나(오류) 다음이 또 사용자 메시지면 그 사용자 메시지 밑.
// 답변을 기다리는 중(loading)인 마지막 메시지는 답변이 온 뒤에 붙인다.
export function crisisNoticeAfter(messages: readonly Message[], loading: boolean): Set<number> {
  const result = new Set<number>();

  messages.forEach((message, i) => {
    if (message.role !== "user" || !containsCrisisSignal(message.content)) return;

    const next = messages[i + 1];
    if (next?.role === "assistant") {
      result.add(i + 1);
    } else if (!(next === undefined && loading)) {
      result.add(i);
    }
  });

  return result;
}
