"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  appendDayMessage,
  getDayMessages,
  todayKey,
  type StoredMessage,
} from "@/lib/chatHistory";
import { ChatMessages } from "@/components/ChatMessages";

function formatTime(date: Date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ChatRoomPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getDayMessages(todayKey()).then((msgs) => {
      setMessages(msgs);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: StoredMessage = {
      role: "user",
      content: text,
      time: formatTime(new Date()),
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      await appendDayMessage(todayKey(), userMessage);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "응답을 받지 못했어요.");
      }
      const assistantMessage: StoredMessage = {
        role: "assistant",
        content: data.reply,
        time: formatTime(new Date()),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      await appendDayMessage(todayKey(), assistantMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/chats")}
          aria-label="채팅목록으로 돌아가기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="orb-mark h-8 w-8 shrink-0" aria-hidden />
        <span className="truncate font-semibold text-ink">AI 어시스턴트</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <ChatMessages
          messages={messages}
          loading={loading}
          emptyText="무엇이든 물어보세요."
          bottomRef={bottomRef}
        />
        {error && (
          <p className="pt-2 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 px-3 pt-2"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full bg-surface px-2 py-2 shadow-[0_2px_10px_-4px_rgba(22,33,44,0.15)]">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="메시지를 입력하세요…"
            className="flex-1 rounded-full bg-transparent px-3 py-2 text-base text-ink outline-none placeholder:text-sub/70"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="보내기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-deep disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12h13m0 0l-6-6m6 6l-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </form>
    </main>
  );
}
