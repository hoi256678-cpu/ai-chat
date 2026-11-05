import { describe, expect, it } from "vitest";
import { crisisNoticeAfter } from "./crisisNotice";

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
});
