import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";

// 규칙: 완성된 한글(가~힣), 영어, 숫자만 남기고 나머지는 전부 지운다.
describe("normalize", () => {
  it("공백을 지운다", () => {
    expect(normalize("자 살")).toBe("자살");
  });

  it("특수문자를 지운다", () => {
    expect(normalize("죽.고.싶.다")).toBe("죽고싶다");
    expect(normalize("자@해!")).toBe("자해");
  });

  it("자음·모음만 있는 글자를 지운다", () => {
    expect(normalize("자ㅋㅋ해")).toBe("자해");
    expect(normalize("살기 싫어ㅠㅠ")).toBe("살기싫어");
    expect(normalize("ㅋㅋㅋ")).toBe("");
  });

  it("이모지를 지운다", () => {
    expect(normalize("힘들어😢")).toBe("힘들어");
  });

  it("영어와 숫자는 남긴다", () => {
    expect(normalize("자a살")).toBe("자a살");
    expect(normalize("3일째 잠을 못 자")).toBe("3일째잠을못자");
  });

  it("빈 문자열은 빈 문자열", () => {
    expect(normalize("")).toBe("");
  });
});
