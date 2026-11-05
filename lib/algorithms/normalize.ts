// [직접 작성] 정규화 함수 (for문, 정규식 두 버전) — 학습 기록: docs/study/algorithm-study-log.md §11
// 규칙: 완성된 한글(가~힣), 영어, 숫자만 남기고 나머지는 지운다.
// 키워드와 사용자 메시지 둘 다 이 함수를 거친 뒤 아호코라식에 넣는다.

export function normalize(text: string): string {
  let result = "";

  for (const ch of text) {
    if ((ch >= "가" && ch <= "힣") || (ch >= "A" && ch <= "Z") ||
    (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") ) {
      result += ch;
    }
  }

  return result;
}

export function normalizeRegex(text: string): string {
  return text.replace(/[^a-zA-Z0-9가-힣]/g, "");
}