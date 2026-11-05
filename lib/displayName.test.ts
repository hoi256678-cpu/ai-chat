import { describe, expect, it } from "vitest";
import { displayNameOf } from "./displayName";

describe("displayNameOf: 인사말에 쓸 이름", () => {
  it("가입 때 정한 닉네임을 먼저 쓴다", () => {
    expect(displayNameOf({ nickname: "관리자" }, "admin@ash.co.kr")).toBe("관리자");
  });

  it("닉네임이 없으면 이메일 @ 앞부분을 쓴다", () => {
    expect(displayNameOf({}, "hoi256678@gmail.com")).toBe("hoi256678");
    expect(displayNameOf(undefined, "hoi256678@gmail.com")).toBe("hoi256678");
  });

  it("닉네임이 빈 글자거나 공백뿐이면 이메일로 넘어간다", () => {
    expect(displayNameOf({ nickname: "  " }, "a@b.c")).toBe("a");
  });

  it("둘 다 없으면 빈 글자", () => {
    expect(displayNameOf(undefined, undefined)).toBe("");
  });
});
