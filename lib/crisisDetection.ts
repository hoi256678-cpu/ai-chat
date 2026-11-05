import { AhoCorasick } from "./algorithms/ahoCorasick";
import { normalizeRegex } from "./algorithms/normalize";

export const CRISIS_KEYWORDS = [
  "자살",
  "죽고싶",
  "죽고 싶",
  "죽어버리고 싶",
  "자해",
  "살기 싫",
  "사라지고 싶",
] as const;

// [직접 작성] 정규화 + 아호코라식으로 위기 감지 교체 (matcher, containsCrisisSignal) — 학습 기록: docs/study/algorithm-study-log.md §11
//위험 단어 추가시 오류 방지를 위한 정규화
const matcher = new AhoCorasick(CRISIS_KEYWORDS.map(normalizeRegex));

export function containsCrisisSignal(text: string): boolean {
  return matcher.countMatches(normalizeRegex(text)) > 0;
}
