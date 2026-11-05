import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callGemini, GEMINI_MODELS, generateReplyWithCrisisJudgment } from "./gemini";

const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
  });
const status = (code: number) => new Response("{}", { status: code });

// fetch가 abort 신호를 받을 때까지 끝나지 않는 "멈춘 요청"
const hang = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("timeout", "TimeoutError"))
    );
  });

const body = { contents: [{ role: "user", parts: [{ text: "안녕" }] }] };

describe("callGemini", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("첫 모델이 답하면 그 답을 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(ok("안녕하세요"));
    await expect(callGemini(body, { errorMessage: "실패" })).resolves.toBe("안녕하세요");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(GEMINI_MODELS[0]);
  });

  it("생각(thinking)을 최소로 줄이는 설정을 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(ok("답"));
    await callGemini(body, { errorMessage: "실패" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(sent.contents).toEqual(body.contents);
  });

  it("API 키는 주소가 아니라 헤더로 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(ok("답"));
    await callGemini(body, { errorMessage: "실패" });
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("test-key");
    expect(fetchMock.mock.calls[0][1].headers["x-goog-api-key"]).toBe("test-key");
  });

  it("과부하(503)면 다음 모델로 넘어간다", async () => {
    fetchMock.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok("대체 모델 답"));
    await expect(callGemini(body, { errorMessage: "실패" })).resolves.toBe("대체 모델 답");
    expect(String(fetchMock.mock.calls[1][0])).toContain(GEMINI_MODELS[1]);
  });

  it("응답이 시간 안에 안 오면 끊고 다음 모델로 넘어간다", async () => {
    fetchMock.mockImplementationOnce(hang).mockResolvedValueOnce(ok("대체 모델 답"));
    await expect(
      callGemini(body, { errorMessage: "실패", timeoutMs: 50 })
    ).resolves.toBe("대체 모델 답");
  });

  it("모든 모델이 실패하면 정해진 오류 문구를 던진다", async () => {
    fetchMock.mockResolvedValue(status(503));
    await expect(callGemini(body, { errorMessage: "AI가 응답하지 못했어요." })).rejects.toThrow(
      "AI가 응답하지 못했어요."
    );
    expect(fetchMock).toHaveBeenCalledTimes(GEMINI_MODELS.length);
  });

  it("답이 여러 조각(parts)으로 오면 생각 조각은 빼고 모두 이어 붙인다", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: "속으로 생각한 내용", thought: true },
                  { text: "요즘 잠을 " },
                  { text: "못 주무시는군요." },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    await expect(callGemini(body, { errorMessage: "실패" })).resolves.toBe(
      "요즘 잠을 못 주무시는군요."
    );
  });

  it("답에 글자가 없으면 null을 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    await expect(callGemini(body, { errorMessage: "실패" })).resolves.toBeNull();
  });
});

describe("generateReplyWithCrisisJudgment: 위기 판단 칸을 강제로 채우게 하기", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const msgs = [{ role: "user" as const, content: "죽.고.싶.다" }];

  it("JSON 형식(reply, crisis)을 강제하는 설정을 보낸다", async () => {
    fetchMock.mockResolvedValueOnce(ok('{"reply":"많이 힘드셨군요","crisis":true}'));
    await generateReplyWithCrisisJudgment(msgs, "상담사");
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.generationConfig.responseMimeType).toBe("application/json");
    expect(sent.generationConfig.responseJsonSchema.required).toEqual(["reply", "crisis"]);
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });

  it("답장과 위기 판단을 나눠 돌려준다", async () => {
    fetchMock.mockResolvedValueOnce(ok('{"reply":"많이 힘드셨군요","crisis":true}'));
    await expect(generateReplyWithCrisisJudgment(msgs)).resolves.toEqual({
      reply: "많이 힘드셨군요",
      crisis: true,
    });
  });

  it("위기가 아니면 crisis false", async () => {
    fetchMock.mockResolvedValueOnce(ok('{"reply":"어떤 모자요?","crisis":false}'));
    await expect(generateReplyWithCrisisJudgment(msgs)).resolves.toEqual({
      reply: "어떤 모자요?",
      crisis: false,
    });
  });

  it("JSON이 깨져 오면 글자를 그대로 답장으로 쓰고 위기 아님으로 둔다", async () => {
    fetchMock.mockResolvedValueOnce(ok("그냥 글자로 답함"));
    await expect(generateReplyWithCrisisJudgment(msgs)).resolves.toEqual({
      reply: "그냥 글자로 답함",
      crisis: false,
    });
  });
});
