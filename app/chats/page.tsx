"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/session";
import { formatDateKey, getDatesWithHistory, todayKey } from "@/lib/chatHistory";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function CalendarPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => startOfMonth(new Date()));
  const [historyDates, setHistoryDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setHistoryDates(new Set(getDatesWithHistory()));
    setReady(true);
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  const today = useMemo(() => new Date(), []);
  const isCurrentMonth = isSameMonth(viewedMonth, today);

  const cells = useMemo(() => {
    const daysInMonth = new Date(
      viewedMonth.getFullYear(),
      viewedMonth.getMonth() + 1,
      0
    ).getDate();
    const firstWeekday = viewedMonth.getDay();

    const result: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), d));
    }
    return result;
  }, [viewedMonth]);

  function handleDayClick(date: Date) {
    const key = formatDateKey(date);
    if (key === todayKey()) {
      router.push("/chat");
      return;
    }
    router.push(`/chats/${key}`);
  }

  if (!ready) return null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center justify-between px-6 pb-4"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <h1 className="text-xl font-bold tracking-tight text-ink">대화 일기</h1>
        <button
          onClick={handleLogout}
          className="text-xs font-medium text-sub transition hover:text-ink"
        >
          로그아웃
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="이전 달"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <span className="font-semibold text-ink">
            {viewedMonth.getFullYear()}년 {viewedMonth.getMonth() + 1}월
          </span>

          <button
            onClick={() => setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="다음 달"
            disabled={isCurrentMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint disabled:pointer-events-none disabled:opacity-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-2 text-xs font-medium text-sub">
              {day}
            </span>
          ))}

          {cells.map((date, index) => {
            if (!date) return <div key={index} />;

            const key = formatDateKey(date);
            const isToday = key === todayKey();
            const hasHistory = historyDates.has(key);

            return (
              <div key={index} className="flex items-center justify-center py-0.5">
                <button
                  onClick={() => handleDayClick(date)}
                  className={
                    isToday
                      ? "relative flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white transition active:scale-95"
                      : hasHistory
                        ? "relative flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 text-sm font-medium text-ink transition hover:bg-tint active:bg-tint"
                        : "relative flex h-10 w-10 items-center justify-center rounded-full text-sm text-sub/50 transition hover:bg-tint active:bg-tint"
                  }
                >
                  {date.getDate()}
                  {hasHistory && !isToday && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-sub">
          날짜를 누르면 그날 나눈 대화를 볼 수 있어요. 테두리와 점이 있는 날은 대화가 남아있는 날이에요.
        </p>
      </div>
    </main>
  );
}
