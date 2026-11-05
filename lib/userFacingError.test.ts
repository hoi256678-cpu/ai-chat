import { describe, expect, it } from "vitest";
import { messageForUser, UserFacingError } from "./userFacingError";

describe("messageForUser: 화면에 보여 줄 오류 문구", () => {
  it("우리 API가 준 문구(UserFacingError)는 그대로 보여 준다", () => {
    expect(messageForUser(new UserFacingError("AI가 응답하지 못했어요."), "기본")).toBe(
      "AI가 응답하지 못했어요."
    );
  });

  it("예상 못 한 오류의 내부 문구는 숨기고 기본 문구를 보여 준다", () => {
    expect(messageForUser(new TypeError("Failed to fetch"), "기본")).toBe("기본");
    expect(
      messageForUser(new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`), "기본")
    ).toBe("기본");
    expect(messageForUser({ message: 'column "crisis" does not exist' }, "기본")).toBe("기본");
  });
});
