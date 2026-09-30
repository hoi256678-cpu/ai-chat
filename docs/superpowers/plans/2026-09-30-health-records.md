# 내 건강 기록 (health-records) 통합 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 워치 데이터(`/biometrics`)와 지난 증상체크 기록(`/symptom-check/history`)을 하나의 "내 건강 기록"(`/health-records`) 화면 아래 탭 두 개로 통합한다.

**Architecture:** 두 기존 페이지의 헤더를 제외한 로직/JSX 전체를 각각 `components/SymptomHistorySection.tsx`, `components/BiometricsSection.tsx`로 그대로 옮기고, 새 `app/health-records/page.tsx`가 공통 헤더 + 탭 세그먼트 UI + `?tab=` 쿼리 파라미터에 따라 두 섹션 중 하나를 렌더링한다. 데이터 계층(`lib/symptomHistory.ts`, `lib/biometrics.ts` 등)은 변경하지 않는다.

**Tech Stack:** Next.js App Router (canary), React 19, TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-09-30-health-records-design.md`

## Global Constraints

- 이 리포의 Next.js 앱에는 테스트 러너가 없다 (`CLAUDE.md`) — 각 태스크의 검증은 자동화 테스트 대신 `npm run lint` + `npx tsc --noEmit -p tsconfig.json`로 한다.
- `useSearchParams()`를 쓰는 클라이언트 컴포넌트는 `<Suspense>` 경계로 감싸야 한다 (Next.js App Router 표준 요구사항) — `app/health-records/page.tsx`에서 지킨다.
- `proxy.ts`의 `config.matcher`는 보호되는 페이지 경로의 명시적 allowlist다. 새 경로를 추가하거나 옛 경로를 지울 때 반드시 이 배열도 같이 갱신한다 — 빠뜨리면 로그인 없이 접근 가능해지거나, 죽은 경로가 계속 보호 대상으로 남는다.
- `@/*` 경로 별칭은 리포 루트 기준이므로 파일을 옮겨도 import 경로 문자열은 그대로 쓴다.
- 컴포넌트 폴더(`components/`)는 서브폴더 없이 평평한 구조를 쓴다 — 새 파일도 이 관례를 따른다.

---

### Task 1: `components/SymptomHistorySection.tsx` 생성

**Files:**
- Create: `components/SymptomHistorySection.tsx`
- Reference (내용 출처, 이후 태스크에서 삭제 예정): `app/symptom-check/history/page.tsx`

**Interfaces:**
- Consumes: `deleteSymptomCheck`, `getSymptomChecks`, `SymptomCheckRecord` from `@/lib/symptomHistory`; `SymptomResultView` from `@/components/SymptomResultView`; `formatRelativeDate` from `@/lib/formatRelativeDate`; `CardDeck` from `@/components/CardDeck`.
- Produces: `export default function SymptomHistorySection(): JSX.Element` — no props. Later tasks (`app/health-records/page.tsx`) import this as the default export and render it with no props.

- [ ] **Step 1: `components/SymptomHistorySection.tsx` 파일을 아래 내용으로 생성**

`app/symptom-check/history/page.tsx`의 헤더(뒤로가기 바 + 타이틀)만 제거하고 나머지는 그대로 옮긴 내용이다. 컴포넌트 이름만 `SymptomCheckHistoryPage` → `SymptomHistorySection`으로, 더 이상 쓰지 않는 `useRouter`/`next/navigation` import를 제거했다.

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  deleteSymptomCheck,
  getSymptomChecks,
  type SymptomCheckRecord,
} from "@/lib/symptomHistory";
import { SymptomResultView } from "@/components/SymptomResultView";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { CardDeck } from "@/components/CardDeck";

export default function SymptomHistorySection() {
  const [records, setRecords] = useState<SymptomCheckRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SymptomCheckRecord | null>(
    null
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    getSymptomChecks()
      .then((data) => {
        setRecords(data);
        setReady(true);
      })
      .catch(() => {
        setError("기록을 불러오지 못했어요.");
        setReady(true);
      });
  }, []);

  function closeSheet() {
    setSelectedRecord(null);
    setConfirmingDelete(false);
  }

  async function handleDelete(id: string) {
    setDeleteError("");
    closeSheet();
    setRecords((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteSymptomCheck(id);
    } catch {
      setDeleteError("삭제에 실패했어요. 새로고침 후 다시 시도해주세요.");
    }
  }

  return (
    <>
      <div
        className="flex flex-1 flex-col overflow-y-auto py-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {deleteError && (
          <p className="mb-4 px-5 text-center text-sm text-danger" role="alert">
            {deleteError}
          </p>
        )}

        {!ready && (
          <p className="pt-10 text-center text-sm text-sub">불러오는 중…</p>
        )}
        {ready && error && (
          <p className="pt-10 text-center text-sm text-danger">{error}</p>
        )}
        {ready && !error && records.length === 0 && (
          <p className="pt-10 text-center text-sm text-sub">
            아직 증상체크 기록이 없어요.
          </p>
        )}

        {ready && !error && records.length > 0 && (
          <CardDeck
            items={records}
            getKey={(record) => record.id}
            onSelect={(record) => {
              setSelectedRecord(record);
              setConfirmingDelete(false);
            }}
            cardClassName={(active) =>
              active
                ? "flex h-[26rem] w-full shrink-0 scale-100 flex-col rounded-[2rem] border border-accent/25 bg-surface p-7 text-left opacity-100 shadow-[0_20px_40px_-16px_rgba(22,33,44,0.32)] transition-all duration-300 sm:h-[30rem]"
                : "flex h-[26rem] w-full shrink-0 scale-90 flex-col rounded-[2rem] border border-line bg-surface p-7 text-left opacity-40 shadow-none transition-all duration-300 sm:h-[30rem]"
            }
            renderCard={(record) => (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-ink sm:text-2xl">
                    {record.bodyPart}
                  </span>
                  <span className="text-xs text-sub sm:text-sm">
                    {formatRelativeDate(record.createdAt)}
                  </span>
                </div>

                {record.photo && (
                  <div className="relative mt-4 h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-tint sm:h-40">
                    {/* Blurred preview only — the clear photo is one tap
                        away in the detail sheet, not exposed in the
                        swipeable deck. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={record.photo}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="h-full w-full scale-110 object-cover blur-xl"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/90 drop-shadow">
                      눌러서 사진 보기
                    </span>
                  </div>
                )}

                <p className="mt-4 line-clamp-4 flex-1 text-base leading-relaxed text-ink sm:text-lg">
                  {record.conditions[0] ?? record.symptoms.join(", ")}
                </p>
                <p className="text-sm font-medium text-accent">
                  눌러서 자세히 보기 →
                </p>
              </>
            )}
          />
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="닫기"
            className="sheet-backdrop-in absolute inset-0 bg-ink/40"
            onClick={closeSheet}
          />
          <div
            className="sheet-rise-in relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:max-w-xl md:max-w-2xl"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="shrink-0 px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">
                  {selectedRecord.bodyPart} ·{" "}
                  {formatRelativeDate(selectedRecord.createdAt)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    aria-label="기록 삭제"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-danger-tint hover:text-danger"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7h16M9 7V4.8c0-.44.36-.8.8-.8h4.4c.44 0 .8.36.8.8V7m-9 0 .87 12.14A2 2 0 0 0 8.86 21h6.28a2 2 0 0 0 1.99-1.86L18 7M10 11v6M14 11v6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={closeSheet}
                    aria-label="닫기"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-tint"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <div className="flex flex-col gap-6">
                {selectedRecord.photo && (
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-ink">
                      첨부한 사진
                    </h2>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRecord.photo}
                      alt="증상체크 당시 첨부한 사진"
                      className="w-full rounded-2xl object-cover"
                    />
                  </div>
                )}

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-ink">증상</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRecord.symptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="rounded-full bg-tint px-2.5 py-1 text-xs font-medium text-ink"
                      >
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-6">
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-ink">
                      지속 기간
                    </h2>
                    <p className="text-sm text-ink">{selectedRecord.duration}</p>
                  </div>
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-ink">정도</h2>
                    <p className="text-sm text-ink">{selectedRecord.severity}</p>
                  </div>
                </div>

                <SymptomResultView result={selectedRecord} />
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedRecord && confirmingDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <button
            aria-label="취소"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setConfirmingDelete(false)}
          />
          <div className="relative z-10 w-full max-w-xs rounded-2xl bg-surface p-5 shadow-[0_20px_40px_-16px_rgba(22,33,44,0.32)]">
            <p className="text-center text-sm font-semibold text-ink">
              이 기록을 삭제하시겠습니까?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-tint active:scale-[0.98]"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(selectedRecord.id)}
                className="flex-1 rounded-full bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Lint + 타입체크 실행**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json`
Expected: 둘 다 에러 없이 종료. (이 시점엔 아직 아무도 `SymptomHistorySection`을 import하지 않으므로 "사용하지 않는 export" 경고는 나오지 않는다 — default export라 ESLint의 no-unused-vars 대상이 아님.)

- [ ] **Step 3: Commit**

```bash
git add components/SymptomHistorySection.tsx
git commit -m "Extract SymptomHistorySection component from history page"
```

---

### Task 2: `components/BiometricsSection.tsx` 생성

**Files:**
- Create: `components/BiometricsSection.tsx`
- Reference (내용 출처, 이후 태스크에서 삭제 예정): `app/biometrics/page.tsx`

**Interfaces:**
- Consumes: `saveBiometricReadings`, `getRecentBiometrics`, `getLatestMeasuredAt`, `BiometricRecord` from `@/lib/biometrics`; default export from `@/lib/nativeHealthConnect`; default export `HeartRateChart` from `@/components/HeartRateChart`; `Capacitor` from `@capacitor/core`.
- Produces: `export default function BiometricsSection(): JSX.Element` — no props. Later tasks (`app/health-records/page.tsx`) import this as the default export and render it with no props.

- [ ] **Step 1: `components/BiometricsSection.tsx` 파일을 아래 내용으로 생성**

`app/biometrics/page.tsx`의 헤더(뒤로가기 바 + 타이틀)만 제거하고 나머지는 그대로 옮긴 내용이다. 컴포넌트 이름만 `BiometricsPage` → `BiometricsSection`으로, 더 이상 쓰지 않는 `useRouter`/`next/navigation` import와 `router` 변수를 제거했다.

```tsx
"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  saveBiometricReadings,
  getRecentBiometrics,
  getLatestMeasuredAt,
  type BiometricRecord,
} from "@/lib/biometrics";
import HealthConnect from "@/lib/nativeHealthConnect";
import HeartRateChart from "@/components/HeartRateChart";

const HEALTH_CONNECT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

export default function BiometricsSection() {
  const [isAndroid, setIsAndroid] = useState(false);
  const [readings, setReadings] = useState<BiometricRecord[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAndroid(Capacitor.getPlatform() === "android");
  }, []);

  useEffect(() => {
    getRecentBiometrics()
      .then(setReadings)
      .catch(() => setMessage("불러오지 못했어요."));
  }, []);

  async function handleSync() {
    setMessage("");
    setAnalysis("");
    setSyncing(true);
    try {
      const { available } = await HealthConnect.isAvailable();
      if (!available) {
        setMessage("Health Connect 설치가 필요해요.");
        return;
      }

      const { granted } = await HealthConnect.requestPermissions();
      if (!granted) {
        setMessage("Health Connect 권한이 필요해요.");
        return;
      }

      const since = await getLatestMeasuredAt();
      const { samples } = await HealthConnect.readRecentHeartRate({ since });
      await saveBiometricReadings(
        samples.map((s) => ({ measuredAt: s.measuredAt, heartRate: s.heartRate }))
      );

      const updated = await getRecentBiometrics();
      setReadings(updated);
      if (samples.length === 0) {
        setMessage("아직 Samsung Health에 새로 동기화된 측정값이 없어요.");
      }
    } catch {
      setMessage("동기화에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    if (!readings || readings.length === 0) return;
    setAnalyzing(true);
    setAnalysis("");
    setMessage("");
    try {
      const res = await fetch("/api/biometrics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readings: readings.map((r) => ({
            measuredAt: r.measuredAt,
            heartRate: r.heartRate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");
      setAnalysis(data.analysis);
    } catch {
      setMessage("분석에 실패했어요. 다시 시도해주세요.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto px-5 pb-6"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        onClick={handleSync}
        disabled={syncing || !isAndroid}
        className="mb-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98] disabled:opacity-60"
      >
        {syncing ? "동기화 중…" : "Samsung Health에서 동기화"}
      </button>

      {!isAndroid && (
        <p className="mb-4 text-sm text-sub">
          📱 실시간 동기화는 안드로이드 앱에서만 가능해요 — 여기선 지난 기록만 볼 수 있어요.
        </p>
      )}

      {message && (
        <p className="mb-4 text-sm text-sub" role="status">
          {message}{" "}
          {message.includes("설치") && (
            <a
              href={HEALTH_CONNECT_PLAY_STORE_URL}
              className="font-medium text-accent underline"
            >
              Play 스토어에서 설치
            </a>
          )}
        </p>
      )}

      {readings === null && (
        <p className="pt-10 text-center text-sm text-sub">불러오는 중…</p>
      )}

      {readings !== null && readings.length === 0 && (
        <div className="mt-6 rounded-card border border-dashed border-line px-4 py-8 text-center">
          <p className="text-sm text-sub">
            아직 측정된 심박수가 없어요. Samsung Health에서 측정해보세요.
          </p>
        </div>
      )}

      {readings !== null && readings.length > 0 && (
        <>
          <HeartRateChart readings={readings} />

          <ul className="flex flex-col gap-2">
            {readings.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3"
              >
                <span className="text-sm text-ink">
                  {new Date(r.measuredAt).toLocaleString("ko-KR")}
                </span>
                <span className="text-sm font-semibold text-ink">
                  {r.heartRate} bpm
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="mt-5 rounded-full border border-accent px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-tint active:scale-[0.98] disabled:opacity-60"
          >
            {analyzing ? "분석 중…" : "AI 분석하기"}
          </button>

          {analysis && (
            <div className="mt-4 rounded-card bg-surface p-4 shadow-card">
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                {analysis}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lint + 타입체크 실행**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json`
Expected: 둘 다 에러 없이 종료.

- [ ] **Step 3: Commit**

```bash
git add components/BiometricsSection.tsx
git commit -m "Extract BiometricsSection component from biometrics page"
```

---

### Task 3: `/health-records` 페이지 생성 + 라우트 보호 갱신

**Files:**
- Create: `app/health-records/page.tsx`
- Modify: `proxy.ts:47-56` (`config.matcher` 배열)

**Interfaces:**
- Consumes: `SymptomHistorySection` (Task 1), `BiometricsSection` (Task 2) as default exports, no props.
- Produces: 라우트 `/health-records`, 지원 쿼리 파라미터 `?tab=symptoms|biometrics` (기본값 `symptoms`). 이후 태스크(4, 5)가 이 URL로 링크를 건다.

- [ ] **Step 1: `app/health-records/page.tsx` 파일을 아래 내용으로 생성**

```tsx
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
```

- [ ] **Step 2: `proxy.ts`의 `config.matcher`에서 `/biometrics`를 `/health-records`로 교체**

`proxy.ts:47-56`이 현재:

```ts
  matcher: [
    "/main",
    "/chat",
    "/chats/:path*",
    "/symptom-check/:path*",
    "/settings",
    "/medications",
    "/medications/:path*",
    "/biometrics",
  ],
```

이걸 아래로 바꾼다 (`/symptom-check/history`는 이미 `/symptom-check/:path*`가 커버하므로 별도 항목 불필요):

```ts
  matcher: [
    "/main",
    "/chat",
    "/chats/:path*",
    "/symptom-check/:path*",
    "/settings",
    "/medications",
    "/medications/:path*",
    "/health-records",
  ],
```

- [ ] **Step 3: Lint + 타입체크 실행**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json`
Expected: 둘 다 에러 없이 종료.

- [ ] **Step 4: (가능하면) 수동 확인**

`.env.local`이 구성되어 있으면 `npm run dev` 후 로그인해서 `/health-records`, `/health-records?tab=biometrics`에 직접 접속해 두 탭 모두 각자의 기존 화면과 동일하게 동작하는지 확인한다. `.env.local`이 없으면 이 스텝은 건너뛰고 다음 태스크로 진행한다.

- [ ] **Step 5: Commit**

```bash
git add app/health-records/page.tsx proxy.ts
git commit -m "Add /health-records page with tabbed symptom/biometrics sections"
```

---

### Task 4: 메인 허브 카드를 "내 건강 기록"으로 교체

**Files:**
- Modify: `app/main/page.tsx:233-248`

**Interfaces:**
- Consumes: `/health-records` 라우트 (Task 3).

- [ ] **Step 1: "워치 데이터 확인하기" `MenuCard`를 "내 건강 기록"으로 교체**

`app/main/page.tsx:233-248`이 현재:

```tsx
            <MenuCard
              onClick={() => router.push("/biometrics")}
              label="워치 데이터 확인하기"
              description="심박수 동기화하고 AI 분석 받기"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12h3l2.5-6 4 12 2.5-6H20"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
```

이걸 아래로 바꾼다 (아이콘은 그대로 유지):

```tsx
            <MenuCard
              onClick={() => router.push("/health-records")}
              label="내 건강 기록"
              description="증상 기록과 워치 데이터 한눈에 보기"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12h3l2.5-6 4 12 2.5-6H20"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
```

- [ ] **Step 2: Lint + 타입체크 실행**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json`
Expected: 둘 다 에러 없이 종료.

- [ ] **Step 3: Commit**

```bash
git add app/main/page.tsx
git commit -m "Point main hub's watch-data card at /health-records"
```

---

### Task 5: 증상체크 마법사의 "지난 기록 보기" 링크 변경

**Files:**
- Modify: `app/symptom-check/page.tsx:325`

**Interfaces:**
- Consumes: `/health-records?tab=symptoms` 라우트 (Task 3).

- [ ] **Step 1: `onClick` 경로 변경**

`app/symptom-check/page.tsx:325`가 현재:

```tsx
                      onClick={() => router.push("/symptom-check/history")}
```

이걸 아래로 바꾼다:

```tsx
                      onClick={() => router.push("/health-records?tab=symptoms")}
```

- [ ] **Step 2: Lint + 타입체크 실행**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json`
Expected: 둘 다 에러 없이 종료.

- [ ] **Step 3: Commit**

```bash
git add app/symptom-check/page.tsx
git commit -m "Link wizard's past-records button to /health-records"
```

---

### Task 6: 옛 페이지 삭제 + 참조 정리 + 최종 검증

**Files:**
- Delete: `app/symptom-check/history/page.tsx`
- Delete: `app/biometrics/page.tsx`
- Modify: `components/CardDeck.tsx` (주석 한 줄)
- Modify: `components/SymptomResultView.tsx` (주석 한 줄)

**Interfaces:** 없음 — 정리 태스크.

- [ ] **Step 1: 옛 페이지 파일 삭제**

```bash
git rm app/symptom-check/history/page.tsx app/biometrics/page.tsx
```

(빈 디렉터리 `app/symptom-check/history/`, `app/biometrics/`는 git이 자동으로 정리한다 — 별도 조치 불필요.)

- [ ] **Step 2: `components/CardDeck.tsx`의 옛 경로 주석 갱신**

`components/CardDeck.tsx:84-87`이 현재:

```ts
// Full-bleed, app-switcher-style swipeable card deck (mouse-drag + native
// touch swipe). Extracted from /symptom-check/history so other lists (e.g.
// medications) can reuse the same drag/snap mechanics without duplicating
// this file's math.
```

이걸 아래로 바꾼다:

```ts
// Full-bleed, app-switcher-style swipeable card deck (mouse-drag + native
// touch swipe). Extracted from components/SymptomHistorySection.tsx so other
// lists (e.g. medications) can reuse the same drag/snap mechanics without
// duplicating this file's math.
```

- [ ] **Step 3: `components/SymptomResultView.tsx`의 옛 경로 주석 갱신**

`components/SymptomResultView.tsx:7-12`가 현재:

```ts
// Shared between the live result screen (app/symptom-check/page.tsx, right
// after generateReply returns) and the history detail view
// (app/symptom-check/history/page.tsx, replaying a saved record) so both
// look and behave identically — including the department buttons, which
// re-run a live hospital search near the viewer's current location
// regardless of when the original check happened.
```

이걸 아래로 바꾼다:

```ts
// Shared between the live result screen (app/symptom-check/page.tsx, right
// after generateReply returns) and the history detail view
// (components/SymptomHistorySection.tsx, replaying a saved record) so both
// look and behave identically — including the department buttons, which
// re-run a live hospital search near the viewer's current location
// regardless of when the original check happened.
```

- [ ] **Step 4: 옛 경로에 대한 남은 참조가 없는지 확인**

Run: `grep -rn "/symptom-check/history\|/biometrics\b\|SymptomCheckHistoryPage\|BiometricsPage" app components proxy.ts --include="*.ts" --include="*.tsx"`
Expected: 결과 없음 (0 matches). 뭔가 나오면 그 파일도 이번 태스크에서 같이 정리한다.

- [ ] **Step 5: Lint + 타입체크 + 프로덕션 빌드로 최종 검증**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: 셋 다 에러 없이 종료. (`npm run build`까지 돌리는 이유: 삭제된 라우트가 Next의 라우트 매니페스트에서 완전히 빠졌는지, 새 라우트가 정적/동적 분석에서 문제없이 잡히는지는 dev 서버만으론 확인되지 않는 경우가 있다.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Remove standalone symptom-history and biometrics pages"
```
