"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/authErrors";

export default function SignupPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Same reasoning as app/page.tsx — "/signup" has no proxy guard
    // either, so an already-logged-in user would otherwise see the
    // signup form instead of being sent to /main.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/main");
        return;
      }
      setCheckingSession(false);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password || !nickname) {
      setError("이메일, 비밀번호, 닉네임을 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    });

    if (authError) {
      setLoading(false);
      setError(translateAuthError(authError.message));
      return;
    }

    // 가입만 하고 세션은 바로 만들지 않음 — 로그인 화면에서 본인이 직접
    // 로그인하게 유도.
    await supabase.auth.signOut();
    router.push("/?signup=success");
  }

  if (checkingSession) return null;

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-bg px-6"
      style={{
        paddingTop: "max(3rem, env(safe-area-inset-top))",
        paddingBottom: "max(3rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="orb-mark orb-mark--hero mb-6 h-16 w-16" aria-hidden />

        <h1 className="font-display mb-1 text-center text-lg font-semibold tracking-tight text-sub">
          AI Chat
        </h1>
        <p className="mb-1 text-center text-2xl font-bold tracking-tight text-ink">
          환영해요, 시작해볼까요?
        </p>
        <p className="mb-6 max-w-[22rem] text-center text-sm leading-relaxed text-sub">
          계정을 만들고 AI와 첫 대화를 시작해보세요.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(22,33,44,0.06)]"
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-sub">닉네임</span>
              <input
                type="text"
                autoComplete="nickname"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="다른 사람에게 보일 이름"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-sub">이메일</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-sub">비밀번호</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
              />
            </label>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-full bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
            >
              {loading ? "처리 중…" : "회원가입"}
            </button>
          </div>
        </form>

        <Link
          href="/"
          className="mt-6 text-center text-xs font-medium text-sub underline-offset-4 transition hover:text-ink hover:underline"
        >
          이미 계정이 있으신가요? 로그인
        </Link>
      </div>
    </main>
  );
}
