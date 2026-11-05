import { generateReply, type ChatMessage } from "@/lib/ai";
import { crisisLevel } from "@/lib/crisisDetection";
import {
  CRISIS_JUDGE_CONTEXT,
  CRISIS_NOTICE_CONTEXT,
  extractCrisisTag,
} from "@/lib/crisisNotice";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];
  let context: string | undefined = body?.context;

  if (messages.length === 0) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  // 단계별 판정. AI는 어느 경우든 평소처럼 답하고, 안내 띠는 화면(ChatMessages)이 따로 붙인다.
  // - direct: 원문에 위기 키워드가 그대로 있음 → 무조건 안내. AI에는 번호를 반복하지 말라고만 알린다.
  // - normalized: 정규화해야만 걸림("모자 살 거야" 같은 우연일 수 있음) → AI가 문맥으로 판단해
  //   위기면 답 앞에 [위기]를 붙이고, 서버가 그 표시를 떼서 crisis로 넘긴다.
  // - none: 평소대로.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const level = lastUserMessage ? crisisLevel(lastUserMessage.content) : "none";
  if (level === "direct") {
    context = [context, CRISIS_NOTICE_CONTEXT].filter(Boolean).join("\n\n");
  } else if (level === "normalized") {
    context = [context, CRISIS_JUDGE_CONTEXT].filter(Boolean).join("\n\n");
  }

  try {
    const raw = await generateReply(messages, context);
    // 표시는 어느 경우든 지운다(지시하지 않았는데 붙여도 화면에 보이지 않게).
    const { reply, flagged } = extractCrisisTag(raw);
    const crisis = level === "direct" || (level === "normalized" && flagged);
    return Response.json({ reply, crisis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
