import { generateReply, type ChatMessage } from "@/lib/ai";
import { containsCrisisSignal } from "@/lib/crisisDetection";
import { CRISIS_NOTICE_CONTEXT } from "@/lib/crisisNotice";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];
  let context: string | undefined = body?.context;

  if (messages.length === 0) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  // 위기 키워드가 있어도 AI는 평소처럼 답한다. 109 안내 띠는 화면(ChatMessages)이
  // 같은 검사로 답변 밑에 따로 붙이므로, AI에는 번호를 반복하지 말라고만 알린다.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage && containsCrisisSignal(lastUserMessage.content)) {
    context = [context, CRISIS_NOTICE_CONTEXT].filter(Boolean).join("\n\n");
  }

  try {
    const reply = await generateReply(messages, context);
    return Response.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
