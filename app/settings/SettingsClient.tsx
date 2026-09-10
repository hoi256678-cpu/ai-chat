"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setTheme, type ThemePreference } from "@/lib/theme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "시스템 설정" },
  { value: "light", label: "라이트" },
  { value: "dark", label: "다크" },
];

export default function SettingsClient({
  initialTheme,
}: {
  initialTheme: ThemePreference;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Seeded from the server-read cookie (app/settings/page.tsx) rather than
  // read client-side here — a client-side cookie read would disagree with
  // the server's render (it always has no cookie access) and hydration
  // would flag every non-default theme as a mismatch.
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setNickname(data.user?.user_metadata?.nickname ?? "");
    });
  }, []);

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    setThemeState(next);
  }

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
        <h1 className="text-xl font-bold tracking-tight text-ink">설정</h1>
      </header>

      <div
        className="flex-1 px-6 py-8"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-card"
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

          <div className="flex flex-col gap-1.5 rounded-card bg-surface p-6 text-left shadow-card">
            <span className="text-xs font-medium text-sub">화면 모드</span>
            <div className="mt-2 flex gap-1 rounded-full bg-tint p-1">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleThemeChange(option.value)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                    theme === option.value
                      ? "bg-accent text-white"
                      : "text-sub hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

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
