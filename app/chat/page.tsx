"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/session";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setEmail(session.email);
    setReady(true);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "응답을 받지 못했습니다.");
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  if (!ready) return null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {email}
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          로그아웃
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
              무엇이든 물어보세요.
            </p>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-zinc-950 px-4 py-2.5 text-sm text-white dark:bg-zinc-50 dark:text-zinc-950"
                  : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              }
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}

          {loading && (
            <div className="mr-auto max-w-[80%] rounded-2xl rounded-bl-sm border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
              생각하는 중…
            </div>
          )}

          {error && (
            <p className="text-center text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="메시지를 입력하세요…"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            보내기
          </button>
        </div>
      </form>
    </main>
  );
}
