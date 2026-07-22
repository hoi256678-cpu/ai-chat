"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/session";

export default function MainPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setEmail(session.email);
    setReady(true);
  }, [router]);

  function handleLogout() {
    clearSession();
    router.replace("/");
  }

  if (!ready) return null;

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-bg">
      <div
        className="flex justify-end px-6"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={handleLogout}
          className="text-xs font-medium text-sub transition hover:text-ink"
        >
          로그아웃
        </button>
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center px-6"
        style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
      >
        <div
          className="orb-mark orb-mark--hero mb-8 h-24 w-24"
          aria-hidden
        />

        <h1 className="text-center text-2xl font-bold tracking-tight text-ink break-words">
          안녕하세요, {email}
        </h1>
        <p className="mt-2 text-center text-sm text-sub">
          AI와 편하게 대화를 나눠보세요.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push("/chats")}
            className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(47,135,224,0.65)] transition hover:bg-accent-deep active:scale-[0.98]"
          >
            채팅 시작하기
          </button>

          <button
            onClick={() => router.push("/symptom-check")}
            className="rounded-full border border-line bg-surface px-8 py-3.5 text-sm font-semibold text-ink transition hover:border-accent/40 hover:bg-tint active:scale-[0.98]"
          >
            증상 체크하기
          </button>
        </div>
      </div>
    </main>
  );
}
