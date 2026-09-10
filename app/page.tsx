"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient, createSessionOnlyClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/authErrors";

const REMEMBERED_EMAIL_KEY = "ai-chat-remembered-email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(true);
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState("");
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Deferred to post-mount (not a lazy useState initializer) so the
    // server-rendered empty state and the first client render still
    // match — reading localStorage/location during the initial render
    // would cause a hydration mismatch.
    const saved = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    const isFreshSignup =
      new URLSearchParams(window.location.search).get("signup") === "success";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setEmail(saved);
    if (isFreshSignup) setJustSignedUp(true);

    // proxy.ts only guards /main, /chat, etc. — "/" itself has no guard,
    // so a session cookie from an earlier tab (or an earlier visit) is
    // never checked here on its own. Without this, a user who's already
    // logged in keeps landing on the login form in any new tab.
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
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setJustSignedUp(false);

    // "자동 로그인" 체크 해제 시 세션 쿠키를 브라우저 종료 시 사라지는
    // 방식으로 저장 — 다른 화면은 항상 createClient()만 쓰므로 이
    // 로그인 시점 선택 외에는 영향 없음.
    const supabase = autoLogin ? createClient() : createSessionOnlyClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (authError) {
      setError(translateAuthError(authError.message));
      return;
    }

    if (rememberEmail) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    router.push("/main");
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
          HealthMate
        </h1>
        <p className="mb-1 text-center text-2xl font-bold tracking-tight text-ink">
          다시 만나서 반가워요
        </p>
        <p className="mb-6 max-w-[22rem] text-center text-sm leading-relaxed text-sub">
          로그인하고 이어서 대화를 나눠보세요.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-card bg-surface p-6 shadow-card"
        >
          <div className="flex flex-col gap-4">
            {justSignedUp && (
              <p className="rounded-lg bg-tint px-3 py-2 text-sm text-accent-deep">
                가입이 완료됐어요. 로그인해주세요.
              </p>
            )}

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
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
              />
            </label>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-sub">
                <input
                  type="checkbox"
                  checked={autoLogin}
                  onChange={(event) => setAutoLogin(event.target.checked)}
                  className="h-4 w-4 rounded border-line accent-accent"
                />
                자동 로그인
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-sub">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(event) => setRememberEmail(event.target.checked)}
                  className="h-4 w-4 rounded border-line accent-accent"
                />
                아이디 저장
              </label>
            </div>

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
              {loading ? "처리 중…" : "로그인"}
            </button>
          </div>
        </form>

        <Link
          href="/signup"
          className="mt-6 text-center text-xs font-medium text-sub underline-offset-4 transition hover:text-ink hover:underline"
        >
          계정이 없으신가요? 회원가입
        </Link>
      </div>
    </main>
  );
}
