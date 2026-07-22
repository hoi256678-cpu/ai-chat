"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setSession({ email });
    router.push("/chat");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-24 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          AI Chat
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          로그인하고 AI와 대화를 시작하세요.
        </p>

        <form
          onSubmit={handleSubmit}
          className="w-full rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                이메일
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-black dark:text-zinc-50"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-left">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                비밀번호
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-black dark:text-zinc-50"
              />
            </label>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-2 rounded-lg bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              로그인
            </button>
          </div>
        </form>

        <p className="mt-6 max-w-xs text-center text-xs text-zinc-400 dark:text-zinc-500">
          데모용 화면입니다 — 아무 이메일/비밀번호로 입장할 수 있어요.
        </p>
      </div>
    </main>
  );
}
