import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callGemini, GEMINI_MODELS } from "./gemini";

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
