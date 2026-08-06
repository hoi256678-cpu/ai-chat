"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MainPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");

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
  }, []);

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
        <div
          className="orb-mark orb-mark--hero mb-8 h-24 w-24"
          aria-hidden
        />

        <h1 className="text-center text-2xl font-bold tracking-tight text-ink break-words">
          안녕하세요, {displayName}님
        </h1>
        <p className="mt-2 text-center text-sm text-sub">
          오늘은 어떤 이야기를 나눠볼까요?
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
