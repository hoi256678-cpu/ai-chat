import { generateReply, type ChatMessage } from "@/lib/gemini";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];

  if (messages.length === 0) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  try {
    const reply = await generateReply(messages);
    return Response.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
