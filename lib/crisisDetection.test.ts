import { describe, expect, it } from "vitest";
import { containsCrisisSignal, CRISIS_KEYWORDS } from "./crisisDetection";

// 회귀 테스트: containsCrisisSignal() 안쪽을 아호코라식 + 정규화로 바꾼 뒤에도
// 지금(includes 방식)이 잡던 것은 계속 잡고, 안 잡던 일상 문장은 계속 안 잡아야 한다.
describe("containsCrisisSignal 회귀 테스트", () => {
  it.each(CRISIS_KEYWORDS)("키워드 자체를 잡는다: %s", (keyword) => {
    expect(containsCrisisSignal(keyword)).toBe(true);
  });

  it.each([
    "요즘 너무 힘들어서 자살 생각이 나요",
    "그냥 죽고싶다",
    "진짜 죽고 싶어",
    "다 그만두고 죽어버리고 싶어요",
    "어제 또 자해했어",
    "요즘 살기 싫다는 생각만 들어",
    "그냥 사라지고 싶어",
  ])("문장 속 키워드를 잡는다: %s", (message) => {
    expect(containsCrisisSignal(message)).toBe(true);
  });

  it.each([
    "오늘 점심 뭐 먹지",
    "머리가 아프고 열이 나요",
    "잠을 잘 못 자서 피곤해요",
    "",
  ])("일상 문장은 잡지 않는다: %s", (message) => {
    expect(containsCrisisSignal(message)).toBe(false);
  });
});
