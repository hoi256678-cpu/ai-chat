import { describe, expect, it } from "vitest";
import { refineWithMorphemes, type Token } from "./crisisDetection";

// 토큰은 2026-11-18 실험에서 실제 Kiwi가 낸 출력이다(형태/품사/어절 번호).
const t = (form: string, tag: string, wordPosition: number): Token => ({ form, tag, wordPosition });

describe("refineWithMorphemes: 형태소로 direct 다시 보기", () => {
  it("혼자 쓰인 명사(자살+하다)는 direct 유지", () => {
    const tokens = [t("나", "NP", 0), t("자살", "NNG", 1), t("하", "XSV", 1), t("고", "EC", 1), t("싶", "VX", 2), t("어", "EC", 2)];
    expect(refineWithMorphemes("나 자살하고 싶어", tokens)).toBe("direct");
  });

  it("자해도 같은 규칙: 자해했어는 direct", () => {
    const tokens = [t("자해", "NNG", 0), t("하", "XSV", 0), t("었", "EP", 0), t("어", "EF", 0)];
    expect(refineWithMorphemes("자해했어", tokens)).toBe("direct");
  });

  it("어절 끝에 혼자 쓰인 명사(자살 생각)는 direct 유지", () => {
    const tokens = [t("자살", "NNG", 0), t("생각", "NNG", 1), t("이", "JKS", 1), t("나", "VV", 2), t("요", "EF", 2)];
    expect(refineWithMorphemes("자살 생각이 나요", tokens)).toBe("direct");
  });

  it("합성어(자살골)는 normalized로 낮춘다", () => {
    const tokens = [t("어제", "MAG", 0), t("축구", "NNG", 1), t("에서", "JKB", 1), t("자살", "NNG", 2), t("골", "NNG", 2), t("넣", "VV", 3), t("었", "EP", 3), t("어", "EF", 3)];
    expect(refineWithMorphemes("어제 축구에서 자살골 넣었어", tokens)).toBe("normalized");
  });

  it("합성어(자살충동)도 normalized (Gemini가 판단)", () => {
    const tokens = [t("자살", "NNG", 0), t("충동", "NNG", 0), t("이", "JKS", 0), t("들", "VV", 1), t("어", "EC", 1)];
    expect(refineWithMorphemes("자살충동이 들어", tokens)).toBe("normalized");
  });

  it("같은 형태의 토큰이 없으면(아자살자 → 자살자) normalized", () => {
    const tokens = [t("아", "IC", 0), t("자살자", "NNG", 0)];
    expect(refineWithMorphemes("아자살자", tokens)).toBe("normalized");
  });

  it("합성어와 혼자 쓰인 명사가 함께 있으면 direct", () => {
    const tokens = [t("자살", "NNG", 0), t("골", "NNG", 0), t("넣고", "VV", 1), t("자살", "NNG", 2), t("하", "XSV", 2), t("고", "EC", 2), t("싶", "VX", 3), t("다", "EF", 3)];
    expect(refineWithMorphemes("자살골 넣고 자살하고 싶다", tokens)).toBe("direct");
  });

  it("합성어가 있어도 구절 키워드(죽고 싶)가 원문에 있으면 direct", () => {
    const tokens = [t("자살", "NNG", 0), t("골", "NNG", 0), t("때문", "NNB", 1), t("에", "JKB", 1), t("죽", "VV", 2), t("고", "EC", 2), t("싶", "VX", 3), t("다", "EF", 3)];
    expect(refineWithMorphemes("자살골 때문에 죽고 싶다", tokens)).toBe("direct");
  });

  it("원래 direct가 아니면 그대로 돌려준다", () => {
    expect(refineWithMorphemes("내일 모자 살 거야", [])).toBe("normalized");
    expect(refineWithMorphemes("오늘 점심 뭐 먹지", [])).toBe("none");
  });
});
