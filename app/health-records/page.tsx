"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SymptomHistorySection from "@/components/SymptomHistorySection";
import BiometricsSection from "@/components/BiometricsSection";

type Tab = "symptoms" | "biometrics";

export default function HealthRecordsPage() {
  return (
    <Suspense fallback={null}>
      <HealthRecordsContent />
    </Suspense>
  );
}

function HealthRecordsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "biometrics" ? "biometrics" : "symptoms";

  function setTab(next: Tab) {
    router.replace(`/health-records?tab=${next}`);
  }

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

      <div className="mx-5 mt-4 flex shrink-0 gap-1 rounded-full bg-tint p-1">
        <button
          onClick={() => setTab("symptoms")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
            tab === "symptoms" ? "bg-surface text-ink shadow-card" : "text-sub"
          }`}
        >
          증상 기록
        </button>
        <button
          onClick={() => setTab("biometrics")}
          className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
            tab === "biometrics" ? "bg-surface text-ink shadow-card" : "text-sub"
          }`}
        >
          워치 데이터
        </button>
      </div>

      {tab === "symptoms" ? <SymptomHistorySection /> : <BiometricsSection />}
    </main>
  );
}
