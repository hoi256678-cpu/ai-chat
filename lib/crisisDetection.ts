export const CRISIS_KEYWORDS = [
  "자살",
  "죽고싶",
  "죽고 싶",
  "죽어버리고 싶",
  "자해",
  "살기 싫",
  "사라지고 싶",
] as const;

export function containsCrisisSignal(text: string): boolean {
  return CRISIS_KEYWORDS.some((keyword) => text.includes(keyword));
}

export const CRISIS_SAFETY_MESSAGE =
  "힘든 마음을 나눠주셔서 고마워요. 그런데 지금 느끼시는 마음은 저 혼자보다 전문가와 " +
  "나누시는 게 훨씬 도움이 될 것 같아요. 자살예방상담전화 109(24시간, 무료, 전국 어디서나 " +
  "국번 없이)로 전화하시면 언제든 이야기를 들어주실 거예요. 만약 지금 당장 위험한 " +
  "상황이라면 112나 119로 바로 연락해주세요. 혼자 견디지 않으셨으면 해요.";
