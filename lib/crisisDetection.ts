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
// 형태소로 direct 다시 보기 (설계: docs/superpowers/specs/2026-11-18-crisis-kiwi-boundary-design.md)
// 명사 키워드만 다시 본다. 구절 키워드("죽고 싶" 등)는 원문 규칙 그대로.
export const NOUN_KEYWORDS = ["자살", "자해"] as const;

// Kiwi 토큰 모양 (lib/kiwi.ts의 MorphToken과 같음). 이 파일은 브라우저에서도 쓰여서 kiwi를 import하지 않는다.
export type Token = { form: string; tag: string; wordPosition: number };

export function refineWithMorphemes(text: string, tokens: readonly Token[]): CrisisLevel {
  // TODO(직접 작성): 설계 문서의 판정 규칙 표대로 채운다.
  const level = crisisLevel(text);

  if(level != "direct")
    return level;

  for(const k of CRISIS_KEYWORDS) {

  }

  for(let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    const next = tokens[i+1];


  }

  return "normalized";
}
