import { describe, expect, it } from "vitest";
import { analyzeTokens } from "./kiwi";

// 실제 모델로 Kiwi가 우리가 기대하는 모양으로 쪼개는지 확인한다(판정 규칙의 전제).
// 실험(2026-11-18)에서 본 결과를 고정해 두어, 모델 버전이 바뀌면 바로 알 수 있게 한다.
describe("analyzeTokens (실제 Kiwi 모델)", () => {
  it("합성 명사 자살골을 같은 어절의 자살 + 골로 쪼갠다", async () => {
    const tokens = await analyzeTokens("어제 축구에서 자살골 넣었어");
    const i = tokens.findIndex((t) => t.form === "자살");
    expect(tokens[i]).toMatchObject({ tag: "NNG" });
    expect(tokens[i + 1]).toMatchObject({ form: "골", tag: "NNG", wordPosition: tokens[i].wordPosition });
  }, 30_000);

  it("아자살자는 자살자라는 다른 토큰으로 본다", async () => {
    const forms = (await analyzeTokens("아자살자")).map((t) => t.form);
    expect(forms).toContain("자살자");
    expect(forms).not.toContain("자살");
  }, 30_000);

  it("혼자 쓰인 자살 뒤에는 접미사(하)가 온다", async () => {
    const tokens = await analyzeTokens("나 자살하고 싶어");
    const i = tokens.findIndex((t) => t.form === "자살");
    expect(tokens[i + 1]).toMatchObject({ form: "하", tag: "XSV" });
  }, 30_000);
});
