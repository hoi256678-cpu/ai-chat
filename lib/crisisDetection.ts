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

// [직접 작성] 정규화 + 아호코라식으로 위기 감지 교체 (matcher, containsCrisisSignal, rawMatcher, crisisLevel) — 학습 기록: docs/study/algorithm-study-log.md §11
//위험 단어 추가시 오류 방지를 위한 정규화
const matcher = new AhoCorasick(CRISIS_KEYWORDS.map(normalizeRegex));

export function containsCrisisSignal(text: string): boolean {
  return matcher.countMatches(normalizeRegex(text)) > 0;
}

export type CrisisLevel = "direct" | "normalized" | "none";
const rawMatcher = new AhoCorasick(CRISIS_KEYWORDS);

export function crisisLevel(text: string): CrisisLevel {
  if (rawMatcher.countMatches(text) > 0) return "direct";       // 원문 그대로 찾기
  if (matcher.countMatches(normalizeRegex(text)) > 0) return "normalized";   // 정규화해서 찾기 (지금 matcher 그대로)
  return "none";
}