import { generateReply, generateReplyWithCrisisJudgment, type ChatMessage } from "@/lib/ai";
import { crisisLevel } from "@/lib/crisisDetection";
import { decideCrisis, KIWI_WAIT_MS, needsMorphemeCheck, withTimeout } from "@/lib/crisisDecision";
import { analyzeTokens, getKiwi } from "@/lib/kiwi";
import {
  CRISIS_JUDGE_CONTEXT,
  CRISIS_NOTICE_CONTEXT,
  extractCrisisTag,
} from "@/lib/crisisNotice";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];
  const context: string | undefined = body?.context;

  if (messages.length === 0) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  // 단계별 판정. AI는 어느 경우든 평소처럼 답하고, 안내 띠는 화면(ChatMessages)이 따로 붙인다.
  // - direct: 원문에 위기 키워드가 그대로 있음 → 무조건 안내. AI에는 번호를 반복하지 말라고만 알린다.
  // - normalized: 정규화해야만 걸림("모자 살 거야" 같은 우연일 수 있음) → AI에게 답장과 함께
  //   "실제 위기인가"를 반드시 채우게 해서(응답 형식 강제) 그 판단으로 안내 여부를 정한다.
  // - direct인데 명사 키워드("자살", "자해")가 들어 있음 → 합성어("자살골")일 수 있어 형태소로 다시 본다.
  //   Gemini 판단 칸과 Kiwi를 동시에 시작하고, 혼자 쓰인 단어면 안내, 합성어면 Gemini 판단을 따른다.
  // - none: 평소대로.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const level = lastUserMessage ? crisisLevel(lastUserMessage.content) : "none";
  const withContext = (extra: string) => [context, extra].filter(Boolean).join("\n\n");

  try {
    let reply: string;
    let crisis = false;

    const text = lastUserMessage?.content ?? "";

    if (level === "normalized") {
      const judged = await generateReplyWithCrisisJudgment(messages, withContext(CRISIS_JUDGE_CONTEXT));
      reply = judged.reply;
      crisis = judged.crisis;
    } else if (needsMorphemeCheck(text)) {
      const [judged, tokens] = await Promise.all([
        generateReplyWithCrisisJudgment(messages, withContext(CRISIS_JUDGE_CONTEXT)),
        withTimeout(analyzeTokens(text), KIWI_WAIT_MS),
      ]);
      reply = judged.reply;
      crisis = decideCrisis(text, tokens, judged.crisis);
    } else {
      reply = await generateReply(
        messages,
        level === "direct" ? withContext(CRISIS_NOTICE_CONTEXT) : context
      );
      crisis = level === "direct";
    }

    // 혹시 남은 [위기] 표시는 지운다(사용자 화면에 보이지 않게).
    return Response.json({ reply: extractCrisisTag(reply).reply, crisis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}

// 채팅방에 들어오면 화면이 한 번 보낸다(결과는 안 기다림). 같은 라우트라 같은 함수 인스턴스에
// Kiwi가 올라가, 사용자가 입력하는 동안 첫 준비(Vercel에서 약 5초)를 끝내 둔다.
export async function GET() {
  await getKiwi().catch((error) => console.error("Kiwi 준비 실패", error));
  return new Response(null, { status: 204 });
}
