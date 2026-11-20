import { describe, expect, it } from "vitest";
import { crisisLevel, refineWithMorphemes, type CrisisLevel } from "./crisisDetection";
import { analyzeTokens } from "./kiwi";
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
    const kinds: EvalKind[] = ["explicit", "obfuscated", "indirect", "negation", "daily", "trap", "compound"];
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

// 형태소 재검사 후 측정 (실제 Kiwi 모델). direct였던 문장만 refineWithMorphemes로 다시 본다(서버와 같은 순서).
describe("형태소 재검사 후 측정 (실제 Kiwi)", () => {
  it("결과 표와 보장 검사", async () => {
    const refined = [];
    for (const s of CRISIS_EVAL_SET) {
      const before = crisisLevel(s.text);
      const after = before === "direct" ? refineWithMorphemes(s.text, await analyzeTokens(s.text)) : before;
      refined.push({ ...s, before, after });
    }
    console.table(
      refined
        .filter((r) => r.before !== r.after)
        .map((r) => ({ 문장: r.text, 종류: r.kind, 정답위기: r.crisis, 전: r.before, 후: r.after }))
    );
    // 그대로 쓴 위기 표현은 하나도 낮아지지 않는다(미탐 0 유지)
    expect(refined.filter((r) => r.kind === "explicit" && r.after !== "direct").map((r) => r.text)).toEqual([]);
    // 합성어 일상 문장은 direct가 아니게 된다
    expect(refined.filter((r) => r.kind === "compound" && !r.crisis && r.after === "direct").map((r) => r.text)).toEqual([]);
  }, 60_000);
});
