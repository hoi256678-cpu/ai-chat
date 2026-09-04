# 복용 알림(투약 스케줄) 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처방전/진단서 사진(또는 직접 입력)으로 약을 등록하고, 복용 시간대·종료일을 설정하면 앱을 열었을 때 오늘 먹어야 할 약을 보여주고 체크·기록할 수 있게 한다.

**Architecture:** 기존 `symptom_checks`/`events` 테이블과 동일한 RLS 직접호출 패턴으로 Supabase에 `medications`/`medication_logs` 테이블을 추가한다. 사진에서 약 이름을 읽는 것만 `lib/gemini.ts`를 통해 Gemini를 직접 호출(이 브랜치 기본 라우팅인 로컬 Ollama는 비전 불가)하고, 나머지는 기존 Next.js App Router 페이지/API 라우트 패턴을 그대로 따른다.

**Tech Stack:** Next.js App Router (canary), React 19, TypeScript, Tailwind v4, Supabase(Postgres+RLS), Gemini REST API(`generateContent` 멀티모달).

**Spec:** `docs/superpowers/specs/2026-09-04-medication-reminder-design.md`

## Global Constraints

- 사진에서 약 이름을 추출하는 경로는 `lib/ai.ts` 라우터를 거치지 않고 항상 `lib/gemini.ts`를 직접 호출한다 (로컬 Ollama는 비전 불가).
- 테스트 러너가 구성되어 있지 않다(`CLAUDE.md` 명시) — 각 태스크는 `npx tsc --noEmit` + `npm run lint` + 수동 스모크 테스트로 검증한다.
- Supabase 테이블은 RLS로 본인 소유 행만 select/insert 가능하게 하고, `medications`만 delete도 허용한다(`medication_logs`는 체크 취소 기능이 없으므로 delete 정책 불필요).
- 사진 첨부는 기존 `app/symptom-check/page.tsx`의 `accept="image/*" capture="environment"` + `FileReader` + 4MB 용량 제한 컨벤션을 그대로 재사용한다.
- 브라우저/앱이 닫혀 있을 때 오는 푸시 알림은 만들지 않는다 — 앱을 열었을 때만 확인 가능하면 된다.
- 등록된 약의 시간대/종료일을 나중에 수정하는 기능은 만들지 않는다 — 삭제 후 재등록으로 대체한다.
- 메인 허브(`/main`)에 이 기능의 요약 카드를 넣는 작업은 이 플랜의 범위 밖이다(별도 후속 작업).

---

## Task 1: Supabase 스키마 — `medications` / `medication_logs` 테이블

**Files:**
- Modify: `supabase/schema.sql` (파일 끝에 추가)

**Interfaces:**
- Produces: `public.medications` 테이블(`id, user_id, name, times text[], start_date, end_date, photo, created_at`), `public.medication_logs` 테이블(`id, user_id, medication_id, date_key, time, taken_at`, `unique(medication_id, date_key, time)`) — 이후 모든 태스크가 이 스키마에 의존한다.

- [ ] **Step 1: `supabase/schema.sql` 파일 끝에 다음 블록을 추가한다**

```sql

-- Added later: 복용 알림(투약 스케줄) — 등록된 약과 복용 시간대, 종료일.
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  times text[] not null,        -- 예: ['08:00','13:00','19:00'], HH:MM 24시간제
  start_date text not null,     -- "YYYY-MM-DD"
  end_date text not null,       -- "YYYY-MM-DD"
  photo text,                   -- 처방전 사진 base64 데이터 URL, 선택
  created_at timestamptz not null default now()
);

create index if not exists medications_user_end_date_idx
  on public.medications (user_id, end_date);

alter table public.medications enable row level security;

create policy "select own medications"
  on public.medications for select
  using (auth.uid() = user_id);

create policy "insert own medications"
  on public.medications for insert
  with check (auth.uid() = user_id);

create policy "delete own medications"
  on public.medications for delete
  using (auth.uid() = user_id);

-- Added later: 복용 체크 기록 — 어느 약의 어느 날짜/시간대를 먹었다고 표시했는지.
create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  date_key text not null,
  time text not null,
  taken_at timestamptz not null default now(),
  unique (medication_id, date_key, time)
);

create index if not exists medication_logs_user_medication_date_idx
  on public.medication_logs (user_id, medication_id, date_key);

alter table public.medication_logs enable row level security;

create policy "select own medication logs"
  on public.medication_logs for select
  using (auth.uid() = user_id);

create policy "insert own medication logs"
  on public.medication_logs for insert
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Supabase 프로젝트의 SQL Editor에서 위에서 추가한 블록만 실행한다**

`supabase/schema.sql`은 마이그레이션 도구에 연결되어 있지 않다(파일 상단 주석 참고) — 프로젝트의 Supabase 대시보드 → SQL Editor에 새 블록을 붙여넣고 실행해야 실제 테이블이 생긴다. 이 스텝을 건너뛰면 이후 모든 태스크의 수동 테스트가 `relation "medications" does not exist` 에러로 실패한다.

- [ ] **Step 3: Table Editor에서 두 테이블이 생성되고 RLS가 켜져 있는지 확인한다**

Supabase 대시보드 → Table Editor에서 `medications`, `medication_logs`가 보이고, 각각 옆에 RLS 자물쇠 아이콘이 활성화되어 있는지 확인.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add medications and medication_logs tables"
```

---

## Task 2: `lib/medications.ts` — CRUD

**Files:**
- Create: `lib/medications.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client` (기존 `lib/symptomHistory.ts`와 동일하게 사용)
- Produces:
  - `type MedicationInput = { name: string; times: string[]; startDate: string; endDate: string; photo?: string | null }`
  - `type MedicationRecord = MedicationInput & { id: string; createdAt: string }`
  - `type MedicationLogRecord = { id: string; medicationId: string; dateKey: string; time: string; takenAt: string }`
  - `saveMedication(input: MedicationInput): Promise<void>`
  - `getMedications(): Promise<MedicationRecord[]>`
  - `deleteMedication(id: string): Promise<void>`
  - `logDose(medicationId: string, dateKey: string, time: string): Promise<void>`
  - `getDoseLogs(dateKey: string): Promise<MedicationLogRecord[]>`
  이후 Task 5, 6이 이 함수/타입들을 그대로 import해서 쓴다.

- [ ] **Step 1: `lib/medications.ts` 작성**

```typescript
import { createClient } from "@/lib/supabase/client";

export type MedicationInput = {
  name: string;
  times: string[];
  startDate: string;
  endDate: string;
  photo?: string | null;
};

export type MedicationRecord = MedicationInput & {
  id: string;
  createdAt: string;
};

export type MedicationLogRecord = {
  id: string;
  medicationId: string;
  dateKey: string;
  time: string;
  takenAt: string;
};

export async function saveMedication(input: MedicationInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medications").insert({
    name: input.name,
    times: input.times,
    start_date: input.startDate,
    end_date: input.endDate,
    photo: input.photo ?? null,
  });

  if (error) throw error;
}

export async function getMedications(): Promise<MedicationRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("id,name,times,start_date,end_date,photo,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    times: row.times,
    startDate: row.start_date,
    endDate: row.end_date,
    photo: row.photo ?? null,
    createdAt: row.created_at,
  }));
}

export async function deleteMedication(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medications").delete().eq("id", id);

  if (error) throw error;
}

export async function logDose(
  medicationId: string,
  dateKey: string,
  time: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medication_logs").insert({
    medication_id: medicationId,
    date_key: dateKey,
    time,
  });

  // 23505 = unique_violation — 이미 체크된 슬롯을 다시 누른 것뿐이므로 성공 처리
  if (error && error.code !== "23505") throw error;
}

export async function getDoseLogs(dateKey: string): Promise<MedicationLogRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_logs")
    .select("id,medication_id,date_key,time,taken_at")
    .eq("date_key", dateKey);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    medicationId: row.medication_id,
    dateKey: row.date_key,
    time: row.time,
    takenAt: row.taken_at,
  }));
}
```

- [ ] **Step 2: 타입체크로 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (이 저장소는 테스트 러너가 없으므로 이게 이 태스크의 검증 수단이다).

- [ ] **Step 3: Commit**

```bash
git add lib/medications.ts
git commit -m "Add lib/medications.ts CRUD functions"
```

---

## Task 3: `lib/gemini.ts` — 사진에서 약 이름 추출

**Files:**
- Modify: `lib/gemini.ts` (파일 끝에 함수 추가)

**Interfaces:**
- Consumes: 파일 상단에 이미 정의된 `GEMINI_MODEL` 상수
- Produces: `extractMedicineNames(photoDataUrl: string): Promise<string[]>` — Task 4의 API 라우트가 이 함수를 import해서 쓴다.

- [ ] **Step 1: `lib/gemini.ts` 파일 끝에 다음 함수를 추가한다**

```typescript
export async function extractMedicineNames(photoDataUrl: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("사진 형식을 읽을 수 없어요.");
  }
  const [, mimeType, base64Data] = match;

  const prompt =
    "이 사진은 처방전 또는 진단서예요. 사진에서 보이는 약 이름만 정확히 추출해서 " +
    'JSON 배열로만 응답하세요. 예: ["타이레놀정500mg", "지르텍정"]. ' +
    "약 이름을 하나도 찾을 수 없으면 빈 배열 []을 응답하세요. " +
    "다른 설명이나 마크다운 코드펜스 없이 JSON 배열만 응답하세요.";

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      },
    ],
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
    throw new Error("AI가 사진을 분석하지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof reply !== "string") return [];

  const cleaned = reply
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: 타입체크 + lint로 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 에러 없음.

- [ ] **Step 3: Commit**

```bash
git add lib/gemini.ts
git commit -m "Add extractMedicineNames to lib/gemini.ts"
```

---

## Task 4: `app/api/medications/extract` API 라우트

**Files:**
- Create: `app/api/medications/extract/route.ts`

**Interfaces:**
- Consumes: `extractMedicineNames` from `@/lib/gemini` (Task 3)
- Produces: `POST /api/medications/extract` — 요청 바디 `{ photo: string }` (data URL), 응답 `{ names: string[] }` 또는 `{ error: string }`(4xx/5xx). Task 6(add 페이지)이 `fetch`로 이 라우트를 호출한다.

- [ ] **Step 1: `app/api/medications/extract/route.ts` 작성**

```typescript
import { extractMedicineNames } from "@/lib/gemini";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const photo: string | undefined =
    typeof body?.photo === "string" && body.photo.startsWith("data:image/")
      ? body.photo
      : undefined;

  if (!photo) {
    return Response.json({ error: "사진이 필요해요." }, { status: 400 });
  }

  try {
    const names = await extractMedicineNames(photo);
    return Response.json({ names });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: 개발 서버를 띄우고 curl로 스모크 테스트**

Run: `npm run dev` (백그라운드로 띄운 상태에서, 새 터미널에서 아래 실행)

```bash
curl -s -X POST http://localhost:3000/api/medications/extract \
  -H "Content-Type: application/json" \
  -d '{"photo":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}'
```

Expected: HTTP 200에 `{"names":[...]}` 형태의 JSON (1x1 투명 픽셀이라 빈 배열이거나 의미 없는 값이 나올 수 있음 — 여기서 확인할 건 500 에러 없이 정상적으로 응답이 오는지, `GEMINI_API_KEY`가 잘 읽히는지다). `photo` 없이 보내면 `{"error":"사진이 필요해요."}` + 400인지도 확인:

```bash
curl -s -X POST http://localhost:3000/api/medications/extract -H "Content-Type: application/json" -d '{}'
```

- [ ] **Step 3: Commit**

```bash
git add app/api/medications/extract/route.ts
git commit -m "Add /api/medications/extract route"
```

---

## Task 5: `/medications` — 목록 + 오늘의 체크리스트

**Files:**
- Create: `app/medications/page.tsx`

**Interfaces:**
- Consumes: `getMedications`, `deleteMedication`, `logDose`, `getDoseLogs`, `type MedicationRecord`, `type MedicationLogRecord` from `@/lib/medications` (Task 2); `formatDateKey` from `@/lib/chatHistory`
- Produces: `/medications` 페이지, 헤더의 "+ 약 추가" 버튼이 `/medications/add`로 이동(Task 6에서 만들 페이지) — 지금은 그 경로가 아직 없어서 이동하면 404가 뜨는 게 정상이다(Task 6에서 해결됨).

- [ ] **Step 1: `app/medications/page.tsx` 작성**

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateKey } from "@/lib/chatHistory";
import {
  getMedications,
  getDoseLogs,
  deleteMedication,
  logDose,
  type MedicationRecord,
  type MedicationLogRecord,
} from "@/lib/medications";

const today = formatDateKey(new Date());

type Slot = {
  medicationId: string;
  name: string;
  time: string;
  taken: boolean;
};

function dDay(endDate: string): string {
  const diffDays = Math.round(
    (new Date(endDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "종료됨";
  if (diffDays === 0) return "오늘까지";
  return `D-${diffDays}`;
}

export default function MedicationsPage() {
  const router = useRouter();
  const [medications, setMedications] = useState<MedicationRecord[] | null>(null);
  const [logs, setLogs] = useState<MedicationLogRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getMedications(), getDoseLogs(today)])
      .then(([meds, todayLogs]) => {
        setMedications(meds);
        setLogs(todayLogs);
      })
      .catch(() => setError("불러오지 못했어요."));
  }, []);

  async function handleCheck(medicationId: string, time: string) {
    const optimisticId = `optimistic-${medicationId}-${time}`;
    setLogs((prev) => [
      ...prev,
      {
        id: optimisticId,
        medicationId,
        dateKey: today,
        time,
        takenAt: new Date().toISOString(),
      },
    ]);
    try {
      await logDose(medicationId, today, time);
    } catch {
      setLogs((prev) => prev.filter((log) => log.id !== optimisticId));
      setError("체크에 실패했어요. 다시 시도해주세요.");
    }
  }

  async function handleDelete(id: string) {
    setMedications((prev) => (prev ?? []).filter((m) => m.id !== id));
    try {
      await deleteMedication(id);
    } catch {
      setError("삭제에 실패했어요. 새로고침 후 다시 시도해주세요.");
    }
  }

  const activeMedications = (medications ?? []).filter(
    (m) => m.startDate <= today && today <= m.endDate
  );

  const nowHHMM = new Date().toTimeString().slice(0, 5);

  const slots: Slot[] = activeMedications
    .flatMap((m) =>
      m.times.map((time) => ({
        medicationId: m.id,
        name: m.name,
        time,
        taken: logs.some((l) => l.medicationId === m.id && l.time === time),
      }))
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center justify-between px-3 pb-4 pr-3"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1">
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
          <h1 className="text-xl font-bold tracking-tight text-ink">복용 알림</h1>
        </div>
        <button
          onClick={() => router.push("/medications/add")}
          className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98]"
        >
          + 약 추가
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {error && (
          <p className="mb-4 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {medications === null && (
          <p className="pt-10 text-center text-sm text-sub">불러오는 중…</p>
        )}

        {medications !== null && medications.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm text-sub">아직 등록된 약이 없어요.</p>
            <button
              onClick={() => router.push("/medications/add")}
              className="mt-3 text-sm font-medium text-accent"
            >
              + 약 추가하기
            </button>
          </div>
        )}

        {medications !== null && medications.length > 0 && (
          <>
            {slots.length > 0 && (
              <section className="mt-2">
                <h2 className="mb-2 text-xs font-semibold text-sub">오늘</h2>
                <div className="flex flex-col gap-2">
                  {slots.map((slot) => {
                    const due = !slot.taken && slot.time <= nowHHMM;
                    return (
                      <button
                        key={`${slot.medicationId}-${slot.time}`}
                        onClick={() =>
                          !slot.taken && handleCheck(slot.medicationId, slot.time)
                        }
                        disabled={slot.taken}
                        className={
                          slot.taken
                            ? "flex w-full items-center justify-between rounded-2xl border border-line bg-tint px-4 py-3 text-left opacity-60"
                            : due
                              ? "flex w-full items-center justify-between rounded-2xl border-2 border-danger bg-danger-tint px-4 py-3 text-left transition active:scale-[0.98]"
                              : "flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left transition hover:border-accent/40 active:scale-[0.98]"
                        }
                      >
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {slot.name}
                          </span>
                          <span className="block text-xs text-sub">{slot.time}</span>
                        </span>
                        <span className="text-sm font-medium text-ink">
                          {slot.taken ? "✓ 완료" : due ? "먹었어요" : "예정"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="mb-2 text-xs font-semibold text-sub">등록된 약</h2>
              <div className="flex flex-col gap-2">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{med.name}</p>
                      <p className="text-xs text-sub">
                        {med.times.join(", ")} · {dDay(med.endDate)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(med.id)}
                      aria-label={`${med.name} 삭제`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-tint hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 타입체크 + lint로 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 에러 없음.

- [ ] **Step 3: 브라우저로 빈 상태 확인**

`npm run dev` 실행 중인 상태로 로그인 후 `http://localhost:3000/medications` 접속 → "아직 등록된 약이 없어요." 안내 카드가 보이는지, 콘솔에 에러가 없는지 확인.

- [ ] **Step 4: Commit**

```bash
git add app/medications/page.tsx
git commit -m "Add /medications list + today checklist page"
```

---

## Task 6: `/medications/add` — 약 추가 폼

**Files:**
- Create: `app/medications/add/page.tsx`

**Interfaces:**
- Consumes: `saveMedication` from `@/lib/medications` (Task 2), `formatDateKey` from `@/lib/chatHistory`, `POST /api/medications/extract` (Task 4)
- Produces: `/medications/add` 페이지 — 저장 성공 시 `/medications`로 이동(Task 5에서 만든 페이지에 반영되어 보여야 함).

- [ ] **Step 1: `app/medications/add/page.tsx` 작성**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateKey } from "@/lib/chatHistory";
import { saveMedication } from "@/lib/medications";

const today = formatDateKey(new Date());

const PRESETS = [
  { label: "아침", time: "08:00" },
  { label: "점심", time: "13:00" },
  { label: "저녁", time: "19:00" },
];

type PendingMed = {
  key: string;
  name: string;
  times: string[];
  endDate: string;
};

function createPending(name: string): PendingMed {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    times: [],
    endDate: "",
  };
}

export default function AddMedicationPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [manualName, setManualName] = useState("");
  const [pending, setPending] = useState<PendingMed[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("사진 용량이 너무 커요. 4MB 이하 사진을 선택해주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleExtract() {
    if (!photo) return;
    setExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/medications/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "약 이름을 찾지 못했어요.");
      setCandidates(data.names ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "약 이름을 찾지 못했어요.");
    } finally {
      setExtracting(false);
    }
  }

  function toggleName(name: string) {
    setPending((prev) => {
      const exists = prev.some((p) => p.name === name);
      if (exists) return prev.filter((p) => p.name !== name);
      return [...prev, createPending(name)];
    });
  }

  function addManualName() {
    const trimmed = manualName.trim();
    if (!trimmed) return;
    if (!pending.some((p) => p.name === trimmed)) {
      setPending((prev) => [...prev, createPending(trimmed)]);
    }
    setManualName("");
  }

  function updateName(key: string, name: string) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, name } : p)));
  }

  function toggleTime(key: string, time: string) {
    setPending((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const times = p.times.includes(time)
          ? p.times.filter((t) => t !== time)
          : [...p.times, time].sort();
        return { ...p, times };
      })
    );
  }

  function setEndDate(key: string, endDate: string) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, endDate } : p)));
  }

  function removePending(key: string) {
    setPending((prev) => prev.filter((p) => p.key !== key));
  }

  async function handleSave() {
    setError("");
    if (pending.length === 0) {
      setError("등록할 약을 추가해주세요.");
      return;
    }
    const invalid = pending.some(
      (p) => !p.name.trim() || p.times.length === 0 || !p.endDate
    );
    if (invalid) {
      setError("모든 약에 이름, 복용 시간대, 종료일을 입력해주세요.");
      return;
    }

    setSaving(true);
    const failed: PendingMed[] = [];
    for (const med of pending) {
      try {
        await saveMedication({
          name: med.name.trim(),
          times: med.times,
          startDate: today,
          endDate: med.endDate,
          photo: photo ?? null,
        });
      } catch {
        failed.push(med);
      }
    }
    setSaving(false);

    if (failed.length === 0) {
      router.push("/medications");
      return;
    }
    setPending(failed);
    setError(`${failed.length}개 저장에 실패했어요. 다시 시도해주세요.`);
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-1 px-2 py-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/medications")}
          aria-label="복용 알림으로 돌아가기"
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
        <span className="px-1 font-semibold text-ink">약 추가</span>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <section>
          <h2 className="mb-2 text-xs font-semibold text-sub">
            처방전/진단서 사진 (선택)
          </h2>
          {!photo ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-3.5 text-sm font-medium text-sub transition hover:border-accent/40">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              사진 첨부
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 data URL 미리보기 */}
              <img
                src={photo}
                alt="첨부한 처방전 사진"
                className="h-40 w-full rounded-2xl object-cover"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
                >
                  {extracting ? "분석 중…" : "AI로 약 이름 찾기"}
                </button>
                <button
                  onClick={() => {
                    setPhoto(null);
                    setCandidates([]);
                  }}
                  className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-tint"
                >
                  사진 지우기
                </button>
              </div>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {candidates.map((name) => {
                const selected = pending.some((p) => p.name === name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleName(name)}
                    className={
                      selected
                        ? "rounded-full border-2 border-accent bg-tint px-3 py-1.5 text-xs font-semibold text-ink"
                        : "rounded-full border-2 border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/40"
                    }
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold text-sub">약 이름 직접 추가</h2>
          <div className="flex gap-2">
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addManualName();
                }
              }}
              placeholder="예: 타이레놀정500mg"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sub/60 focus:border-accent"
            />
            <button
              onClick={addManualName}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-tint"
            >
              추가
            </button>
          </div>
        </section>

        {pending.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-semibold text-sub">등록 예정 목록</h2>
            <div className="flex flex-col gap-3">
              {pending.map((med) => (
                <div
                  key={med.key}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={med.name}
                      onChange={(event) => updateName(med.key, event.target.value)}
                      className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => removePending(med.key)}
                      aria-label={`${med.name} 제거`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-tint"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.time}
                        onClick={() => toggleTime(med.key, preset.time)}
                        className={
                          med.times.includes(preset.time)
                            ? "rounded-full border-2 border-accent bg-tint px-3 py-1.5 text-xs font-semibold text-ink"
                            : "rounded-full border-2 border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/40"
                        }
                      >
                        {preset.label} {preset.time}
                      </button>
                    ))}
                  </div>

                  {med.times.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {med.times.map((time) => (
                        <label
                          key={time}
                          className="flex items-center gap-1.5 text-xs text-sub"
                        >
                          시간
                          <input
                            type="time"
                            value={time}
                            onChange={(event) => {
                              const newTime = event.target.value;
                              setPending((prev) =>
                                prev.map((p) =>
                                  p.key === med.key
                                    ? {
                                        ...p,
                                        times: p.times
                                          .map((t) => (t === time ? newTime : t))
                                          .sort(),
                                      }
                                    : p
                                )
                              );
                            }}
                            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  <label className="mt-3 flex flex-col gap-1 text-left">
                    <span className="text-xs font-medium text-sub">종료일</span>
                    <input
                      type="date"
                      min={today}
                      value={med.endDate}
                      onChange={(event) => setEndDate(med.key, event.target.value)}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {error && (
          <p className="mt-4 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(47,135,224,0.65)] transition hover:bg-accent-deep active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "저장 중…" : "저장하기"}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 타입체크 + lint로 확인**

Run: `npx tsc --noEmit && npm run lint`
Expected: 둘 다 에러 없음.

- [ ] **Step 3: 브라우저로 전체 흐름 수동 스모크 테스트**

`npm run dev` 실행 중인 상태로 로그인 후:

1. `/medications` → "+ 약 추가" → `/medications/add`로 이동하는지
2. 사진 없이 "약 이름 직접 추가"에 "테스트약" 입력 후 추가 → 등록 예정 목록에 카드가 생기는지
3. 시간대 프리셋(아침/점심/저녁) 중 하나 이상 체크, 종료일 입력
4. 아무것도 입력하지 않고 "저장하기" 눌러서 유효성 에러 메시지가 뜨는지 확인, 그다음 값 채우고 다시 저장
5. "저장하기" → `/medications`로 이동하고, "등록된 약" 목록에 "테스트약"이 보이는지
6. "오늘" 섹션에 방금 등록한 시간대가 나타나는지 (시간대를 현재 시각 이전으로 설정했다면 강조 표시로 보여야 함)
7. 해당 슬롯을 눌러 "먹었어요" → "✓ 완료"로 바뀌는지, 새로고침(F5) 후에도 완료 상태가 유지되는지(`medication_logs` insert 확인)
8. "등록된 약" 목록에서 "테스트약" 삭제 → 목록과 "오늘" 섹션에서 즉시 사라지는지
9. (사진이 있다면) `/medications/add`에서 처방전 사진 첨부 후 "AI로 약 이름 찾기" → 후보 칩이 뜨고, 체크하면 등록 예정 목록에 반영되는지

- [ ] **Step 4: Commit**

```bash
git add app/medications/add/page.tsx
git commit -m "Add /medications/add medication registration form"
```

---

## Self-Review Notes

- **스펙 커버리지:** 데이터 모델(Task 1) / Gemini 비전 추출(Task 3, 4) / `/medications` 목록+오늘체크(Task 5) / `/medications/add` 단일 폼(Task 6, 사진→후보→체크, 수동 추가, 프리셋+개별시간, 종료일, 부분 실패 처리) — 스펙의 모든 섹션이 태스크로 매핑됨. 메인 허브 연동과 수정 기능은 스펙에서도 명시적으로 범위 밖.
- **타입 일관성:** `MedicationRecord`/`MedicationLogRecord`/`MedicationInput`의 필드명(`startDate`/`endDate`/`times`/`medicationId`/`dateKey`/`takenAt`)이 Task 2에서 정의된 그대로 Task 5, 6에서 사용됨을 확인.
- **플레이스홀더 스캔:** "TBD"/"나중에" 등 없음, 모든 스텝에 실제 코드 포함.
