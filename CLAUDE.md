# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

No test runner is configured in this repo.

Requires `GEMINI_API_KEY` in `.env.local` (see `.env.local.example`) to use either API route. Optional `GEMINI_MODEL` env var overrides the default model (`gemini-flash-latest`).

Requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` for auth/chat history. Get them from the Supabase project's Settings → API page. Run `supabase/schema.sql` once in that project's SQL editor before first use, and turn off "Confirm email" under Authentication → Providers → Email (no email-confirmation flow is built).

Requires two Kakao keys in `.env.local` for the nearby-hospitals feature on `/symptom-check`: `KAKAO_REST_API_KEY` (server-side, Kakao Local keyword search) and `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` (client-side, Kakao Maps JS SDK). Both come from the same Kakao Developers app (developers.kakao.com → 내 애플리케이션 → 앱 키); register `http://localhost:3000` under 플랫폼 설정 → Web.

## Architecture

Next.js App Router (canary), React 19, Tailwind v4, TypeScript. `@/*` path alias maps to repo root.

**This project pins a Next.js canary build (`16.3.0-canary.91`)** whose APIs/conventions may diverge from training data — see `node_modules/next/dist/docs/` before assuming App Router behavior, and heed the auto-generated agent-rules block imported above.

### Auth + storage — Supabase (Postgres + Auth)

`lib/session.ts` no longer exists. Auth and chat history are backed by a real Supabase project:

- `lib/supabase/client.ts` — browser Supabase client (`createBrowserClient` from `@supabase/ssr`). Stores the session in cookies (not localStorage) so `proxy.ts` can read it server-side. Also exports `createSessionOnlyClient()`, used only by `app/page.tsx` when "자동 로그인" is unchecked — it mirrors `@supabase/ssr`'s own document-cookie writer (see `node_modules/@supabase/ssr/dist/*/cookies.js`) but omits `Max-Age`/`Expires` so the session cookie clears when the browser fully closes, instead of the library's hardcoded ~400-day default. Used directly by `app/page.tsx`, `app/signup/page.tsx`, `app/main/page.tsx`, `app/settings/page.tsx`, `app/chats/page.tsx`, `lib/chatHistory.ts`, and `lib/symptomHistory.ts`.
- `proxy.ts` (repo root) — Next 16 renamed `middleware.ts` → `proxy.ts` and the exported function `middleware` → `proxy`; only the names changed. `config.matcher` is an explicit allowlist of protected **pages** (`/main`, `/chat`, `/chats/:path*`, `/symptom-check/:path*`, `/settings`) — it never matches `/api/*`, `/`, or `/signup`, so a Supabase outage cannot affect the Gemini routes and the auth pages stay reachable. This single file replaces what used to be 5 duplicated `useEffect` auth guards; it creates its own Supabase server client inline via request/response cookie bridging (`next/headers`'s `cookies()` isn't available inside proxy/middleware, unlike Server Components/Route Handlers).
- `lib/chatHistory.ts` — same exported names as before (`getDayMessages`, `appendDayMessage`, `getDatesWithHistory`, `todayKey`, `formatDateKey`), but the first three are now **async** and hit a Postgres `messages` table directly from the browser client. Row Level Security (`supabase/schema.sql`) enforces `auth.uid() = user_id` on select/insert, so this is safe to call client-side without a server-side API layer in between.
- `lib/symptomHistory.ts` — same RLS-secured direct-client-call pattern as `lib/chatHistory.ts`, but for the `symptom_checks` table (`saveSymptomCheck`, `getSymptomChecks`). Saving is best-effort and fire-and-forget from `app/symptom-check/page.tsx` — a save failure is logged, never surfaced over the AI result already on screen.

### Page flow

`/` (login) and `/signup` (nickname + email/password) are separate pages sharing `translateAuthError` from `lib/authErrors.ts`. Signup signs the user out immediately after `auth.signUp()` and redirects to `/?signup=success` — it deliberately does not auto-login, so first login always goes through the login form. `/` → `/main` (hub) → either:
- `/chat` — today's chat room, reads/appends via `lib/chatHistory.ts`, posts to `/api/chat`
- `/chats` — calendar view of days with saved history → `/chats/[date]` — read-only view of a past day's messages
- `/symptom-check` — 5-step wizard (body part via `components/BodyDiagram.tsx` SVG figure → symptoms → duration → severity → free-text note) → posts to `/api/symptom-check`, then best-effort saves via `lib/symptomHistory.ts` → `/symptom-check/history` — accordion list of past checks. Each recommended department chip in the result toggles `components/HospitalMap.tsx`, which geolocates the browser, posts to `/api/hospitals`, and renders Kakao Maps JS markers for nearby matches.
- `/settings` — edit the nickname stored in `auth.updateUser({ data: { nickname } })`; email is read-only

`components/ChatMessages.tsx` is shared between the live chat room and the read-only history view. Its loading state renders a bouncing 3-dot "typing…" indicator (`.typing-dot` in `app/globals.css`) rather than literal loading text.

### AI provider (Gemini / local Ollama)

Both API routes import `generateReply` from `lib/ai.ts`, not `lib/gemini.ts` directly. `lib/ai.ts` is a thin router: it calls `lib/ollama.ts` when `process.env.AI_PROVIDER === "ollama"`, otherwise `lib/gemini.ts` (the default, and the only option that works on Vercel). This exists so a local Ollama model can be swapped in for free experimentation without touching either route. Tried `qwen2.5:7b-instruct` first, but it occasionally code-switched into Chinese mid-reply; `exaone3.5:7.8b` (LG AI Research, Korean/English bilingual-tuned) fixed that and is the current default — both fit comfortably on the dev machine's RTX 4070 SUPER (12GB VRAM) — set `AI_PROVIDER=ollama` (plus optionally `OLLAMA_BASE_URL`/`OLLAMA_MODEL`) in `.env.local` only. Ollama listens on `localhost:11434`, which Vercel's serverless functions can never reach, so this switch is dev/test-only by construction, not a config oversight.

`lib/gemini.ts` calls the Gemini REST `generateContent` endpoint directly via `fetch` (no SDK), mapping `assistant` → `model` role. `lib/ollama.ts` calls Ollama's own `/api/chat` endpoint, which already accepts `system`/`user`/`assistant` roles as-is (no remapping needed) and returns `message.content`. Both `app/api/chat/route.ts` and `app/api/symptom-check/route.ts` are thin wrappers: validate input, call `generateReply`, map errors to a Korean-language JSON error response.

`lib/symptomCheck.ts` builds the Korean prompt that instructs Gemini to reply with strict JSON (`conditions`, `departments`, `summary`, `disclaimer`) and hedged, non-diagnostic language. `parseSymptomResult` strips markdown code fences and falls back to a safe default (empty arrays + raw text as `summary` + a fixed disclaimer) if JSON parsing fails — the API route never surfaces a parse error to the client.

### Nearby-hospitals (Kakao) integration

`app/api/hospitals/route.ts` takes `{ lat, lng, department }` from the browser and calls `searchNearbyHospitals` in `lib/hospitals.ts`, which hits Kakao Local's keyword search (`dapi.kakao.com/v2/local/search/keyword.json`, `Authorization: KakaoAK {KAKAO_REST_API_KEY}` header) with `query=<department>`, `x`/`y` (lng/lat), `radius=5000`, `sort=distance`. Unlike the NAVER APIs this was migrated off of, Kakao's keyword search takes coordinates + radius natively, so there's no separate reverse-geocoding step — proximity bias comes straight from the `x`/`y`/`radius` params, and `distance` (meters) comes back per result for free.

`components/HospitalMap.tsx` is the only client-side consumer: it calls the browser Geolocation API, posts to `/api/hospitals`, and lazy-loads the Kakao Maps JS SDK (`dapi.kakao.com/v2/maps/sdk.js?appkey=...&autoload=false`) via a manually-injected `<script>` tag rather than `next/script`, caching the load promise in a module-level variable so re-mounting (e.g. switching departments) doesn't re-inject it. `autoload=false` + `kakao.maps.load(callback)` defers SDK init until the callback fires, avoiding a race with the script's own onload. This uses the JS app key (`NEXT_PUBLIC_KAKAO_MAP_APP_KEY`), a separate key from the REST API key used server-side above — both come from the same Kakao Developers app.

### Styling

Pastel "dawn" theme (sky blue warming into a soft blush at the edges) defined as CSS custom properties in `app/globals.css` (`--bg`, `--accent`, `--blush`, `--danger`, `--bubble-mine`, etc.), consumed via Tailwind's `@theme inline` mapping (`bg-bg`, `text-ink`, `bg-accent`, ...) rather than Tailwind's default palette. There is intentionally no dark-mode variant. Body text uses Pretendard Variable (loaded via a CDN `<link>` in `app/layout.tsx`, not `next/font` — it isn't a Google font); `font-display` (Space Grotesk, `next/font/google`) is reserved for Latin/numeral-only moments (the "AI Chat" wordmark, `STEP n / 5`) to avoid mixing two CJK-covering font families. The `.orb-mark` class is the recurring AI/brand avatar (login/main hero, chat header, assistant message bubbles) — a two-tone radial gradient with an optional `.orb-mark--hero` breathing animation. Use `text-danger`, not Tailwind's default `red-*`, for error copy.
