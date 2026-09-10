"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDayMessages, type StoredMessage } from "@/lib/chatHistory";
import { ChatMessages } from "@/components/ChatMessages";

function formatTitle(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export default function DiaryDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<StoredMessage[]>([]);

  useEffect(() => {
    getDayMessages(date).then((msgs) => {
      setMessages(msgs);
      setReady(true);
    });
  }, [date]);

  if (!ready) return null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/chats")}
          aria-label="일기 캘린더로 돌아가기"
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
        <h1 className="truncate text-xl font-bold tracking-tight text-ink">
          {formatTitle(date)}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <ChatMessages
          messages={messages}
          emptyText="이 날 나눈 대화가 없어요."
        />
      </div>
    </main>
  );
}
