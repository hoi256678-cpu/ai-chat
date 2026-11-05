// [직접 작성] 정규화 함수 — 완성된 한글(가~힣), 영어, 숫자만 남기고 나머지는 지운다.
// 키워드와 사용자 메시지 둘 다 이 함수를 거친 뒤 아호코라식에 넣는다.

export function normalize(text: string): string {
  let result = "";

  for (const ch of text) {
    // TODO: true 자리에 "남길 문자인가" 조건을 쓴다
    if (true) {
      result += ch;
    }
  }

  return result;
}
