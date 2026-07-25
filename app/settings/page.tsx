"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setNickname(data.user?.user_metadata?.nickname ?? "");
    });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nickname.trim()) {
      setError("닉네임을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      data: { nickname: nickname.trim() },
    });

    setLoading(false);

    if (updateError) {
      setError("저장하지 못했어요. 잠시 후 다시 시도해주세요.");
      return;
    }

    setSaved(true);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-bg">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/main")}
          aria-label="메인으로 돌아가기"
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
        <span className="font-semibold text-ink">설정</span>
      </header>

      <div
        className="flex-1 px-6 py-8"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(22,33,44,0.06)]"
          >
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-sub">이메일</span>
              <p className="rounded-lg border border-line bg-tint px-3 py-2.5 text-base text-sub">
                {email}
              </p>
            </label>

            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-sub">닉네임</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => {
                  setNickname(event.target.value);
                  setSaved(false);
                }}
                placeholder="다른 사람에게 보일 이름"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
              />
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            {saved && (
              <p className="rounded-lg bg-tint px-3 py-2 text-sm text-accent-deep">
                저장됐어요.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-full bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
            >
              {loading ? "저장 중…" : "저장하기"}
            </button>
          </form>

          <button
            onClick={handleLogout}
            className="rounded-full border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-tint"
          >
            로그아웃
          </button>
        </div>
      </div>
    </main>
  );
}
