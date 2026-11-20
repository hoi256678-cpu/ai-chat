// AI 답장에 다른 언어 글자가 섞이는 것을 막는다.
// 2026-11-20 배포 환경에서 Gemini가 "마음이 тяже 하셨겠어요"처럼 러시아어 조각을 섞어 답한 적이 있다.
// 다국어 모델에서 가끔 생기는 현상이라 지시(KOREAN_ONLY_INSTRUCTION)만으로는 다 막지 못해, 코드로 한 번 더 확인한다.

export const KOREAN_ONLY_INSTRUCTION =
  "답장은 반드시 한국어로만 쓰세요. 러시아어, 중국어, 일본어 등 다른 언어의 단어나 글자를 섞지 마세요. 약 이름 같은 고유명사의 영어 표기는 괜찮습니다.";

// 한국어 답장에 나오면 안 되는 문자 집합: 키릴, 한자(CJK 통합), 일본어 가나, 태국어, 아랍어, 히브리어, 데바나가리.
// 영어(라틴 문자)는 약 이름이나 "AI" 같은 표기에 쓰이므로 허용한다.
const FOREIGN_SCRIPT = /[Ѐ-ӿ一-鿿぀-ヿ฀-๿؀-ۿ֐-׿ऀ-ॿ]/;

export function hasForeignScript(text: string): boolean {
  return FOREIGN_SCRIPT.test(text);
}

// 답에 외국 글자가 섞여 있으면 딱 한 번만 다시 받는다. 다시 받아도 섞여 있으면 그 답을 그대로 쓴다
// (답장을 아예 못 보여 주는 것보다는 낫고, 호출이 끝없이 늘지 않게 한다).
export async function retryIfForeign<T>(
  make: () => Promise<T>,
  textOf: (result: T) => string
): Promise<T> {
  const first = await make();
  if (!hasForeignScript(textOf(first))) return first;
  console.warn("AI 답장에 외국 글자가 섞여 다시 요청합니다:", textOf(first).slice(0, 80));
  return make();
}
