"use client";

import { useRouter } from "next/navigation";
import SymptomHistorySection from "@/components/SymptomHistorySection";

export default function HealthRecordsPage() {
  const router = useRouter();

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/main")}
          aria-label="메인으로 돌아가기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
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
        <h1 className="px-1 text-xl font-bold tracking-tight text-ink">내 건강 기록</h1>
      </header>

      <SymptomHistorySection />
    </main>
  );
}
