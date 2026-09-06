"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDueSlots, type DoseSlot } from "@/lib/medications";

export default function MainPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [dueSlots, setDueSlots] = useState<DoseSlot[]>([]);
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
    getDueSlots()
      .then(setDueSlots)
      .catch(() => {});
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
            onClick={() => setShowNotifications((prev) => !prev)}
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
            {dueSlots.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {dueSlots.length > 9 ? "9+" : dueSlots.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-line bg-surface p-2 shadow-[0_12px_28px_-12px_rgba(22,33,44,0.3)]">
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

          <div className="mt-10 flex w-64 flex-col items-center gap-3">
            <button
              onClick={() => router.push("/chat")}
              className="w-full rounded-full bg-accent px-8 py-3.5 text-center text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(47,135,224,0.65)] transition hover:bg-accent-deep active:scale-[0.98]"
            >
              채팅 시작하기
            </button>

            <button
              onClick={() => router.push("/symptom-check")}
              className="w-full rounded-full border border-line bg-surface px-8 py-3.5 text-center text-sm font-semibold text-ink transition hover:border-accent/40 hover:bg-tint active:scale-[0.98]"
            >
              증상 체크하기
            </button>

            <button
              onClick={() => router.push("/medications")}
              className="w-full rounded-full border border-line bg-surface px-8 py-3.5 text-center text-sm font-semibold text-ink transition hover:border-accent/40 hover:bg-tint active:scale-[0.98]"
            >
              복용/복약 관리하기
            </button>

            <button
              onClick={() => router.push("/chats")}
              className="w-full rounded-full border border-line bg-surface px-8 py-3.5 text-center text-sm font-semibold text-ink transition hover:border-accent/40 hover:bg-tint active:scale-[0.98]"
            >
              캘린더 확인하기
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
