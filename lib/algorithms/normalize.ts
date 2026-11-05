// [직접 작성] 정규화 함수 (for문, 정규식 두 버전) — 학습 기록: docs/study/algorithm-study-log.md §11
// 완성된 한글(가~힣), 영어, 숫자만 남기고 나머지는 지운다.
// 키워드와 사용자 메시지 둘 다 이 함수를 거친 뒤 아호코라식에 넣는다.


//for문 이용
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

//정규식 이용 << 테스트 시 이쪽이 더 빨랐음 따라서 정규식 사용
export function normalizeRegex(text: string): string {
  return text.replace(/[^a-zA-Z0-9가-힣]/g, "");
}