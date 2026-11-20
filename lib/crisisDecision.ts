// 서버의 최종 위기 판정을 정한다. Kiwi(서버 전용)와 사용자가 직접 쓴 refineWithMorphemes를 잇는다.
// Kiwi 관련 실패는 모두 "안내함"으로 끝난다(미탐을 늘리지 않는 것이 우선).
import { crisisLevel, NOUN_KEYWORDS, refineWithMorphemes, type Token } from "./crisisDetection";

// Gemini 답장(보통 2~4초)과 동시에 기다린다. 첫 준비가 Vercel에서 약 5초라 여유를 둔다.
export const KIWI_WAIT_MS = 8000;

export function needsMorphemeCheck(text: string): boolean {
  return crisisLevel(text) === "direct" && NOUN_KEYWORDS.some((k) => text.includes(k));
}

export function decideCrisis(text: string, tokens: readonly Token[] | null, judgedCrisis: boolean): boolean {
  if (tokens === null) return true;
  return refineWithMorphemes(text, tokens) === "direct" ? true : judgedCrisis;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}
