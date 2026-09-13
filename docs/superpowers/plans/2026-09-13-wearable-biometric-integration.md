# 갤럭시 워치 생체 데이터 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 갤럭시 워치가 Samsung Health를 거쳐 Health Connect에 동기화해둔 심박수를, Capacitor로 감싼 안드로이드 셸 앱에서 읽어와 Supabase에 저장하고 Gemini로 해석해준다.

**Architecture:** 기존 배포된 Next.js 웹앱(Vercel)을 Capacitor Android 셸로 WebView 감싸고, 셸 안의 네이티브 `HealthConnectPlugin`이 Health Connect의 `HeartRateRecord`를 읽어 JS로 전달한다. JS 쪽은 `lib/medications.ts`와 동일한 "컴포넌트는 Supabase를 직접 호출, 새 서버 API 불필요" 패턴을 재사용하고, Gemini 해석만 기존 `lib/gemini.ts` + API 라우트 패턴을 따른다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Supabase(Postgres+RLS), Gemini REST API — 그리고 신규로 Capacitor 8, Kotlin, `androidx.health.connect:connect-client`.

**Spec:** `docs/superpowers/specs/2026-09-13-wearable-biometric-integration-design.md`

## Global Constraints

- 테스트 러너가 구성되어 있지 않다(`CLAUDE.md` 명시) — Next.js 쪽 각 태스크는 `npx tsc --noEmit` + `npm run lint` + 수동 스모크 테스트로 검증한다. 네이티브(Android/Kotlin) 쪽은 실기기 빌드·실행이 유일한 현실적 검증 방법이다.
- Capacitor 셸은 로컬 빌드 산출물을 배포하지 않고, **배포된 프로덕션 URL을 그대로 WebView로 로드**한다: `https://ai-chat-black-nine.vercel.app` (GitHub Deployments API로 확인한 최신 프로덕션 배포 주소 — 커스텀 도메인으로 바뀌면 `android-shell/capacitor.config.ts`의 `server.url`만 갱신하면 된다).
- `/biometrics` 진입점(메인 허브의 메뉴 카드, 페이지 자체는 접근 가능)은 `Capacitor.getPlatform() === "android"`일 때만 노출한다 — 아이폰/PC 브라우저 사용자는 이 기능 자체를 볼 일이 없다.
- Health Connect는 **읽기 권한만** 요청한다(`READ_HEART_RATE`) — 쓰기 권한/데이터 기록 기능은 만들지 않는다.
- 백그라운드 동기화(WorkManager 등)는 만들지 않는다 — `/biometrics` 진입 또는 "동기화" 버튼 탭이라는 명시적 트리거만 사용한다.
- `biometrics` 테이블은 select/insert 정책만 만든다(수정·삭제 없음 — 워치 측정값은 불변 기록이므로 `medications`의 update/delete 정책 패턴은 여기 적용하지 않는다).
- 중복 동기화 방지는 `medication_logs`의 "23505를 성공으로 처리" 방식이 아니라 **`upsert(..., { onConflict, ignoreDuplicates: true })`**를 쓴다 — 여러 행을 한 번에 저장하는 배치 insert라, 중복 1건 때문에 에러가 나면 그 배치 전체(새 데이터 포함)가 통째로 버려지는 문제가 있어서다.
- `android-shell/`은 `ml-service/`와 같은 위치의 독립 서브시스템으로 리포 루트에 둔다 — Next.js 빌드에는 전혀 연결되지 않는다.

---

## Task 1: Supabase 스키마 — `biometrics` 테이블

**Files:**
- Modify: `supabase/schema.sql` (파일 끝에 추가)

**Interfaces:**
- Produces: `public.biometrics` 테이블(`id, user_id, heart_rate, measured_at, created_at`, `unique(user_id, measured_at)`) — Task 2가 이 스키마에 의존한다.

- [ ] **Step 1: `supabase/schema.sql` 파일 끝에 다음 블록을 추가한다**

```sql

-- Added later: 갤럭시 워치 생체 데이터(심박수) — Health Connect에서 동기화해온 측정값.
-- 워치 측정값은 불변 기록이라 update/delete 정책은 두지 않는다.
create table if not exists public.biometrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  heart_rate integer not null check (heart_rate > 0 and heart_rate < 300),
  measured_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, measured_at)
);

create index if not exists biometrics_user_measured_idx
  on public.biometrics (user_id, measured_at desc);

alter table public.biometrics enable row level security;

create policy "select own biometrics"
  on public.biometrics for select
  using (auth.uid() = user_id);

create policy "insert own biometrics"
  on public.biometrics for insert
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Supabase 프로젝트의 SQL Editor에서 위 블록만 실행한다**

`supabase/schema.sql`은 마이그레이션 도구에 연결되어 있지 않다(파일 상단 주석 참고) — 대시보드 → SQL Editor에 붙여넣고 실행해야 실제 테이블이 생긴다.

- [ ] **Step 3: Table Editor에서 `biometrics` 테이블이 생성되고 RLS가 켜져 있는지 확인한다**

Supabase 대시보드 → Table Editor에서 `biometrics`가 보이고 옆에 RLS 자물쇠 아이콘이 활성화되어 있는지 확인.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add biometrics table for watch heart-rate sync"
```

---

## Task 2: `lib/biometrics.ts` — CRUD

**Files:**
- Create: `lib/biometrics.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (Task 1의 `biometrics` 테이블에 의존)
- Produces:
  - `type BiometricReading = { measuredAt: string; heartRate: number }`
  - `type BiometricRecord = BiometricReading & { id: string; createdAt: string }`
  - `saveBiometricReadings(readings: BiometricReading[]): Promise<void>`
  - `getRecentBiometrics(limit?: number): Promise<BiometricRecord[]>`
  - `getLatestMeasuredAt(): Promise<string | null>`
  이후 Task 3(분석 API 호출부), Task 4(`/biometrics` 페이지)가 이 함수/타입을 그대로 import해서 쓴다.

- [ ] **Step 1: `lib/biometrics.ts` 작성**

```typescript
import { createClient } from "@/lib/supabase/client";

export type BiometricReading = {
  measuredAt: string; // ISO 8601
  heartRate: number;
};

export type BiometricRecord = BiometricReading & {
  id: string;
  createdAt: string;
};

export async function saveBiometricReadings(
  readings: BiometricReading[]
): Promise<void> {
  if (readings.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.from("biometrics").upsert(
    readings.map((r) => ({
      heart_rate: r.heartRate,
      measured_at: r.measuredAt,
    })),
    { onConflict: "user_id,measured_at", ignoreDuplicates: true }
  );

  if (error) throw error;
}

export async function getRecentBiometrics(
  limit = 50
): Promise<BiometricRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("biometrics")
    .select("id,heart_rate,measured_at,created_at")
    .order("measured_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    heartRate: row.heart_rate,
    measuredAt: row.measured_at,
    createdAt: row.created_at,
  }));
}

export async function getLatestMeasuredAt(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("biometrics")
    .select("measured_at")
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.measured_at ?? null;
}
```

- [ ] **Step 2: 타입 체크 + 린트**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add lib/biometrics.ts
git commit -m "Add lib/biometrics.ts for Supabase-backed heart-rate storage"
```

---

## Task 3: Gemini 분석 — `lib/gemini.ts` + `/api/biometrics/analyze`

**Files:**
- Modify: `lib/gemini.ts` (파일 끝에 함수 추가)
- Create: `app/api/biometrics/analyze/route.ts`

**Interfaces:**
- Consumes: 없음(독립 실행 가능)
- Produces:
  - `getBiometricAnalysis(readings: { measuredAt: string; heartRate: number }[]): Promise<string>` — Task 4의 "분석하기" 버튼이 `/api/biometrics/analyze`를 통해 이 함수를 간접 호출한다.

- [ ] **Step 1: `lib/gemini.ts` 파일 끝에 다음 함수를 추가한다**

```typescript
export async function getBiometricAnalysis(
  readings: { measuredAt: string; heartRate: number }[]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const readingsText = readings
    .map((r) => `- ${r.measuredAt}: ${r.heartRate} bpm`)
    .join("\n");

  const prompt =
    "다음은 갤럭시 워치로 측정된 사용자의 최근 심박수 기록입니다.\n" +
    `${readingsText}\n\n` +
    "이 기록을 보고 평소와 다른 점이나 주의할 만한 패턴이 있는지 짧은 문장이나 " +
    "불릿 2~4개로 한국어로 정리해주세요. 이건 의학적 진단이 아니라 일반적인 참고 " +
    "정보이며, 심박수가 지속적으로 비정상적이거나 어지러움·가슴 통증 등 다른 증상이 " +
    "함께 있다면 반드시 병원에서 상담해야 한다는 점을 마지막에 한 줄로 덧붙이세요. " +
    "마크다운 코드펜스 없이 텍스트로만 응답하세요.";

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Gemini API 오류 (${res.status}):`, errorBody);
    throw new Error("AI가 분석하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("AI가 분석 결과를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  return reply.trim();
}
```

- [ ] **Step 2: `app/api/biometrics/analyze/route.ts` 작성**

```typescript
import { getBiometricAnalysis } from "@/lib/gemini";

type ReadingInput = { measuredAt: string; heartRate: number };

function isReadingInput(value: unknown): value is ReadingInput {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as ReadingInput).measuredAt === "string" &&
    typeof (value as ReadingInput).heartRate === "number"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const readings: ReadingInput[] = Array.isArray(body?.readings)
    ? body.readings.filter(isReadingInput)
    : [];

  if (readings.length === 0) {
    return Response.json({ error: "분석할 측정값이 없어요." }, { status: 400 });
  }

  try {
    const analysis = await getBiometricAnalysis(readings);
    return Response.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: 타입 체크 + 린트**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 4: 개발 서버로 수동 스모크 테스트**

```bash
npm run dev
```

다른 터미널에서:

```bash
curl -X POST http://localhost:3000/api/biometrics/analyze \
  -H "Content-Type: application/json" \
  -d '{"readings":[{"measuredAt":"2026-09-13T09:00:00Z","heartRate":72},{"measuredAt":"2026-09-13T10:00:00Z","heartRate":95}]}'
```

Expected: `{"analysis":"..."}` 형태의 JSON, 한국어 분석 텍스트 포함. `GEMINI_API_KEY`가 이미 `.env.local`에 설정돼 있어야 함(기존 기능들과 동일).

- [ ] **Step 5: Commit**

```bash
git add lib/gemini.ts app/api/biometrics/analyze/route.ts
git commit -m "Add Gemini heart-rate analysis endpoint"
```

---

## Task 4: `/biometrics` 페이지 + 메인 허브 진입점 + 네이티브 브리지 인터페이스

**Files:**
- Create: `lib/nativeHealthConnect.ts`
- Create: `app/biometrics/page.tsx`
- Modify: `app/main/page.tsx` (조건부 메뉴 카드 추가)
- Modify: `proxy.ts` (matcher에 `/biometrics` 추가)
- Modify: `package.json` (`@capacitor/core` 의존성 추가)

**Interfaces:**
- Consumes: `saveBiometricReadings`, `getRecentBiometrics`, `getLatestMeasuredAt` (Task 2), `/api/biometrics/analyze` (Task 3)
- Produces:
  - `HealthConnect` (default export of `lib/nativeHealthConnect.ts`) with methods `isAvailable()`, `requestPermissions()`, `readRecentHeartRate({ since })` — Task 6이 안드로이드 쪽에서 이 정확한 이름(`"HealthConnect"` 플러그인 이름, 메서드명)으로 구현한다. 이름이 어긋나면 브리지가 연결되지 않으니 Task 6에서 그대로 재사용할 것.

- [ ] **Step 1: `@capacitor/core` 설치**

```bash
npm install @capacitor/core
```

- [ ] **Step 2: `lib/nativeHealthConnect.ts` 작성**

```typescript
import { registerPlugin } from "@capacitor/core";

export type HeartRateSample = {
  measuredAt: string; // ISO 8601
  heartRate: number;
};

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentHeartRate(options: {
    since: string | null;
  }): Promise<{ samples: HeartRateSample[] }>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect");

export default HealthConnect;
```

- [ ] **Step 3: `proxy.ts`의 `config.matcher`에 `"/biometrics"` 추가**

`proxy.ts:47-55`의 배열에 `"/medications"` 다음 줄로 추가:

```typescript
    "/medications",
    "/medications/:path*",
    "/biometrics",
```

- [ ] **Step 4: `app/biometrics/page.tsx` 작성**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  saveBiometricReadings,
  getRecentBiometrics,
  getLatestMeasuredAt,
  type BiometricRecord,
} from "@/lib/biometrics";
import HealthConnect from "@/lib/nativeHealthConnect";

const HEALTH_CONNECT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

export default function BiometricsPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<BiometricRecord[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRecentBiometrics()
      .then(setReadings)
      .catch(() => setMessage("불러오지 못했어요."));
  }, []);

  async function handleSync() {
    setMessage("");
    if (Capacitor.getPlatform() !== "android") {
      setMessage("안드로이드 앱에서만 동기화할 수 있어요.");
      return;
    }

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
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-1 px-3 pb-4"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
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
        <h1 className="text-xl font-bold tracking-tight text-ink">워치 데이터</h1>
      </header>

      <div
        className="flex flex-1 flex-col overflow-y-auto px-5 pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleSync}
          disabled={syncing}
          className="mb-4 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98] disabled:opacity-60"
        >
          {syncing ? "동기화 중…" : "Samsung Health에서 동기화"}
        </button>

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
    </main>
  );
}
```

- [ ] **Step 5: `app/main/page.tsx`에 조건부 메뉴 카드 추가**

`app/main/page.tsx:1-9`의 import 블록에 추가:

```typescript
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
```

컴포넌트 최상단(`const [displayName, setDisplayName] = useState("");` 다음 줄)에 상태 추가:

```typescript
  const [isAndroidShell, setIsAndroidShell] = useState(false);
```

첫 번째 `useEffect` 안(닉네임 조회하는 곳) 맨 앞에 추가:

```typescript
  useEffect(() => {
    setIsAndroidShell(Capacitor.getPlatform() === "android");
  }, []);
```

`app/main/page.tsx:206-231`의 "복용/복약 관리하기" `MenuCard` 다음에 추가:

```tsx
            {isAndroidShell && (
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
            )}
```

- [ ] **Step 6: 타입 체크 + 린트**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 7: 개발 서버로 수동 스모크 테스트**

```bash
npm run dev
```

브라우저(플랫폼이 `"web"`이라 카드는 안 보이는 게 정상)에서 `/main`에 "워치 데이터 확인하기" 카드가 **없는지** 확인. 그 다음 주소창에 직접 `http://localhost:3000/biometrics`를 입력해 들어가서:
- 빈 상태 문구("아직 측정된 심박수가 없어요…")가 보이는지
- "Samsung Health에서 동기화" 버튼을 누르면 "안드로이드 앱에서만 동기화할 수 있어요." 메시지가 뜨는지

확인. (진짜 Health Connect 연동 확인은 Task 6 이후 실기기에서 한다.)

- [ ] **Step 8: Commit**

```bash
git add lib/nativeHealthConnect.ts app/biometrics/page.tsx app/main/page.tsx proxy.ts package.json package-lock.json
git commit -m "Add /biometrics page and conditional main-hub entry point"
```

---

## Task 5: Capacitor Android 셸 프로젝트 스캐폴딩

**Files:**
- Create: `android-shell/package.json`
- Create: `android-shell/capacitor.config.ts`
- Create: `android-shell/www/index.html`
- Create: `android-shell/android/` (Capacitor CLI가 생성)

**Interfaces:**
- Produces: 배포된 프로덕션 사이트를 로드하는 실행 가능한 안드로이드 앱 셸 — Task 6이 여기에 네이티브 플러그인을 추가한다.

- [ ] **Step 1: 디렉터리 생성 및 Capacitor 설치**

```bash
mkdir android-shell
cd android-shell
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
cd ..
```

- [ ] **Step 2: `android-shell/capacitor.config.ts` 작성**

```typescript
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.healthmate.shell",
  appName: "HealthMate",
  webDir: "www",
  server: {
    // 로컬 빌드 산출물을 배포하지 않고 배포된 프로덕션 사이트를 그대로 로드한다.
    // 도메인이 바뀌면 이 값만 갱신하면 된다.
    url: "https://ai-chat-black-nine.vercel.app",
    cleartext: false,
  },
};

export default config;
```

- [ ] **Step 3: 최소 placeholder `www/index.html` 생성**

`server.url`이 설정되면 실행 시 이 파일 내용은 로드되지 않지만, `npx cap add android`가 `webDir`이 존재해야 동작하므로 최소 파일이 필요하다.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>HealthMate</title>
  </head>
  <body></body>
</html>
```

(경로: `android-shell/www/index.html`)

- [ ] **Step 4: 안드로이드 프로젝트 생성**

```bash
cd android-shell
npx cap add android
cd ..
```

- [ ] **Step 5: `android-shell/android/app/src/main/AndroidManifest.xml`에 Health Connect 설치 확인용 `<queries>` 추가**

`<manifest>` 태그 바로 안, `<application>` 태그 앞에 추가:

```xml
    <queries>
        <package android:name="com.google.android.apps.healthdata" />
    </queries>
```

- [ ] **Step 6: 실기기에서 빌드·실행**

```bash
cd android-shell
npx cap open android
```

Android Studio가 열리면 보유한 안드로이드 폰을 USB 디버깅으로 연결한 뒤 Run. 확인 사항:
- 로그인 화면(`HealthMate`)이 뜨는지
- 기존 계정으로 로그인하면 `/main`으로 이동하는지
- (아직 Task 4의 조건부 카드가 보여야 함 — `Capacitor.getPlatform()`이 `"android"`를 반환하므로 "워치 데이터 확인하기" 카드가 이제 보여야 한다)

- [ ] **Step 7: `.gitignore` 확인 후 Commit**

`npx cap add android`가 생성한 `android-shell/android/.gitignore`에 `build/`, `.gradle/`, `local.properties`, `*.iml` 등이 포함돼 있는지 확인(빠져 있으면 추가). 그다음:

```bash
git add android-shell
git commit -m "Scaffold Capacitor Android shell loading the deployed web app"
```

---

## Task 6: `HealthConnectPlugin` 네이티브 구현

**Files:**
- Modify: `android-shell/android/app/build.gradle` (의존성 추가)
- Modify: `android-shell/android/app/src/main/AndroidManifest.xml` (권한 추가)
- Create: `android-shell/android/app/src/main/java/com/healthmate/shell/HealthConnectPlugin.kt`
- Modify: `android-shell/android/app/src/main/java/com/healthmate/shell/MainActivity.kt`

**Interfaces:**
- Consumes: Task 4가 정의한 JS 쪽 인터페이스(`registerPlugin<HealthConnectPlugin>("HealthConnect")`, 메서드 `isAvailable`/`requestPermissions`/`readRecentHeartRate`) — 여기서 그 정확한 이름들을 네이티브로 구현해 브리지를 연결한다.
- Produces: 실제로 Health Connect에서 심박수를 읽어 JS로 넘겨주는 동작.

- [ ] **Step 1: `AndroidManifest.xml`에 권한 추가**

`<queries>` 블록 위나 아래, `<manifest>` 태그 바로 안에 추가:

```xml
    <uses-permission android:name="android.permission.health.READ_HEART_RATE" />
```

- [ ] **Step 2: `android-shell/android/app/build.gradle`의 `dependencies` 블록에 추가**

```gradle
    implementation "androidx.health.connect:connect-client:1.2.0-alpha06"
    implementation "androidx.lifecycle:lifecycle-runtime-ktx:2.8.7"
```

(Android Studio가 더 최신 stable 버전을 제안하면 그걸 써도 된다 — Health Connect 라이브러리가 아직 alpha라 버전이 자주 바뀐다.)

- [ ] **Step 3: `HealthConnectPlugin.kt` 작성**

경로: `android-shell/android/app/src/main/java/com/healthmate/shell/HealthConnectPlugin.kt` (패키지명이 다르면 실제 `applicationId`/기존 `MainActivity.kt`의 `package` 선언에 맞춘다.)

```kotlin
package com.healthmate.shell

import androidx.activity.result.contract.ActivityResultContract
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.launch
import java.time.Instant

private val READ_HEART_RATE = HealthPermission.getReadPermission(HeartRateRecord::class)

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {
    private lateinit var permissionLauncher: androidx.activity.result.ActivityResultLauncher<Set<String>>
    private var pendingPermissionCall: PluginCall? = null

    override fun load() {
        val contract: ActivityResultContract<Set<String>, Set<String>> =
            PermissionController.createRequestPermissionResultContract()

        permissionLauncher = activity.activityResultRegistry.register(
            "healthConnectPermissionRequest",
            contract
        ) { granted ->
            val call = pendingPermissionCall
            pendingPermissionCall = null
            val ret = JSObject()
            ret.put("granted", granted.contains(READ_HEART_RATE))
            call?.resolve(ret)
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val status = HealthConnectClient.getSdkStatus(context)
        val ret = JSObject()
        ret.put("available", status == HealthConnectClient.SDK_AVAILABLE)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestPermissions(call: PluginCall) {
        pendingPermissionCall = call
        permissionLauncher.launch(setOf(READ_HEART_RATE))
    }

    @PluginMethod
    fun readRecentHeartRate(call: PluginCall) {
        val sinceStr = call.getString("since")
        val startTime =
            if (sinceStr != null) Instant.parse(sinceStr)
            else Instant.now().minusSeconds(7 * 24 * 3600)
        val endTime = Instant.now()

        activity.lifecycleScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.contains(READ_HEART_RATE)) {
                    call.reject("Health Connect 권한이 없어요.")
                    return@launch
                }

                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = HeartRateRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                    )
                )

                val samples = JSArray()
                for (record in response.records) {
                    for (sample in record.samples) {
                        val item = JSObject()
                        item.put("measuredAt", sample.time.toString())
                        item.put("heartRate", sample.beatsPerMinute)
                        samples.put(item)
                    }
                }

                val ret = JSObject()
                ret.put("samples", samples)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Health Connect에서 데이터를 읽지 못했어요: ${e.message}")
            }
        }
    }
}
```

- [ ] **Step 4: `MainActivity.kt`에서 플러그인 등록**

기존 `android-shell/android/app/src/main/java/com/healthmate/shell/MainActivity.kt`를 다음과 같이 수정(패키지 선언은 기존 파일 것을 유지):

```kotlin
package com.healthmate.shell

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(HealthConnectPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

- [ ] **Step 5: 빌드하고 실기기에서 확인**

Android Studio에서 Run. 폰에 Health Connect 앱이 없다면 먼저 Play 스토어에서 설치하고, Samsung Health에서 워치 데이터 동기화 + Health Connect 권한 공유를 켜둔 상태로 준비한다.

`/biometrics` 페이지에서:
- "Samsung Health에서 동기화" 탭 → OS 표준 Health Connect 권한 다이얼로그가 뜨는지
- 권한을 허용하면 워치로 측정한 심박수가 목록에 나타나는지
- 아직 측정 데이터가 없으면 "아직 Samsung Health에 새로 동기화된 측정값이 없어요." 메시지가 뜨는지 (크래시 없이)

컴파일 에러가 나면(Health Connect 라이브러리가 alpha라 버전별로 API 시그니처가 조금씩 다를 수 있음) Android Studio가 제안하는 정확한 import/메서드명으로 맞춰 수정한다.

- [ ] **Step 6: Commit**

```bash
git add android-shell
git commit -m "Implement native HealthConnectPlugin for heart-rate sync"
```

---

## Task 7: 실기기 회귀 테스트 (기존 웹 기능이 WebView 셸 안에서도 동작하는지)

**Files:** 없음(문제 발견 시에만 해당 파일 수정 — 이 태스크 범위 밖의 후속 작업으로 분리)

**Interfaces:** 없음 — 이 태스크는 검증만 한다.

- [ ] **Step 1: Android Studio에서 실행 중인 앱으로 아래 항목을 순서대로 수동 확인**

- 로그인 → `/main` 진입, "워치 데이터 확인하기" 카드가 보이는지
- 채팅 시작하기: 메시지 주고받기 정상 동작
- 증상 체크하기: 5단계 마법사 진행, 사진 첨부 단계에서 카메라가 정상적으로 열리고 촬영한 사진이 첨부되는지
- 병원찾기: 증상체크 결과에서 진료과 칩을 눌러 위치 권한 프롬프트가 뜨고, 허용 시 Kakao 지도에 마커가 뜨는지
- 복용/복약 관리하기 → 약 추가하기: 처방전 사진 촬영 → Gemini가 약 이름을 추출하는지
- 설정: 닉네임 변경이 저장되는지
- 워치 데이터: Task 6에서 확인한 동기화 + "AI 분석하기" 버튼으로 분석 결과가 뜨는지

- [ ] **Step 2: 발견된 문제를 기록**

문제가 없으면 이 태스크로 계획 완료. 카메라/위치/Kakao 지도 중 하나라도 WebView 안에서 브라우저와 다르게 동작하면(예: 카메라가 안 열림), 어떤 기능이 어떻게 실패하는지 정확히 적어두고 — 스펙의 "범위 및 리스크"에서 예고한 대로 해당 기능만 `@capacitor/camera`/`@capacitor/geolocation` 같은 전용 플러그인으로 교체하는 별도 후속 계획(브레인스토밍부터 다시)으로 분리한다. 이 플랜 범위에서 억지로 고치지 않는다.
