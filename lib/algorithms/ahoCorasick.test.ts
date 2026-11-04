import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AhoCorasick } from "./ahoCorasick";

describe("AhoCorasick — 기본 동작", () => {
  it("05 예제: he, she, his, hers / ushers → 3", () => {
    const ac = new AhoCorasick(["he", "she", "his", "hers"]);
    expect(ac.countMatches("ushers")).toBe(3);
  });

  it("실패 링크로 점프한 뒤에도 이어서 찾는다: she, he, her / sher → 3", () => {
    const ac = new AhoCorasick(["she", "he", "her"]);
    expect(ac.countMatches("sher")).toBe(3);
  });

  it("사슬 끝까지 누적해서 센다: a, aa, aaa / aaaa → 9", () => {
    const ac = new AhoCorasick(["a", "aa", "aaa"]);
    expect(ac.countMatches("aaaa")).toBe(9);
  });

  it("못 찾으면 0", () => {
    const ac = new AhoCorasick(["abc"]);
    expect(ac.countMatches("abxabyab")).toBe(0);
  });

  it("빈 텍스트, 빈 키워드 목록은 0", () => {
    expect(new AhoCorasick(["a"]).countMatches("")).toBe(0);
    expect(new AhoCorasick([]).countMatches("abc")).toBe(0);
  });

  it("같은 키워드를 두 번 넣어도 한 번만 센다", () => {
    const ac = new AhoCorasick(["he", "he"]);
    expect(ac.countMatches("hehe")).toBe(2);
  });

  it("한 객체로 여러 번 검색해도 이전 검색이 영향을 주지 않는다", () => {
    const ac = new AhoCorasick(["ab"]);
    expect(ac.countMatches("aaa")).toBe(0);
    expect(ac.countMatches("b")).toBe(0);
    expect(ac.countMatches("ab")).toBe(1);
  });
});

describe("AhoCorasick — 한글", () => {
  it("문장 안의 위기 키워드를 찾는다", () => {
    const ac = new AhoCorasick(["자살", "죽고싶", "자해"]);
    expect(ac.countMatches("요즘 계속 죽고싶다는 생각이 들어")).toBe(1);
    expect(ac.countMatches("오늘 점심 뭐 먹지")).toBe(0);
  });

  it("공백이 들어간 키워드도 그대로 찾는다", () => {
    const ac = new AhoCorasick(["살기 싫"]);
    expect(ac.countMatches("그냥 살기 싫어")).toBe(1);
  });

  it("겹치는 한글 키워드: 싶다, 고싶다, 죽고싶다 / 죽고싶다 → 3", () => {
    const ac = new AhoCorasick(["싶다", "고싶다", "죽고싶다"]);
    expect(ac.countMatches("죽고싶다")).toBe(3);
  });
});

// study/05 의 채점용 입력을 그대로 돌려서 C 버전과 답이 같은지 확인한다.
// 12, 13번 큰 입력은 저장소에 없으니 study/05-aho-corasick/tests 에서 gen.py 를 먼저 실행할 것.
describe("AhoCorasick — study/05 채점 데이터와 같은 답", () => {
  const dir = path.resolve(process.cwd(), "study/05-aho-corasick/tests");
  const cases = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".in")).sort()
    : [];

  it.each(cases)("%s", (file) => {
    const [n, ...rest] = readFileSync(path.join(dir, file), "utf8").split(/\s+/).filter(Boolean);
    const keywords = rest.slice(0, Number(n));
    const message = rest[Number(n)];
    const expected = Number(readFileSync(path.join(dir, file.replace(/\.in$/, ".out")), "utf8").trim());

    expect(new AhoCorasick(keywords).countMatches(message)).toBe(expected);
  });
});
