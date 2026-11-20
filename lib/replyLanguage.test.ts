import { describe, expect, it } from "vitest";
import { hasForeignScript, retryIfForeign } from "./replyLanguage";

describe("hasForeignScript: 답장에 섞이면 안 되는 외국 글자", () => {
  it("2026-11-20 배포 환경에서 나온 러시아어 섞인 답장을 잡는다", () => {
    expect(hasForeignScript("정말 속상하고 마음이 тяже 하셨겠어요.")).toBe(true);
  });

  it("중국어 한자와 일본어 가나도 잡는다", () => {
    expect(hasForeignScript("마음이 很 힘드셨겠어요")).toBe(true);
    expect(hasForeignScript("괜찮아요 ですね")).toBe(true);
  });

  it("한국어 답장은 통과시킨다 (숫자, 기호, 이모지 포함)", () => {
    expect(hasForeignScript("많이 힘드셨죠. 24시간 109로 전화해 보세요 🙂")).toBe(false);
  });

  it("영어 단어와 약 이름은 통과시킨다", () => {
    expect(hasForeignScript("AI 분석 결과, 타이레놀(Tylenol)은 식후에 드세요.")).toBe(false);
  });
});

describe("retryIfForeign: 외국 글자가 섞이면 한 번만 다시 받기", () => {
  it("첫 답이 한국어면 다시 부르지 않는다", async () => {
    let calls = 0;
    const result = await retryIfForeign(async () => {
      calls++;
      return "안녕하세요";
    }, (r) => r);
    expect(result).toBe("안녕하세요");
    expect(calls).toBe(1);
  });

  it("첫 답에 외국 글자가 있으면 다시 받아 그 답을 쓴다", async () => {
    const answers = ["마음이 тяже 하셨겠어요", "마음이 무거우셨겠어요"];
    let calls = 0;
    const result = await retryIfForeign(async () => answers[calls++], (r) => r);
    expect(result).toBe("마음이 무거우셨겠어요");
    expect(calls).toBe(2);
  });

  it("다시 받아도 섞여 있으면 더 부르지 않고 두 번째 답을 쓴다 (실패로 만들지 않음)", async () => {
    let calls = 0;
    const result = await retryIfForeign(async () => {
      calls++;
      return `тяже ${calls}`;
    }, (r) => r);
    expect(result).toBe("тяже 2");
    expect(calls).toBe(2);
  });

  it("객체 답(답장 + 위기 판단)은 답장 글자만 검사한다", async () => {
    const answers = [
      { reply: "很 힘드셨죠", crisis: true },
      { reply: "많이 힘드셨죠", crisis: true },
    ];
    let calls = 0;
    const result = await retryIfForeign(async () => answers[calls++], (r) => r.reply);
    expect(result).toEqual({ reply: "많이 힘드셨죠", crisis: true });
  });
});
