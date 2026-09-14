# 채팅 상담사 페르소나 + 개인 기록 참고 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/chat` a counselor-style base persona and let it reference the user's own medication/symptom-check/biometric records, with a deterministic crisis-safety net.

**Architecture:** Extend the existing `buildEventContext` pattern (a plain string, `undefined` when nothing to say) into three new per-domain context builders plus one always-on persona constant; the chat page composes them into the single `context` string it already sends to `/api/chat`. A keyword-based safety net in the API route short-circuits before calling Gemini when the latest user message matches a crisis keyword.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (browser client, RLS-secured), Gemini REST API via `lib/gemini.ts`/`lib/ai.ts`. No test runner exists for this app.

**Spec:** `docs/superpowers/specs/2026-09-14-chat-counselor-persona-design.md`

## Global Constraints

- No automated test runner exists for this Next.js app (CLAUDE.md-documented convention, confirmed by `find` returning zero `*.test.ts(x)`/`*.spec.ts` files under the app). Do not add a new test framework. Verification per task is `npm run lint` + `npm run build` (full TypeScript type-check across every route); the plan's final task adds a manual 3-scenario click-through.
- Crisis hotline copy must say **109** (통합 자살예방상담전화, 24시간, 무료) and **112/119** for emergencies — verified current as of 2026-09-14 ([보건복지부 보도자료](https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1479607&act=view)). Do not invent or substitute a different number.
- `CRISIS_SAFETY_MESSAGE` has exactly one definition, in `lib/crisisDetection.ts`. `lib/chatPersona.ts` imports it rather than re-typing the copy (DRY) so the API-route short-circuit and the prompt-level instruction never drift apart.
- Every new context-builder function returns `undefined` when there's nothing to report, matching `lib/events.ts`'s existing `buildEventContext(events): string | undefined` convention exactly — never an empty string.
- Follow the existing per-domain-lib-file pattern (`lib/medications.ts`, `lib/symptomHistory.ts`, `lib/biometrics.ts` each own their own data + now their own context builder) — do not introduce a new `lib/chatContext.ts` aggregator file; composition happens inline in `app/chat/page.tsx`, same as today.
- Non-diagnostic hedging stays consistent with the rest of the app (`lib/symptomCheck.ts`'s `FALLBACK_DISCLAIMER`, `getMedicationPrecautions`/`getBiometricAnalysis`'s closing "확인은 병원에서" line): no confirmed diagnoses or prescriptions, ever.

---

### Task 1: `lib/crisisDetection.ts` — crisis keyword detection + fixed safety message

**Files:**
- Create: `lib/crisisDetection.ts`

**Interfaces:**
- Consumes: nothing (pure module, no imports needed)
- Produces: `CRISIS_KEYWORDS: string[]`, `containsCrisisSignal(text: string): boolean`, `CRISIS_SAFETY_MESSAGE: string` — consumed by Task 2 (`lib/chatPersona.ts`) and Task 3 (`app/api/chat/route.ts`)

- [ ] **Step 1: Create the file**

```ts
export const CRISIS_KEYWORDS = [
  "자살",
  "죽고싶",
  "죽고 싶",
  "죽어버리고 싶",
  "자해",
  "살기 싫",
  "사라지고 싶",
] as const;

export function containsCrisisSignal(text: string): boolean {
  return CRISIS_KEYWORDS.some((keyword) => text.includes(keyword));
}

export const CRISIS_SAFETY_MESSAGE =
  "힘든 마음을 나눠주셔서 고마워요. 그런데 지금 느끼시는 마음은 저 혼자보다 전문가와 " +
  "나누시는 게 훨씬 도움이 될 것 같아요. 자살예방상담전화 109(24시간, 무료, 전국 어디서나 " +
  "국번 없이)로 전화하시면 언제든 이야기를 들어주실 거예요. 만약 지금 당장 위험한 " +
  "상황이라면 112나 119로 바로 연락해주세요. 혼자 견디지 않으셨으면 해요.";
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: succeeds with no new TypeScript errors (this file has no consumers yet, so it just needs to compile standalone).

- [ ] **Step 3: Manual sanity check**

There's no test runner in this project, so verify the pure function by temporarily pasting this into any client component's event handler (or a scratch `console.log` in `app/chat/page.tsx`'s mount effect) and checking the browser console, then remove it — do not leave debug code committed:

```ts
console.log(containsCrisisSignal("나 요즘 죽고싶다는 생각이 들어")); // expect true
console.log(containsCrisisSignal("오늘 날씨 좋다")); // expect false
```

- [ ] **Step 4: Commit**

```bash
git add lib/crisisDetection.ts
git commit -m "Add crisis keyword detection and fixed safety message"
```

---

### Task 2: `lib/chatPersona.ts` — base counselor persona prompt

**Files:**
- Create: `lib/chatPersona.ts`

**Interfaces:**
- Consumes: `CRISIS_SAFETY_MESSAGE` from `lib/crisisDetection.ts` (Task 1)
- Produces: `CHAT_PERSONA_PROMPT: string` — consumed by Task 5 (`app/chat/page.tsx`)

- [ ] **Step 1: Create the file**

```ts
import { CRISIS_SAFETY_MESSAGE } from "@/lib/crisisDetection";

export const CHAT_PERSONA_PROMPT =
  "당신은 사용자와 매일 대화하는 다정한 개인 건강 동반자예요. 상담사처럼 공감적으로 " +
  "경청하고, 판단하거나 다그치지 않아요. 사용자가 감정이나 상태를 이야기하면 먼저 그 " +
  "감정을 인정해주고(\"~하셨군요, 많이 힘드셨겠어요\"), 대화를 이어갈 수 있는 열린 " +
  "질문을 자연스럽게 건네세요. 정보를 나열하기보다 대화 흐름을 따라가며 짧고 편안한 " +
  "문장으로 답하세요.\n\n" +
  "이 앱에는 사용자의 복약 기록, 증상체크 이력, 심박수 데이터가 쌓여 있고, 대화 맥락에 " +
  "관련 정보가 주어지면 그걸 자연스럽게 참고해서 되물어봐도 좋아요(예: \"오늘 약은 잘 " +
  "챙겨 드셨어요?\", \"지난번 두통은 좀 어때요?\"). 억지로 매번 언급할 필요는 없고, " +
  "대화 흐름에 맞을 때만 꺼내세요.\n\n" +
  "당신은 의사가 아니고, 이 대화는 의학적 진단이나 처방이 아니에요. 확정적인 진단명이나 " +
  "처방을 말하지 마세요. 다만 증상이 계속되거나 심해 보이면, 다그치듯이 아니라 걱정하는 " +
  "친구처럼 \"병원에 한번 가보는 게 어떨까요?\"라고 자연스럽게 권유하세요 — 매 대화마다 " +
  "반복할 필요는 없어요.\n\n" +
  "만약 사용자가 자살, 자해, 죽고 싶다는 생각 등 위기 신호를 드러내면, 다른 조언이나 " +
  "위로를 덧붙이지 말고 반드시 아래 문장만 그대로 답하세요:\n" +
  `"${CRISIS_SAFETY_MESSAGE}"`;
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: succeeds — confirms the import from Task 1 resolves correctly.

- [ ] **Step 3: Commit**

```bash
git add lib/chatPersona.ts
git commit -m "Add base counselor persona prompt for chat"
```

---

### Task 3: Wire the crisis safety net into `/api/chat`

**Files:**
- Modify: `app/api/chat/route.ts` (full current contents shown below for context)

**Interfaces:**
- Consumes: `containsCrisisSignal`, `CRISIS_SAFETY_MESSAGE` from `lib/crisisDetection.ts` (Task 1); existing `ChatMessage` type from `lib/ai.ts` (`{ role: "user" | "assistant", content: string }`)
- Produces: nothing new consumed by later tasks — this is a leaf change

- [ ] **Step 1: Replace the file contents**

Current file:

```ts
import { generateReply, type ChatMessage } from "@/lib/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];
  const context: string | undefined = body?.context;

  if (messages.length === 0) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  try {
    const reply = await generateReply(messages, context);
    return Response.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

New file:

```ts
import { generateReply, type ChatMessage } from "@/lib/ai";
import { containsCrisisSignal, CRISIS_SAFETY_MESSAGE } from "@/lib/crisisDetection";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const messages: ChatMessage[] = body?.messages ?? [];
  const context: string | undefined = body?.context;

  if (messages.length === 0) {
    return Response.json({ error: "메시지를 입력해주세요." }, { status: 400 });
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMessage && containsCrisisSignal(lastUserMessage.content)) {
    return Response.json({ reply: CRISIS_SAFETY_MESSAGE });
  }

  try {
    const reply = await generateReply(messages, context);
    return Response.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npm run lint && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, log in, open `/chat`, and send the message `나 요즘 죽고싶다는 생각이 들어`. Expected: the reply is exactly the `CRISIS_SAFETY_MESSAGE` text, and it appears near-instantly (no Gemini round-trip delay) — confirms the short-circuit fired before calling `generateReply`.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "Short-circuit /api/chat with a fixed safety message on crisis signals"
```

---

### Task 4: Add the three per-domain context builders

**Files:**
- Modify: `lib/medications.ts` (append function)
- Modify: `lib/symptomHistory.ts` (append function)
- Modify: `lib/biometrics.ts` (append function)

**Interfaces:**
- Consumes: existing types already defined in each file — `MedicationRecord`, `DoseSlot` (`lib/medications.ts`); `SymptomCheckRecord` (`lib/symptomHistory.ts`); `BiometricRecord` (`lib/biometrics.ts`)
- Produces: `buildMedicationContext(medications: MedicationRecord[], todaySlots: DoseSlot[]): string | undefined`, `buildSymptomHistoryContext(records: SymptomCheckRecord[]): string | undefined`, `buildBiometricContext(readings: BiometricRecord[]): string | undefined` — all three consumed by Task 5 (`app/chat/page.tsx`)

- [ ] **Step 1: Append to `lib/medications.ts`**

Add at the end of the file (after the existing `getDueCount` function):

```ts
export function buildMedicationContext(
  medications: MedicationRecord[],
  todaySlots: DoseSlot[]
): string | undefined {
  if (medications.length === 0) return undefined;

  const names = medications.map((m) => m.name).join(", ");
  if (todaySlots.length === 0) {
    return `사용자가 복용 중인 약: ${names}. 오늘은 예정된 복용 시간이 없어요.`;
  }

  const taken = todaySlots.filter((s) => s.taken).length;
  const total = todaySlots.length;
  const missed = todaySlots
    .filter((s) => !s.taken)
    .map((s) => `${s.name}(${s.time})`)
    .join(", ");

  const status =
    taken === total
      ? "오늘 예정된 약은 모두 챙겨 드셨어요."
      : `오늘 ${total}회 중 ${taken}회 복용했고, 아직 안 드신 건: ${missed}.`;

  return `사용자가 복용 중인 약: ${names}. ${status} 대화 흐름이 자연스러울 때만 부담스럽지 않게 언급해주세요.`;
}
```

**Note:** `todaySlots` must be *all* of today's slots (taken and not-taken alike), computed via the already-exported `computeDoseSlots(medications, logs, today)` — **not** `getDueSlots()`, which filters down to only untaken/overdue slots and would make every taken dose invisible to this summary. Task 5 wires this up correctly.

- [ ] **Step 2: Append to `lib/symptomHistory.ts`**

Add at the end of the file:

```ts
function formatCheckDate(createdAt: string) {
  const d = new Date(createdAt);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function buildSymptomHistoryContext(
  records: SymptomCheckRecord[]
): string | undefined {
  if (records.length === 0) return undefined;

  const lines = records.slice(0, 3).map((r) => {
    const symptoms = r.symptoms.join(", ");
    return `- ${formatCheckDate(r.createdAt)}: ${r.bodyPart} 부위, 증상(${symptoms}). AI 요약: ${r.summary}`;
  });

  return `사용자의 최근 증상체크 기록이에요:\n${lines.join("\n")}\n대화 중 관련 있으면 자연스럽게 후속 질문을 해도 좋아요. 매번 언급할 필요는 없어요.`;
}
```

`getSymptomChecks()` already returns records newest-first, so `.slice(0, 3)` is the 3 most recent — no change needed to `getSymptomChecks` itself.

- [ ] **Step 3: Append to `lib/biometrics.ts`**

Add at the end of the file:

```ts
export function buildBiometricContext(
  readings: BiometricRecord[]
): string | undefined {
  if (readings.length < 2) return undefined;

  const values = readings.map((r) => r.heartRate);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const latest = readings[0];
  const latestTime = new Date(latest.measuredAt).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    `사용자의 최근 심박수 기록 요약이에요: 평균 ${avg}bpm, 최고 ${max}bpm, 최저 ${min}bpm, ` +
    `가장 최근 측정값은 ${latestTime}에 ${latest.heartRate}bpm이었어요. ` +
    `평소와 다른 패턴이 보이면 자연스럽게 물어봐도 좋지만, 의학적 진단은 하지 마세요.`
  );
}
```

`getRecentBiometrics()` already returns readings newest-first (confirmed: `.order("measured_at", { ascending: false })`), so `readings[0]` is the latest — matches the same assumption `app/biometrics/page.tsx` already makes.

- [ ] **Step 4: Type-check**

Run: `npm run build`
Expected: succeeds — these three functions have no consumers yet, so this only confirms each compiles against its file's existing types.

- [ ] **Step 5: Commit**

```bash
git add lib/medications.ts lib/symptomHistory.ts lib/biometrics.ts
git commit -m "Add chat context builders for medications, symptom history, biometrics"
```

---

### Task 5: Wire persona + context builders into `/chat`

**Files:**
- Modify: `app/chat/page.tsx`

**Interfaces:**
- Consumes: `CHAT_PERSONA_PROMPT` (Task 2); `buildMedicationContext`, `buildSymptomHistoryContext`, `buildBiometricContext` (Task 4); existing `getMedications`, `getDoseLogs`, `computeDoseSlots`, `type MedicationRecord`, `type DoseSlot` from `lib/medications.ts`; existing `getSymptomChecks`, `type SymptomCheckRecord` from `lib/symptomHistory.ts`; existing `getRecentBiometrics`, `type BiometricRecord` from `lib/biometrics.ts`; existing `buildEventContext`, `getUpcomingEvents`, `type CalendarEvent` from `lib/events.ts` (already imported); existing `todayKey` from `lib/chatHistory.ts` (already imported)
- Produces: nothing consumed by later tasks — this is the final integration point

- [ ] **Step 1: Add the new imports**

At the top of `app/chat/page.tsx`, alongside the existing imports:

```ts
import {
  getMedications,
  getDoseLogs,
  computeDoseSlots,
  buildMedicationContext,
  type MedicationRecord,
  type DoseSlot,
} from "@/lib/medications";
import {
  getSymptomChecks,
  buildSymptomHistoryContext,
  type SymptomCheckRecord,
} from "@/lib/symptomHistory";
import {
  getRecentBiometrics,
  buildBiometricContext,
  type BiometricRecord,
} from "@/lib/biometrics";
import { CHAT_PERSONA_PROMPT } from "@/lib/chatPersona";
```

- [ ] **Step 2: Add state for the three new data sources**

Alongside the existing `const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);`:

```ts
const [medications, setMedications] = useState<MedicationRecord[]>([]);
const [todayDoseSlots, setTodayDoseSlots] = useState<DoseSlot[]>([]);
const [symptomChecks, setSymptomChecks] = useState<SymptomCheckRecord[]>([]);
const [biometrics, setBiometrics] = useState<BiometricRecord[]>([]);
```

- [ ] **Step 3: Fetch the new data on mount, alongside the existing `getUpcomingEvents` call**

The existing mount effect is:

```ts
useEffect(() => {
  getDayMessages(todayKey()).then((msgs) => {
    setMessages(msgs);
    setReady(true);
  });
  getUpcomingEvents().then(setUpcomingEvents);
}, []);
```

Change it to:

```ts
useEffect(() => {
  getDayMessages(todayKey()).then((msgs) => {
    setMessages(msgs);
    setReady(true);
  });
  getUpcomingEvents()
    .then(setUpcomingEvents)
    .catch(() => {});

  Promise.all([getMedications(), getDoseLogs(todayKey())])
    .then(([meds, logs]) => {
      setMedications(meds);
      setTodayDoseSlots(computeDoseSlots(meds, logs, todayKey()));
    })
    .catch(() => {});
  getSymptomChecks()
    .then(setSymptomChecks)
    .catch(() => {});
  getRecentBiometrics()
    .then(setBiometrics)
    .catch(() => {});
}, []);
```

Every new fetch is caught so a failure in any one of them leaves that piece of state at its `[]` default — which makes the corresponding `build*Context` call return `undefined` (empty-array inputs) rather than crashing the chat page.

- [ ] **Step 4: Compose the full context in `handleSend`**

The existing call is:

```ts
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: nextMessages.map(({ role, content }) => ({ role, content })),
    context: buildEventContext(upcomingEvents),
  }),
});
```

Change the `context` line to compose all five pieces:

```ts
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: nextMessages.map(({ role, content }) => ({ role, content })),
    context: [
      CHAT_PERSONA_PROMPT,
      buildEventContext(upcomingEvents),
      buildMedicationContext(medications, todayDoseSlots),
      buildSymptomHistoryContext(symptomChecks),
      buildBiometricContext(biometrics),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
});
```

- [ ] **Step 5: Type-check and lint**

Run: `npm run lint && npm run build`
Expected: both succeed with no errors — this is the step most likely to surface a signature mismatch (e.g. wrong argument order into `buildMedicationContext`), since it's the first place all the new functions are actually called together.

- [ ] **Step 6: Commit**

```bash
git add app/chat/page.tsx
git commit -m "Compose counselor persona and record context into /chat requests"
```

---

### Task 6: Manual end-to-end verification (the three scenarios from the spec)

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Scenario A — account with records**

Run `npm run dev`, log into an account that has at least one medication, one symptom check, and two or more biometric readings (reuse the account tested earlier this session for the `/biometrics` chart work). Open `/chat` and have a short conversation. Expected: the tone is warm/empathetic (not a plain Q&A bot), and at some natural point the assistant references at least one of the medication/symptom/biometric records without it being forced into every single reply.

- [ ] **Step 2: Scenario B — fresh account with no records**

Sign up a new test account (or use one with an empty history) and open `/chat`. Expected: the conversation still works normally with the counselor tone — no error, no crash, no mention of medications/symptoms/heart rate (since every `build*Context` returns `undefined` for empty data, `context` is just `CHAT_PERSONA_PROMPT` plus whatever `buildEventContext` contributes).

- [ ] **Step 3: Scenario C — crisis keyword**

In either account's `/chat`, send `나 요즘 죽고싶다는 생각이 들어`. Expected: immediate reply (no visible "동기화 중"/typing delay characteristic of a real Gemini round-trip) containing the exact `CRISIS_SAFETY_MESSAGE` text, including "109" and "112".

- [ ] **Step 4: Final full build**

Run: `npm run lint && npm run build`
Expected: both succeed — this is the final gate before considering the feature done.
