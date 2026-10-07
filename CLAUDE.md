# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

No test runner is configured for the Next.js app. The separate `ml-service/` Python subsystem (see below) uses pytest — run `cd ml-service && source .venv/Scripts/activate && python -m pytest -v`.

Requires `GEMINI_API_KEY` in `.env.local` (see `.env.local.example`) to use either API route. Optional `GEMINI_MODEL` env var overrides the default model (`gemini-flash-latest`).

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` for auth/chat history. Get them from the Supabase project's Settings → API page. Run `supabase/schema.sql` once in that project's SQL editor before first use, and turn off "Confirm email" under Authentication → Providers → Email (no email-confirmation flow is built).

Requires two Kakao keys in `.env.local` for the nearby-hospitals feature on `/symptom-check`: `KAKAO_REST_API_KEY` (server-side, Kakao Local keyword search) and `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` (client-side, Kakao Maps JS SDK). Both come from the same Kakao Developers app (developers.kakao.com → 내 애플리케이션 → 앱 키); register `http://localhost:3000` under 플랫폼 설정 → Web.

Optional `ML_SERVICE_URL` in `.env.local` (default `http://localhost:8000`) points `/symptom-check`'s photo-attach path at the local `ml-service` FastAPI server (see below) — only relevant when testing the skin-photo classification flow locally.

## Architecture

Next.js App Router (canary), React 19, Tailwind v4, TypeScript. `@/*` path alias maps to repo root.

### ML service (`ml-service/`)

A local-only Python/FastAPI service (Python 3.12 venv, CUDA PyTorch) that trains and serves an EfficientNet-B0 skin-condition image classifier via `POST /predict`. It is entirely separate from the Next.js app above — no shared code, own `requirements.txt`, own pytest suite — and is never deployed to Vercel.

**This project pins a Next.js canary build (`16.3.0-canary.91`)** whose APIs/conventions may diverge from training data — see `node_modules/next/dist/docs/` before assuming App Router behavior, and heed the auto-generated agent-rules block imported above.

### Auth + storage — Supabase (Postgres + Auth)

`lib/session.ts` no longer exists. Auth and chat history are backed by a real Supabase project:

- `lib/supabase/client.ts` — browser Supabase client (`createBrowserClient` from `@supabase/ssr`). Stores the session in cookies (not localStorage) so `proxy.ts` can read it server-side. Also exports `createSessionOnlyClient()`, used only by `app/page.tsx` when "자동 로그인" is unchecked — it mirrors `@supabase/ssr`'s own document-cookie writer (see `node_modules/@supabase/ssr/dist/*/cookies.js`) but omits `Max-Age`/`Expires` so the session cookie clears when the browser fully closes, instead of the library's hardcoded ~400-day default. Used directly by `app/page.tsx`, `app/signup/page.tsx`, `app/main/page.tsx`, `app/settings/page.tsx`, `app/chats/page.tsx`, `lib/chatHistory.ts`, and `lib/symptomHistory.ts`.
- `proxy.ts` (repo root) — Next 16 renamed `middleware.ts` → `proxy.ts` and the exported function `middleware` → `proxy`; only the names changed. `config.matcher` is an explicit allowlist of protected **pages** (`/main`, `/chat`, `/chats/:path*`, `/symptom-check/:path*`, `/settings`, `/medications`, `/medications/:path*`, `/health-records`) — it never matches `/api/*`, `/`, or `/signup`, so a Supabase outage cannot affect the Gemini routes and the auth pages stay reachable. This single file replaces what used to be 5 duplicated `useEffect` auth guards; it creates its own Supabase server client inline via request/response cookie bridging (`next/headers`'s `cookies()` isn't available inside proxy/middleware, unlike Server Components/Route Handlers).
- `lib/chatHistory.ts` — same exported names as before (`getDayMessages`, `appendDayMessage`, `getDatesWithHistory`, `todayKey`, `formatDateKey`), but the first three are now **async** and hit a Postgres `messages` table directly from the browser client. Row Level Security (`supabase/schema.sql`) enforces `auth.uid() = user_id` on select/insert, so this is safe to call client-side without a server-side API layer in between.
- `lib/symptomHistory.ts` — same RLS-secured direct-client-call pattern as `lib/chatHistory.ts`, but for the `symptom_checks` table (`saveSymptomCheck`, `getSymptomChecks`). Saving is best-effort and fire-and-forget from `app/symptom-check/page.tsx` — a save failure is logged, never surfaced over the AI result already on screen.

### Page flow

`/` (login) and `/signup` (nickname + email/password) are separate pages sharing `translateAuthError` from `lib/authErrors.ts`. Signup signs the user out immediately after `auth.signUp()` and redirects to `/?signup=success` — it deliberately does not auto-login, so first login always goes through the login form. `/` → `/main` (hub) → either:
- `/chat` — today's chat room, reads/appends via `lib/chatHistory.ts`, posts to `/api/chat`
- `/chats` — calendar view of days with saved history → `/chats/[date]` — read-only view of a past day's messages
- `/symptom-check` — 5-step wizard (body part via `components/BodyDiagram.tsx` SVG figure → symptoms → duration → severity → free-text note) → posts to `/api/symptom-check`, then best-effort saves via `lib/symptomHistory.ts`. Each recommended department chip in the result toggles `components/HospitalMap.tsx`, which geolocates the browser, posts to `/api/hospitals`, and renders Kakao Maps JS markers for nearby matches. The wizard's "지난 기록 보기" button leads to `/health-records` (see below).
- `/settings` — edit the nickname stored in `auth.updateUser({ data: { nickname } })`; email is read-only
- `/medications` — card-deck (`components/CardDeck.tsx`) of registered meds plus today's due-dose checklist (`lib/medications.ts`'s `computeDoseSlots`) → `/medications/add` — register a med by photo (Gemini `extractMedicineNames` reads the prescription/name + dosing interval) or manual entry, then `generateIntervalTimes` expands an interval into a day's HH:MM slots and `getMedicationPrecautions` fetches AI-written precautions. Tapping a card opens `components/MedicationDetailSheet.tsx` (edit dose times, delete). See "복약 관리 (medications)" below.
- `/health-records` — tabbed screen ("증상 기록" / "워치 데이터", `?tab=` query param, defaults to `symptoms`) reachable from the main hub's "내 건강 기록" card and from `/symptom-check`'s "지난 기록 보기" button (which deep-links to `?tab=symptoms`). `components/SymptomHistorySection.tsx` renders past `symptom_checks` records as a swipeable `CardDeck` with a detail sheet (delete via a confirm dialog); `components/BiometricsSection.tsx` renders the Health Connect heart-rate sync + Gemini analysis UI (see below).

`components/ChatMessages.tsx` is shared between the live chat room and the read-only history view. Its loading state renders a bouncing 3-dot "typing…" indicator (`.typing-dot` in `app/globals.css`) rather than literal loading text.

### AI provider (Gemini / local Ollama)

Both API routes import `generateReply` from `lib/ai.ts`, not `lib/gemini.ts` directly. `lib/ai.ts` is a thin router: it calls `lib/ollama.ts` when `process.env.AI_PROVIDER === "ollama"`, otherwise `lib/gemini.ts` (the default, and the only option that works on Vercel). This exists so a local Ollama model can be swapped in for free experimentation without touching either route. Tried `qwen2.5:7b-instruct` first, but it occasionally code-switched into Chinese mid-reply; `exaone3.5:7.8b` (LG AI Research, Korean/English bilingual-tuned) fixed that and is the current default — both fit comfortably on the dev machine's RTX 4070 SUPER (12GB VRAM) — set `AI_PROVIDER=ollama` (plus optionally `OLLAMA_BASE_URL`/`OLLAMA_MODEL`) in `.env.local` only. Ollama listens on `localhost:11434`, which Vercel's serverless functions can never reach, so this switch is dev/test-only by construction, not a config oversight.

There is also a separate `local-ollama` branch that flips `lib/ai.ts`'s default to Ollama for local experimentation without needing `AI_PROVIDER` set — never deploy that branch. Fixes there get merged into `master` selectively, not fast-forwarded wholesale.

`lib/gemini.ts` calls the Gemini REST `generateContent` endpoint directly via `fetch` (no SDK), mapping `assistant` → `model` role. `lib/ollama.ts` calls Ollama's own `/api/chat` endpoint, which already accepts `system`/`user`/`assistant` roles as-is (no remapping needed) and returns `message.content`. Both `app/api/chat/route.ts` and `app/api/symptom-check/route.ts` are thin wrappers: validate input, call `generateReply`, map errors to a Korean-language JSON error response.

`lib/symptomCheck.ts` builds the Korean prompt that instructs Gemini to reply with strict JSON (`conditions`, `departments`, `summary`, `disclaimer`) and hedged, non-diagnostic language. `parseSymptomResult` strips markdown code fences and falls back to a safe default (empty arrays + raw text as `summary` + a fixed disclaimer) if JSON parsing fails — the API route never surfaces a parse error to the client.

### Nearby-hospitals (Kakao) integration

`app/api/hospitals/route.ts` takes `{ lat, lng, department }` from the browser and calls `searchNearbyHospitals` in `lib/hospitals.ts`, which hits Kakao Local's keyword search (`dapi.kakao.com/v2/local/search/keyword.json`, `Authorization: KakaoAK {KAKAO_REST_API_KEY}` header) with `query=<department>`, `x`/`y` (lng/lat), `radius=5000`, `sort=distance`. Unlike the NAVER APIs this was migrated off of, Kakao's keyword search takes coordinates + radius natively, so there's no separate reverse-geocoding step — proximity bias comes straight from the `x`/`y`/`radius` params, and `distance` (meters) comes back per result for free.

`components/HospitalMap.tsx` is the only client-side consumer: it calls the browser Geolocation API, posts to `/api/hospitals`, and lazy-loads the Kakao Maps JS SDK (`dapi.kakao.com/v2/maps/sdk.js?appkey=...&autoload=false`) via a manually-injected `<script>` tag rather than `next/script`, caching the load promise in a module-level variable so re-mounting (e.g. switching departments) doesn't re-inject it. `autoload=false` + `kakao.maps.load(callback)` defers SDK init until the callback fires, avoiding a race with the script's own onload. This uses the JS app key (`NEXT_PUBLIC_KAKAO_MAP_APP_KEY`), a separate key from the REST API key used server-side above — both come from the same Kakao Developers app.

### 복약 관리 (medications)

Two Supabase tables, same RLS-secured direct-client-call pattern as chat/symptom history: `medications` (name, `times: string[]`, `start_date`/`end_date`, optional `photo`/`precautions`) and `medication_logs` (one row per taken dose, unique on `(medication_id, date_key, time)` — `logDose`'s insert treats Postgres error `23505` as success since it just means the slot was already checked). All CRUD lives in `lib/medications.ts`; components never call Supabase directly.

`lib/medications.ts`'s `generateIntervalTimes(startTime, intervalHours)` expands a single start time + hour interval into a day's HH:MM slots, wrapping past midnight (e.g. `("08:00", 4)` → 6 slots including `00:00`). `computeDoseSlots(medications, logs, today)` is the pure function both `/medications` and the notification pollers below share — it filters to meds active on `today` (`startDate <= today <= endDate`) and cross-references `logs` to mark each slot taken; it re-checks `l.dateKey === today` even though `getDoseLogs` already queries by that date, since `getDueSlots` composes it directly with an unfiltered read in some call paths.

`app/medications/add/page.tsx` supports two entry paths: upload a prescription/box photo → `extractMedicineNames` (Gemini vision, `lib/gemini.ts`) returns `{name, intervalHours}` per medicine (strips prescription serial-number prefixes, keeps mg/mL dosage in the name) so the interval can be turned into slots via `generateIntervalTimes` without the user typing times by hand; or add manually with hand-picked times. Either path can also call `getMedicationPrecautions(name, photo?)` to have Gemini write 3–5 bullets of common side effects/interactions, always closing with a "confirm with a doctor/pharmacist" line — same disclaimer discipline as the symptom checker.

Two independent due-dose notifiers both poll `getDueSlots()` (today's untaken slots whose time has passed) every 30s, deliberately decoupled per `lib/doseNotifications.ts`'s header comment: the `/main` bell badge uses a `localStorage`-backed "seen" set (survives reload, cleared only when the popup is opened) while `components/DoseToaster.tsx` — mounted once in the root layout so it fires from any screen — uses a `sessionStorage`-backed "toasted" set (cleared when the tab closes) so the same due dose doesn't re-toast every poll independent of whether it's been "seen" in the bell popup. Both sets key on `dateKey` and reset automatically when the stored date no longer matches today, so nothing needs manual pruning as days roll over.

### Styling

Pastel "dawn" theme (sky blue warming into a soft blush at the edges) defined as CSS custom properties in `app/globals.css` (`--bg`, `--accent`, `--blush`, `--danger`, `--bubble-mine`, etc.), consumed via Tailwind's `@theme inline` mapping (`bg-bg`, `text-ink`, `bg-accent`, ...) rather than Tailwind's default palette. A `@media (prefers-color-scheme: dark)` block in `app/globals.css` redefines the same token names with a "dusk" navy palette — no manual toggle in the UI, it just follows the OS setting. Body text uses Pretendard Variable (loaded via a CDN `<link>` in `app/layout.tsx`, not `next/font` — it isn't a Google font); `font-display` (Space Grotesk, `next/font/google`) is reserved for Latin/numeral-only moments (the "AI Chat" wordmark, `STEP n / 5`) to avoid mixing two CJK-covering font families. The `.orb-mark` class is the recurring AI/brand avatar (login/main hero, chat header, assistant message bubbles) — a two-tone radial gradient with an optional `.orb-mark--hero` breathing animation. Use `text-danger`, not Tailwind's default `red-*`, for error copy.

## 알고리즘 학습 트랙 (취업 포트폴리오용)

The user is studying algorithms and **implementing them personally** in this project so they can explain them in job interviews (healthcare full-stack). When the user says things like "졸작 알고리즘 공부 이어서 하자", "아호코라식 하자", or "문서 정리해줘", this section governs the work.

- **Source of truth for progress:** `docs/study/algorithm-study-log.md` (Korean, 10 sections: 배경과 목표 · 프로젝트 구조 · 로드맵 A/B/C · 학습 방식과 환경 · per-problem sections · 면접 예상 질문 · 자소서 활용 포인트 · 현재 진도). Read it first, and resume from section 10's first unchecked item.
- **Roadmap:** A. 위기 신호 감지 (`lib/crisisDetection.ts`: Trie → Aho-Corasick with BFS failure links → Levenshtein + 한글 자모 분해) → B. 심박수 이상 탐지 (`lib/biometrics.ts`: robust z-score → BOCPD) → C. 피부 분류 신뢰도 보정 (`ml-service`: Temperature Scaling + ECE). Each of A/B/C gets its own spec → plan → implementation when it reaches the "졸작에 적용" stage.
- **Tutor, not implementer.** The user writes the algorithm code. Claude explains concepts (Korean, relating to C since that's the user's school language; ASCII node/memory diagrams and step-by-step traces work best), asks check questions, gives graduated hints, and reviews the user's code by running it — but does not hand over the solution. Writing problems, tests, judges and reference solutions is Claude's job.
- **Study workspace (local, not in this repo):** `~/algorithm-study/NN-<topic>/` with `PROBLEM.md`, `main.c`, `tests/*.in|*.out`, `judge.sh` (verdicts + ms + MB). Expected outputs are generated independently in Python; Claude's reference solution lives only in its scratchpad, never in the user's folder. `.vscode/` there has a Cmd+Shift+B compile-and-run task (auto-feeds `tests/01-sample.in`) and Copilot disabled for that folder only. On a new machine this folder won't exist — recreate the setup and regenerate the next problem rather than assuming old files.
- **After every study session, update the log** in the same style: add a section for each new problem (설정 · 디버깅 과정 table of attempt → 채점 결과 → 원인 → 배운 것 · 핵심 교훈), add new interview Q&A rows to section 8, add/refresh 자소서 소재 in section 9 (상황 → 행동 → 결과 → 배운 점, measured numbers only — never claim something not yet implemented), tick section 10's checklist, and bump the date at the top. If the user has the Claude Docs connector, mirror the same update to the Claude Docs copy linked at the top of the log; otherwise the repo file alone is fine. Commit the log when the user asks to push.

### 코드 출처 구분 (바이브 vs 직접) — applies to ALL work in this repo, not only the study track

Every change is either **바이브** (Claude/AI wrote it) or **직접** (the user typed it after studying). Full rules and the running registry: `docs/study/AUTHORSHIP.md`. In short:

- **Baseline:** all app code up to commit `7aff87d` (2026-10-07) is 바이브.
- **Files:** user-written algorithm code goes in `lib/algorithms/` (직접-only folder) and starts with `// [직접 작성] <what> — 학습 기록: docs/study/algorithm-study-log.md §<n>`; a 직접 function inside a 바이브 file gets the same comment above it. Unmarked = 바이브.
- **Never edit 직접 code yourself** (`[직접 작성]` marked or under `lib/algorithms/`) — not even typos. Report the location and reason; the user fixes it. If the user asks you to write something they would otherwise write, it is 바이브 and stays out of the registry.
- **Commits:** end every commit message with `Code-Origin: 직접` or `Code-Origin: 바이브`. 직접 commits do **not** get the Claude `Co-Authored-By` line (this overrides the default attribution); 바이브 commits keep it. Never mix the two in one commit — split them.
- **Registry:** whenever 직접 code is added (including local `~/algorithm-study` work), append a row to the 직접 작성 목록 table in `AUTHORSHIP.md`. The study log and 자소서 소재 may only call something "직접 구현" if it is in that table.
