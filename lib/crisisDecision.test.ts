import { describe, expect, it } from "vitest";
import { decideCrisis, needsMorphemeCheck, withTimeout } from "./crisisDecision";

const tok = (form: string, tag: string, wordPosition: number) => ({ form, tag, wordPosition });
const 자살골 = [tok("자살", "NNG", 0), tok("골", "NNG", 0), tok("넣", "VV", 1), tok("었", "EP", 1), tok("어", "EF", 1)];

describe("needsMorphemeCheck", () => {
  it("명사 키워드가 원문에 있는 direct만 다시 본다", () => {
    expect(needsMorphemeCheck("자살골 넣었어")).toBe(true);
    expect(needsMorphemeCheck("죽고 싶어")).toBe(false); // 구절 키워드
    expect(needsMorphemeCheck("자 살")).toBe(false); // normalized
    expect(needsMorphemeCheck("안녕")).toBe(false);
  });
});

describe("decideCrisis", () => {
  it("Kiwi 결과가 없으면(실패·시간 초과) 안내한다", () => {
    expect(decideCrisis("자살골 넣었어", null, false)).toBe(true);
  });

  it("합성어면 Gemini 판단을 따른다", () => {
    expect(decideCrisis("자살골 넣었어", 자살골, false)).toBe(false);
    expect(decideCrisis("자살골 넣었어", 자살골, true)).toBe(true);
  });

  it("혼자 쓰인 명사면 Gemini 판단과 상관없이 안내한다", () => {
    const tokens = [tok("자살", "NNG", 0), tok("하", "XSV", 0), tok("고", "EC", 0), tok("싶", "VX", 1), tok("어", "EF", 1)];
    expect(decideCrisis("자살하고 싶어", tokens, false)).toBe(true);
  });
});

describe("withTimeout", () => {
  it("시간 안에 끝나면 값을, 넘으면 null을 돌려준다", async () => {
    expect(await withTimeout(Promise.resolve(1), 50)).toBe(1);
    expect(await withTimeout(new Promise((r) => setTimeout(() => r(1), 100)), 10)).toBeNull();
  });

  it("실패해도 null을 돌려준다", async () => {
    expect(await withTimeout(Promise.reject(new Error("x")), 50)).toBeNull();
  });
});
