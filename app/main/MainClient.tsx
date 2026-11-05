"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateKey } from "@/lib/chatHistory";
import { getDueSlots, type DoseSlot } from "@/lib/medications";
import { isDoseSeen, markDosesSeen } from "@/lib/doseNotifications";
import MenuCard from "@/components/MenuCard";

const POLL_INTERVAL_MS = 30_000;

export default function MainPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [dueSlots, setDueSlots] = useState<DoseSlot[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // proxy.ts already guarantees this page is only reached when
  // authenticated — this just fetches the name to display it.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      // Prefer the nickname set at signup; fall back to the email's
      // local-part ("hoi256678") for accounts created before nicknames
      // existed, or a wall of text with the full address either way.
      const nickname = data.user?.user_metadata?.nickname;
      setDisplayName(nickname || data.user?.email?.split("@")[0] || "");
    });

    function refreshDueSlots() {
      getDueSlots()
        .then((slots) => {
          setDueSlots(slots);
          const today = formatDateKey(new Date());
          setUnseenCount(
            slots.filter((s) => !isDoseSeen(today, s.medicationId, s.time)).length
          );
        })
        .catch(() => {});
    }

    refreshDueSlots();
    const id = setInterval(refreshDueSlots, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    function handleOutsideClick(event: MouseEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showNotifications]);

  function handleBellClick() {
    setShowNotifications((prev) => {
      const next = !prev;
      if (next && dueSlots.length > 0) {
        markDosesSeen(formatDateKey(new Date()), dueSlots);
        setUnseenCount(0);
      }
      return next;
    });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-bg">
      <div
        className="flex items-center justify-end gap-1 px-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={handleBellClick}
            aria-label="복용/복약 알림"
            aria-expanded={showNotifications}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-tint hover:text-ink active:bg-tint"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 8a6 6 0 0 1 12 0c0 3.2 1 5 1.8 6.2a1 1 0 0 1-.8 1.6H5a1 1 0 0 1-.8-1.6C5 13 6 11.2 6 8Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9.5 18.5a2.5 2.5 0 0 0 5 0"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
            {unseenCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {unseenCount > 9 ? "9+" : unseenCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-card bg-surface p-2 shadow-card">
              {dueSlots.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-sub">
                  아직 복용/복약 알림이 없어요.
                </p>
              ) : (
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                  {dueSlots.map((slot) => (
                    <button
                      key={`${slot.medicationId}-${slot.time}`}
                      onClick={() => {
                        setShowNotifications(false);
                        router.push("/medications");
                      }}
                      className="rounded-xl px-3 py-2.5 text-left text-sm text-ink transition hover:bg-tint"
                    >
                      <span className="font-semibold">{slot.name}</span> 복용/복약
                      시간이에요
                      <span className="ml-1.5 text-xs text-sub">{slot.time}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => router.push("/settings")}
          className="rounded-full px-3 py-2.5 text-xs font-medium text-sub transition hover:bg-tint hover:text-ink active:bg-tint"
        >
          설정
        </button>
        <button
          onClick={handleLogout}
          className="rounded-full px-3 py-2.5 text-xs font-medium text-sub transition hover:bg-tint hover:text-ink active:bg-tint"
        >
          로그아웃
        </button>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center px-6"
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex w-full max-w-sm flex-col items-center">
          <div className="orb-mark orb-mark--hero mb-4 h-20 w-20" aria-hidden />

          <p className="font-display mb-1 text-center text-xs font-semibold tracking-tight text-sub">
            HealthMate
          </p>
          <h1 className="text-center text-2xl font-bold tracking-tight text-ink break-words">
            안녕하세요, {displayName}님
          </h1>
          <p className="mt-2 text-center text-sm text-sub">
            오늘은 어떤 이야기를 나눠볼까요?
          </p>

          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <MenuCard
              onClick={() => router.push("/chat")}
              tone="blush"
              label="채팅 시작하기"
              description="오늘의 이야기를 나눠보세요"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 5.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4.5 4v-4H6a2 2 0 0 1-2-2v-9Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />

            <MenuCard
              onClick={() => router.push("/symptom-check")}
              label="증상 체크하기"
              description="증상을 입력하고 AI 분석 받기"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M8 4v4a2 2 0 0 1-2 2H4M12 4v4a4 4 0 0 0 4 4v0a4 4 0 0 1 4 4v4M8 12v2a4 4 0 0 0 4 4h0"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="18" cy="18" r="2" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              }
            />

            <MenuCard
              onClick={() => router.push("/medications")}
              label="복용/복약 관리하기"
              description="복약 등록하고 알림 받기"
              tone="blush"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="9"
                    width="16"
                    height="9"
                    rx="3.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path d="M4 13.5h16" stroke="currentColor" strokeWidth="1.7" />
                  <path
                    d="M9 9V7a3 3 0 0 1 6 0v2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />

            <MenuCard
              onClick={() => router.push("/health-records")}
              label="내 건강 기록"
              description="증상 기록과 워치 데이터 한눈에 보기"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12h3l2.5-6 4 12 2.5-6H20"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />

            <MenuCard
              onClick={() => router.push("/chats")}
              tone="blush"
              label="캘린더 확인하기"
              description="지난 대화 기록 살펴보기"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="4"
                    y="5.5"
                    width="16"
                    height="14.5"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <path
                    d="M4 9.5h16M8 3.5v3M16 3.5v3"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
          </div>
        </div>
      </div>
    </main>
  );
}
