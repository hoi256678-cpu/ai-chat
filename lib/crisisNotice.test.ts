import { describe, expect, it } from "vitest";
import { crisisNoticeAfter, extractCrisisTag } from "./crisisNotice";

const user = (content: string) => ({ role: "user" as const, content });
const ai = (content: string) => ({ role: "assistant" as const, content });

describe("crisisNoticeAfter: 안내 띠를 붙일 메시지 위치", () => {
  it("위기 메시지에 대한 AI 답변 밑에 붙인다", () => {
    const messages = [user("안녕"), ai("안녕하세요"), user("죽고싶다"), ai("많이 힘드셨군요")];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([3]);
  });

  it("일상 대화에는 붙이지 않는다", () => {
    const messages = [user("머리가 아파요"), ai("언제부터 아프셨어요?")];
    expect(crisisNoticeAfter(messages, false).size).toBe(0);
  });

  it("AI 답변을 기다리는 중에는 아직 붙이지 않는다", () => {
    const messages = [user("죽고싶다")];
    expect(crisisNoticeAfter(messages, true).size).toBe(0);
  });

  it("AI 답변이 실패하면(답변 없이 끝나면) 사용자 메시지 밑에 붙인다", () => {
    const messages = [user("죽고싶다")];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([0]);
  });

  it("실패 뒤 사용자가 또 보내도 앞 메시지 밑의 안내는 남는다", () => {
    const messages = [user("죽고싶다"), user("왜 답이 없어"), ai("죄송해요")];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([0]);
  });

  it("위기 메시지가 여러 번이면 각각 붙인다", () => {
    const messages = [user("자해했어"), ai("괜찮으세요?"), user("사라지고 싶어"), ai("곁에 있을게요")];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([1, 3]);
  });

  // 단계별 판정: 정규화해야만 걸린 메시지는 AI가 위기로 판단(crisis: true)했을 때만 붙인다
  it("정규화로만 걸렸고 AI가 위기가 아니라고 보면 붙이지 않는다", () => {
    const messages = [user("내일 모자 살 거야"), ai("어떤 모자요?")];
    expect(crisisNoticeAfter(messages, false).size).toBe(0);
  });

  it("정규화로만 걸렸어도 AI가 위기라고 판단하면(crisis) 답변 밑에 붙인다", () => {
    const messages = [user("다 끝내고 자 살 거야"), { ...ai("많이 지치셨군요"), crisis: true }];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([1]);
  });

  it("정규화로만 걸린 메시지의 답변이 실패하면 판단을 못 했으니 붙이지 않는다", () => {
    const messages = [user("내일 모자 살 거야")];
    expect(crisisNoticeAfter(messages, false).size).toBe(0);
  });
});

describe("extractCrisisTag: AI 답변의 [위기] 표시 떼기", () => {
  it("맨 앞의 [위기]를 떼고 위기로 표시한다", () => {
    expect(extractCrisisTag("[위기] 많이 지치셨군요.")).toEqual({
      reply: "많이 지치셨군요.",
      flagged: true,
    });
  });

  it("표시가 없으면 그대로 두고 위기가 아니다", () => {
    expect(extractCrisisTag("어떤 모자요?")).toEqual({ reply: "어떤 모자요?", flagged: false });
  });

  it("앞뒤 공백·줄바꿈이나 중간에 끼어든 표시도 지운다", () => {
    expect(extractCrisisTag("\n [위기]\n\n힘드셨죠. [위기]")).toEqual({
      reply: "힘드셨죠.",
      flagged: true,
    });
  });
});
