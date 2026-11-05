import { describe, expect, it } from "vitest";
import { crisisLevel, type CrisisLevel } from "./crisisDetection";
import { CRISIS_EVAL_SET, type EvalKind } from "./crisisEval.data";

// 1차(아호코라식) 오탐·미탐 측정. 종류별로 direct / normalized / none 개수를 세서 표로 출력하고,
// 꼭 지켜야 할 것만 검사한다. 숫자는 학습 기록 §11 "오탐·미탐 측정"에 옮겨 둔다.
const results = CRISIS_EVAL_SET.map((s) => ({ ...s, level: crisisLevel(s.text) }));

function countBy(kind: EvalKind) {
  const rows = results.filter((r) => r.kind === kind);
  const c: Record<CrisisLevel, number> = { direct: 0, normalized: 0, none: 0 };
  rows.forEach((r) => c[r.level]++);
  return { 종류: kind, 문장수: rows.length, ...c };
}

describe("1차 판정 오탐·미탐 측정", () => {
  it("종류별 결과 표", () => {
    const kinds: EvalKind[] = ["explicit", "obfuscated", "indirect", "negation", "daily", "trap"];
    console.table(kinds.map(countBy));
    console.table(
      results
        .filter((r) => r.kind === "trap" || r.kind === "negation" || r.kind === "indirect")
        .map((r) => ({ 문장: r.text, 정답위기: r.crisis, 판정: r.level }))
    );
  });

  it("그대로 쓴 위기 표현은 하나도 놓치지 않는다(전부 direct)", () => {
    const missed = results.filter((r) => r.kind === "explicit" && r.level !== "direct");
    expect(missed.map((r) => r.text)).toEqual([]);
  });

  it("쪼개 쓴 위기 표현은 정규화로 잡는다(none이 없음)", () => {
    const missed = results.filter((r) => r.kind === "obfuscated" && r.level === "none");
    expect(missed.map((r) => r.text)).toEqual([]);
  });

  it("평범한 일상 문장은 아무것도 걸리지 않는다", () => {
    const flagged = results.filter((r) => r.kind === "daily" && r.level !== "none");
    expect(flagged.map((r) => r.text)).toEqual([]);
  });
});
