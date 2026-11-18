# 위기 감지 경계 오탐 줄이기 (Kiwi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원문에 "자살"·"자해"가 들어 있어도 합성어("자살골")나 다른 단어의 일부("아자살자")면 109 안내를 무조건 띄우지 않고 Gemini의 문맥 판단에 맡긴다. 실제 위기 표현은 지금처럼 항상 안내한다.

**Architecture:** 기록 화면이 서버의 최종 판정(`messages.crisis`)을 믿도록 바꾼 뒤(Task 1), 서버에 Kiwi(WebAssembly 형태소 분석기)를 붙이고(Task 2), 사용자가 직접 쓰는 판정 규칙(Task 3)과 서버 연결·미리 준비(Task 4)를 더한다. 마지막으로 측정하고 Vercel 미리보기에서 확인한다(Task 5, 6). 모든 작업은 브랜치 `feat/kiwi-crisis-boundary`에서 하고, 브랜치를 올리면 Vercel이 미리보기를 자동으로 만든다.

**Tech Stack:** Next.js 16.3.5 App Router, TypeScript, Vitest 4, `kiwi-nlp` 0.24.1 (Apache-2.0), Kiwi 공식 모델 `kiwi_model_v0.24.1_base.tgz`, Vercel.

**Spec:** `docs/superpowers/specs/2026-11-18-crisis-kiwi-boundary-design.md`

## Global Constraints

- 미탐을 늘리지 않는 것이 오탐을 줄이는 것보다 우선이다. Kiwi 관련 실패(로딩 실패, 시간 초과, 분석 오류)는 모두 `direct` 유지로 끝난다.
- Kiwi 재검사 대상은 명사 키워드 `"자살"`, `"자해"`뿐이다. 구절 키워드("죽고 싶" 등)는 지금 규칙 그대로다.
- 패키지·모델 버전은 `kiwi-nlp@0.24.1`(정확히 고정), 모델 `v0.24.1` base로 고정한다. 모델(약 104MB)은 저장소에 넣지 않고 `prebuild`에서 내려받는다.
- 코드 출처 구분(`CLAUDE.md`, `docs/study/AUTHORSHIP.md`): Task 3의 `refineWithMorphemes` 함수 본문만 **직접**(사용자가 작성, 커밋 `Code-Origin: 직접`, Claude `Co-Authored-By` 줄 없음). 나머지는 모두 **바이브**(`Code-Origin: 바이브` + `Co-Authored-By`). 한 커밋에 섞지 않는다.
- 사용자의 직접 작성 코드(`lib/crisisDetection.ts`의 `crisisLevel` 등)는 Claude가 고치지 않는다. 새 함수와 상수만 같은 파일 끝에 더한다.
- 테스트 러너는 Vitest(`npm test` = `vitest run`). 각 태스크 끝에 `npm test`와 `npx tsc --noEmit`이 통과해야 한다.
- 이 Next.js는 canary 계열이다. 설정을 쓰기 전 `node_modules/next/dist/docs/`를 확인한다(`outputFileTracingIncludes`는 `01-app/03-api-reference/05-config/01-next-config-js/output.md`).
- 사용자는 단계마다 검토한다. 각 태스크 끝에서 멈추고 바뀐 점을 보고한 뒤 다음으로 넘어간다.

## Review Focus

- **Kiwi가 준비되기 전에 명사 키워드 메시지가 들어옴** → Gemini 답장은 정상으로 오고, 정해 둔 대기 시간 안에 Kiwi가 안 되면 `direct`(안내 표시). Task 4의 `decideCrisis` 테스트(`tokens = null`)가 고정한다.
- **한 문장에 합성어와 실제 위기 표현이 함께 있음**("자살골 때문에 졌어 진짜 죽고 싶다") → `direct`. Task 3 테스트가 고정한다.
- **이 기능 이전에 저장된 메시지(답변의 `crisis`가 비어 있음)** → 지금처럼 원문 규칙으로 안내. Task 1 테스트(`crisis` 없음/`null`)가 고정한다.
- **빌드 서버에 모델 다운로드가 실패함**(네트워크, 주소 변경) → 빌드가 실패해야 한다(조용히 모델 없이 배포되면 안 됨). Task 2의 스크립트가 `curl -f`로 실패를 그대로 올린다.
- **준비 요청(`GET /api/chat`)이 실패하거나 느림** → 채팅 화면은 영향받지 않는다. Task 4에서 화면은 결과를 기다리지 않고 `catch`로 무시한다.

---

### Task 0: 작업 브랜치와 DB 칸 확인

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: 브랜치 만들기**

```bash
cd ~/projects/ai-chat && git switch master && git pull --ff-only && git switch -c feat/kiwi-crisis-boundary
```

- [ ] **Step 2: `messages.crisis` 칸 정의 확인**

Supabase MCP `execute_sql`(프로젝트 `ukfbzlxqixraahrcvhxz`)로 아래를 실행한다. 실패하면 사용자에게 대시보드 SQL Editor에서 같은 쿼리를 실행해 결과를 알려 달라고 한다.

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'messages' and column_name = 'crisis';
```

Expected: 한 줄. `is_nullable`과 `column_default`를 기록한다. 이 값으로 Task 1의 "옛 메시지" 처리가 정해진다: NULL 허용·기본값 없음이면 옛 메시지는 `null`로 구분된다. 기본값이 `false`면 옛 메시지를 구분할 수 없으므로 저장값을 따른다(스펙: 테스트 계정 데이터뿐이라 허용).

- [ ] **Step 3: `supabase/schema.sql`에 칸 정의 맞추기**

`messages` 테이블 정의 아래에 확인한 정의 그대로 한 줄 추가한다. 예(확인 결과가 `boolean`, NULL 허용, 기본값 없음일 때):

```sql
-- 위기 안내 띠를 붙일지 (서버의 최종 판정, AI 답변 행에 저장). 2026-11-05에 추가.
alter table messages add column if not exists crisis boolean;
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql
git commit -m "Record the messages.crisis column in schema.sql

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: 기록 화면이 저장된 판정을 믿게 하기 (동작 변화 없음)

**Files:**
- Modify: `lib/crisisNotice.ts` (`crisisNoticeAfter`, `Message` 타입)
- Modify: `lib/chatHistory.ts:3-9` (`StoredMessage.crisis` 타입과 주석)
- Test: `lib/crisisNotice.test.ts`

**Interfaces:**
- Produces: `crisisNoticeAfter(messages: readonly { role; content; crisis?: boolean | null }[], loading: boolean): Set<number>` (이름·반환은 그대로, `crisis`에 `null` 허용)

- [ ] **Step 1: 실패하는 테스트 추가** (`lib/crisisNotice.test.ts`의 `describe("crisisNoticeAfter…")` 안 끝에)

```ts
  // 서버의 최종 판정(답변의 crisis)이 저장돼 있으면 그 값을 따른다. 원문을 다시 검사하지 않는다.
  it("저장된 판정이 false면 원문에 키워드가 있어도 붙이지 않는다", () => {
    const messages = [user("어제 축구에서 자살골 넣었어"), { ...ai("아쉬웠겠네요"), crisis: false }];
    expect(crisisNoticeAfter(messages, false).size).toBe(0);
  });

  it("저장된 판정이 true면 붙인다", () => {
    const messages = [user("나 자살하고 싶어"), { ...ai("많이 힘드셨군요"), crisis: true }];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([1]);
  });

  it("판정이 저장되기 전 메시지(crisis가 null)는 원문 규칙으로 붙인다", () => {
    const messages = [user("죽고싶다"), { ...ai("많이 힘드셨군요"), crisis: null }];
    expect([...crisisNoticeAfter(messages, false)]).toEqual([1]);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run lib/crisisNotice.test.ts`
Expected: "저장된 판정이 false면…" 1개 FAIL(지금은 원문 `direct`라 붙임). 나머지 PASS.

- [ ] **Step 3: 구현** (`lib/crisisNotice.ts`)

`type Message`를 바꾼다:

```ts
type Message = { role: "user" | "assistant"; content: string; crisis?: boolean | null };
```

`crisisNoticeAfter` 안의 판정 두 줄을 아래로 바꾼다(위 주석의 "crisis 칸이 생기기 전…" 줄도 함께 고친다):

```ts
// 다음 AI 답변에 서버의 최종 판정(crisis)이 저장돼 있으면 그 값만 따른다. 서버는 원문 검사,
// 형태소 재검사, AI 판단을 모두 거쳐 판정하므로 화면에서 원문을 다시 검사하면 안 된다.
// 판정이 없을 때(저장 전 옛 메시지, 답변 없이 끝난 메시지)만 원문 direct로 대신한다.
    const next = messages[i + 1];
    const stored = next?.role === "assistant" && typeof next.crisis === "boolean" ? next.crisis : null;
    const show = stored ?? crisisLevel(message.content) === "direct";
    if (!show) return;
```

(기존 `const direct = …`, `const judgedCrisis = …`, `if (!direct && !judgedCrisis) return;` 세 줄을 대체한다. 그 아래 `if (next?.role === "assistant") … else if …` 블록은 그대로 둔다.)

- [ ] **Step 4: 기존 테스트가 여전히 맞는지 확인**

기존 테스트의 `ai(...)`는 `crisis`가 없으므로 원문 규칙으로 판정된다. 단 "정규화로만 걸렸어도 AI가 위기라고 판단하면(crisis) 답변 밑에 붙인다"는 `crisis: true`라 저장값으로 통과한다. "정규화로만 걸렸고 AI가 위기가 아니라고 보면 붙이지 않는다"는 `crisis` 없음 → 원문 `normalized` → 안 붙음으로 통과한다.

Run: `npx vitest run lib/crisisNotice.test.ts`
Expected: 전부 PASS.

- [ ] **Step 5: `StoredMessage` 타입 맞추기** (`lib/chatHistory.ts`)

```ts
  // 서버의 최종 판정: AI 답변 밑에 위기 안내 띠를 붙일지. DB messages.crisis.
  // 판정이 생기기 전 저장된 행은 null일 수 있다(그때는 화면이 원문 규칙으로 대신한다).
  crisis?: boolean | null;
```

`getDayMessages`는 DB 값을 그대로 돌려주므로(`as StoredMessage[]`) 바꾸지 않는다. `appendDayMessage`의 `crisis: message.crisis ?? false`도 그대로 둔다(새로 저장하는 행은 항상 판정이 있다).

- [ ] **Step 6: 전체 테스트와 타입 검사**

Run: `npm test && npx tsc --noEmit`
Expected: 테스트 전부 PASS, 타입 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add lib/crisisNotice.ts lib/crisisNotice.test.ts lib/chatHistory.ts
git commit -m "Trust the stored crisis verdict when placing the notice

The server already decides the final verdict and the browser stores it on
the assistant row, but crisisNoticeAfter re-ran crisisLevel() on every
render. Once the server refines direct hits with morphemes, that re-check
would put the notice back on 자살골. Now the stored value wins; the raw
rule is only a fallback for rows saved before the verdict existed and
for messages whose reply failed.

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: 사용자 검토** — 바뀐 점(화면 동작은 그대로, 판정 출처만 바뀜)을 보고하고 다음 태스크 진행 여부를 묻는다.

---

### Task 2: Kiwi 연결 (모델 내려받기, 로더, 배포 설정)

**Files:**
- Create: `scripts/fetch-kiwi-model.mjs`
- Create: `lib/kiwi.ts`
- Create: `lib/kiwi.test.ts`
- Modify: `package.json` (의존성, `prebuild`, `pretest`)
- Modify: `next.config.ts`
- Modify: `.gitignore`
- Modify: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Produces (`lib/kiwi.ts`):
  - `export type MorphToken = { form: string; tag: string; wordPosition: number };`
  - `export function getKiwi(): Promise<Kiwi>` — 한 번만 만들고 보관. 실패하면 다음 호출에서 다시 시도.
  - `export async function analyzeTokens(text: string): Promise<MorphToken[]>`

- [ ] **Step 1: 패키지 설치**

```bash
npm install kiwi-nlp@0.24.1 --save-exact
```

- [ ] **Step 2: 모델 내려받기 스크립트** (`scripts/fetch-kiwi-model.mjs`)

```js
// 빌드·테스트 전에 Kiwi 공식 모델(v0.24.1 base, 약 104MB)을 kiwi-model/에 받는다.
// 모델을 GitHub에 올리지 않으려는 방법. 이미 있으면 건너뛴다. 실패하면 빌드도 실패한다(curl -f).
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dest = path.resolve("kiwi-model");
if (existsSync(path.join(dest, "cong.mdl"))) {
  console.log("kiwi-model: already present");
  process.exit(0);
}
const url = "https://github.com/bab2min/Kiwi/releases/download/v0.24.1/kiwi_model_v0.24.1_base.tgz";
const work = path.join(tmpdir(), "kiwi-model-dl");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
execSync(`curl -fsSL "${url}" -o "${work}/model.tgz" && tar -xzf "${work}/model.tgz" -C "${work}"`, { stdio: "inherit" });
const src = path.join(work, "models/cong/base");
mkdirSync(dest, { recursive: true });
// Vercel 빌드 서버는 /tmp가 다른 디스크라 rename이 실패한다(EXDEV). 복사한다.
for (const name of readdirSync(src)) copyFileSync(path.join(src, name), path.join(dest, name));
rmSync(work, { recursive: true, force: true });
console.log("kiwi-model: downloaded", readdirSync(dest).join(", "));
```

- [ ] **Step 3: `package.json` 스크립트와 `.gitignore`**

`scripts`에 추가:

```json
    "prebuild": "node scripts/fetch-kiwi-model.mjs",
    "pretest": "node scripts/fetch-kiwi-model.mjs",
```

`.gitignore` 끝에 추가:

```
# 빌드·테스트 때 내려받는 Kiwi 모델 (scripts/fetch-kiwi-model.mjs)
/kiwi-model
```

Run: `node scripts/fetch-kiwi-model.mjs`
Expected: `kiwi-model: downloaded combiningRule.txt, cong.mdl, …` (두 번째 실행은 `already present`)

- [ ] **Step 4: 실패하는 테스트** (`lib/kiwi.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { analyzeTokens } from "./kiwi";

// 실제 모델로 Kiwi가 우리가 기대하는 모양으로 쪼개는지 확인한다(판정 규칙의 전제).
// 실험(2026-11-18)에서 본 결과를 고정해 두어, 모델 버전이 바뀌면 바로 알 수 있게 한다.
describe("analyzeTokens (실제 Kiwi 모델)", () => {
  it("합성 명사 자살골을 같은 어절의 자살 + 골로 쪼갠다", async () => {
    const tokens = await analyzeTokens("어제 축구에서 자살골 넣었어");
    const i = tokens.findIndex((t) => t.form === "자살");
    expect(tokens[i]).toMatchObject({ tag: "NNG" });
    expect(tokens[i + 1]).toMatchObject({ form: "골", tag: "NNG", wordPosition: tokens[i].wordPosition });
  }, 30_000);

  it("아자살자는 자살자라는 다른 토큰으로 본다", async () => {
    const forms = (await analyzeTokens("아자살자")).map((t) => t.form);
    expect(forms).toContain("자살자");
    expect(forms).not.toContain("자살");
  }, 30_000);

  it("혼자 쓰인 자살 뒤에는 접미사(하)가 온다", async () => {
    const tokens = await analyzeTokens("나 자살하고 싶어");
    const i = tokens.findIndex((t) => t.form === "자살");
    expect(tokens[i + 1]).toMatchObject({ form: "하", tag: "XSV" });
  }, 30_000);
});
```

Run: `npx vitest run lib/kiwi.test.ts`
Expected: FAIL (`./kiwi` 모듈 없음)

- [ ] **Step 5: 로더 구현** (`lib/kiwi.ts`)

```ts
// Kiwi(한국어 형태소 분석기, kiwi-nlp 0.24.1, Apache-2.0)를 서버 메모리에 한 번만 올려 두고 쓴다.
// 모델 파일은 scripts/fetch-kiwi-model.mjs가 빌드 전에 kiwi-model/에 받는다.
// 첫 준비는 Vercel에서 약 5초(2026-11-18 측정)라서, 채팅방 진입 시 미리 준비한다(app/api/chat GET).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { KiwiBuilder, type Kiwi } from "kiwi-nlp";

export type MorphToken = { form: string; tag: string; wordPosition: number };

let loading: Promise<Kiwi> | null = null;

async function load(): Promise<Kiwi> {
  const builder = await KiwiBuilder.create(
    path.join(process.cwd(), "node_modules/kiwi-nlp/dist/kiwi-wasm.wasm")
  );
  const dir = path.join(process.cwd(), "kiwi-model");
  const modelFiles: Record<string, Uint8Array> = {};
  for (const name of readdirSync(dir)) {
    modelFiles[name] = new Uint8Array(readFileSync(path.join(dir, name)));
  }
  // 위키데이터 고유명사 사전은 판정에 필요 없고, 끄면 준비가 빨라진다(실험: 1.2초 → 0.55초).
  return builder.build({ modelFiles, loadMultiDict: false });
}

export function getKiwi(): Promise<Kiwi> {
  if (!loading) {
    loading = load().catch((error) => {
      loading = null; // 실패하면 다음 호출에서 다시 시도한다
      throw error;
    });
  }
  return loading;
}

export async function analyzeTokens(text: string): Promise<MorphToken[]> {
  const kiwi = await getKiwi();
  return kiwi.analyze(text).tokens.map((t) => ({ form: t.str, tag: t.tag, wordPosition: t.wordPosition }));
}
```

`kiwi-nlp`가 `Kiwi` 타입을 내보내지 않으면 `type Kiwi = Awaited<ReturnType<KiwiBuilder["build"]>>;`로 바꾼다(실험 코드에서 쓴 방식).

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run lib/kiwi.test.ts`
Expected: 3 PASS

- [ ] **Step 7: 배포 설정** (`next.config.ts`)

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // kiwi-nlp는 wasm 파일을 직접 읽으므로 번들하지 않고 node_modules에서 그대로 쓴다.
  serverExternalPackages: ["kiwi-nlp"],
  // 빌드 때 받은 Kiwi 모델과 wasm을 /api/chat 함수 배포 파일에 넣는다.
  outputFileTracingIncludes: {
    "/api/chat": ["./kiwi-model/**/*", "./node_modules/kiwi-nlp/dist/kiwi-wasm.wasm"],
  },
};

export default nextConfig;
```

- [ ] **Step 8: 빌드에 모델이 들어가는지 확인**

Run: `npm run build && python3 -c "import json;d=json.load(open('.next/server/app/api/chat/route.js.nft.json'));print([f for f in d['files'] if 'kiwi' in f][:3])"`
Expected: 빌드 성공, `kiwi-model/...`과 `kiwi-wasm.wasm` 경로가 출력됨

- [ ] **Step 9: 라이선스 표기** (`THIRD_PARTY_NOTICES.md` 끝에)

```md
## Kiwi (kiwi-nlp)

The crisis-detection morpheme check uses Kiwi, the Korean Intelligent Word Identifier:

- Package: kiwi-nlp 0.24.1 — https://www.npmjs.com/package/kiwi-nlp
- Model: kiwi_model_v0.24.1_base — https://github.com/bab2min/Kiwi/releases/tag/v0.24.1
- Copyright (c) bab2min
- Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)
```

- [ ] **Step 10: 전체 확인과 커밋**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 모두 통과

```bash
git add package.json package-lock.json scripts/fetch-kiwi-model.mjs lib/kiwi.ts lib/kiwi.test.ts next.config.ts .gitignore THIRD_PARTY_NOTICES.md
git commit -m "Load Kiwi on the server for the crisis morpheme check

kiwi-nlp 0.24.1 (wasm) with the official v0.24.1 base model, downloaded
at prebuild/pretest instead of committed (104MB) and traced into
/api/chat. getKiwi() builds it once per instance and retries after a
failure. Tests pin the token shapes the judgment rule relies on.

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 11: 사용자 검토** — 설치·설정·테스트 결과를 보고하고 Task 3(직접 작성) 시작 여부를 묻는다.

---

### Task 3: 판정 규칙 `refineWithMorphemes` (사용자 직접 작성)

**Files:**
- Modify: `lib/crisisDetection.ts` (파일 끝에 상수·타입·함수 뼈대 추가 → 본문은 사용자)
- Test: `lib/crisisMorphemes.test.ts` (Claude 작성)
- Modify: `docs/study/AUTHORSHIP.md` (직접 작성 목록 한 줄)
- Modify: `docs/study/algorithm-study-log.md` (§11 뒤 새 절, 면접 질문, §13)

**Interfaces:**
- Consumes: `MorphToken` (Task 2, `lib/kiwi.ts`) — `crisisDetection.ts`는 브라우저에서도 쓰이므로 `lib/kiwi.ts`를 import하지 않고 같은 모양의 타입을 따로 둔다.
- Produces (`lib/crisisDetection.ts`):
  - `export const NOUN_KEYWORDS = ["자살", "자해"] as const;`
  - `export type Token = { form: string; tag: string; wordPosition: number };`
  - `export function refineWithMorphemes(text: string, tokens: readonly Token[]): CrisisLevel`
    - `crisisLevel(text)`가 `direct`가 아니면 그대로 돌려준다.
    - 원문에 구절 키워드(`NOUN_KEYWORDS`가 아닌 키워드)가 그대로 있으면 `direct`.
    - 명사 키워드와 형태가 같은 명사 토큰(`tag`가 `NN`으로 시작)이 있고, 그 바로 다음 토큰이 **같은 어절의 명사가 아니면** `direct`. 하나라도 있으면 `direct`.
    - 그 밖(합성어뿐이거나, 같은 형태의 토큰이 없음)은 `normalized`.

- [ ] **Step 1 (Claude): 테스트 작성** (`lib/crisisMorphemes.test.ts`) — 토큰은 2026-11-18 실험의 실제 Kiwi 출력이다.

```ts
import { describe, expect, it } from "vitest";
import { refineWithMorphemes, type Token } from "./crisisDetection";

const t = (form: string, tag: string, wordPosition: number): Token => ({ form, tag, wordPosition });

describe("refineWithMorphemes: 형태소로 direct 다시 보기", () => {
  it("혼자 쓰인 명사(자살+하다)는 direct 유지", () => {
    const tokens = [t("나", "NP", 0), t("자살", "NNG", 1), t("하", "XSV", 1), t("고", "EC", 1), t("싶", "VX", 2), t("어", "EC", 2)];
    expect(refineWithMorphemes("나 자살하고 싶어", tokens)).toBe("direct");
  });

  it("자해도 같은 규칙: 자해했어는 direct", () => {
    const tokens = [t("자해", "NNG", 0), t("하", "XSV", 0), t("었", "EP", 0), t("어", "EF", 0)];
    expect(refineWithMorphemes("자해했어", tokens)).toBe("direct");
  });

  it("어절 끝에 혼자 쓰인 명사(자살 생각)는 direct 유지", () => {
    const tokens = [t("자살", "NNG", 0), t("생각", "NNG", 1), t("이", "JKS", 1), t("나", "VV", 2), t("요", "EF", 2)];
    expect(refineWithMorphemes("자살 생각이 나요", tokens)).toBe("direct");
  });

  it("합성어(자살골)는 normalized로 낮춘다", () => {
    const tokens = [t("어제", "MAG", 0), t("축구", "NNG", 1), t("에서", "JKB", 1), t("자살", "NNG", 2), t("골", "NNG", 2), t("넣", "VV", 3), t("었", "EP", 3), t("어", "EF", 3)];
    expect(refineWithMorphemes("어제 축구에서 자살골 넣었어", tokens)).toBe("normalized");
  });

  it("합성어(자살충동)도 normalized (Gemini가 판단)", () => {
    const tokens = [t("자살", "NNG", 0), t("충동", "NNG", 0), t("이", "JKS", 0), t("들", "VV", 1), t("어", "EC", 1)];
    expect(refineWithMorphemes("자살충동이 들어", tokens)).toBe("normalized");
  });

  it("같은 형태의 토큰이 없으면(아자살자 → 자살자) normalized", () => {
    const tokens = [t("아", "IC", 0), t("자살자", "NNG", 0)];
    expect(refineWithMorphemes("아자살자", tokens)).toBe("normalized");
  });

  it("합성어와 혼자 쓰인 명사가 함께 있으면 direct", () => {
    const tokens = [t("자살", "NNG", 0), t("골", "NNG", 0), t("넣고", "VV", 1), t("자살", "NNG", 2), t("하", "XSV", 2), t("고", "EC", 2), t("싶", "VX", 3), t("다", "EF", 3)];
    expect(refineWithMorphemes("자살골 넣고 자살하고 싶다", tokens)).toBe("direct");
  });

  it("합성어가 있어도 구절 키워드(죽고 싶)가 원문에 있으면 direct", () => {
    const tokens = [t("자살", "NNG", 0), t("골", "NNG", 0), t("때문", "NNB", 1), t("에", "JKB", 1), t("죽", "VV", 2), t("고", "EC", 2), t("싶", "VX", 3), t("다", "EF", 3)];
    expect(refineWithMorphemes("자살골 때문에 죽고 싶다", tokens)).toBe("direct");
  });

  it("원래 direct가 아니면 그대로 돌려준다", () => {
    expect(refineWithMorphemes("내일 모자 살 거야", [])).toBe("normalized");
    expect(refineWithMorphemes("오늘 점심 뭐 먹지", [])).toBe("none");
  });
});
```

- [ ] **Step 2 (Claude): 뼈대 추가** (`lib/crisisDetection.ts` 파일 끝) — 본문은 비워 두어 테스트가 실패하게 한다.

```ts
// 형태소로 direct 다시 보기 (설계: docs/superpowers/specs/2026-11-18-crisis-kiwi-boundary-design.md)
// 명사 키워드만 다시 본다. 구절 키워드("죽고 싶" 등)는 원문 규칙 그대로.
export const NOUN_KEYWORDS = ["자살", "자해"] as const;

// Kiwi 토큰 모양 (lib/kiwi.ts의 MorphToken과 같음). 이 파일은 브라우저에서도 쓰여서 kiwi를 import하지 않는다.
export type Token = { form: string; tag: string; wordPosition: number };

export function refineWithMorphemes(text: string, tokens: readonly Token[]): CrisisLevel {
  // TODO(직접 작성): 설계 문서의 판정 규칙 표대로 채운다.
  return crisisLevel(text);
}
```

Run: `npx vitest run lib/crisisMorphemes.test.ts`
Expected: 합성어·다른 토큰 3개 FAIL(지금은 direct를 그대로 돌려줌), 나머지 PASS

- [ ] **Step 3 (Claude): 테스트·뼈대 커밋 (바이브)**

```bash
git add lib/crisisMorphemes.test.ts lib/crisisDetection.ts
git commit -m "Add tests and a stub for refineWithMorphemes

Tokens in the tests are real Kiwi output from the 2026-11-18 spike. The
stub returns crisisLevel() unchanged; the user writes the body.

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4 (사용자): 함수 본문 작성** — Claude는 코드를 대신 쓰지 않는다. 막히면 단계별 힌트만 준다.
  - 힌트 1: 먼저 `crisisLevel(text)`가 `direct`가 아니면 바로 돌려준다.
  - 힌트 2: 구절 키워드는 `CRISIS_KEYWORDS` 중 `NOUN_KEYWORDS`에 없는 것. 원문에 그대로 있는지는 `text.includes`로 충분하다(이미 direct라 원문 기준).
  - 힌트 3: 토큰을 인덱스로 돌면서 `tokens[i]`가 명사 키워드이고 `tokens[i + 1]`이 "같은 어절(`wordPosition`)의 명사(`tag.startsWith("NN")`)"인지 본다. 마지막 토큰이면 다음이 없다.
  - 힌트 4: 하나라도 혼자 쓰인 명사가 있으면 즉시 `direct`. 반복이 끝나면 `normalized`.

Run: `npx vitest run lib/crisisMorphemes.test.ts`
Expected: 9 PASS

- [ ] **Step 5 (Claude): 리뷰** — 사용자 코드를 실행·검토하고 의견만 준다. 고칠 곳은 위치와 이유만 말한다(직접 작성 코드는 고치지 않는다). 함수 위에 헤더 한 줄만 추가해도 된다:

```ts
// [직접 작성] 형태소로 direct 다시 보기 (refineWithMorphemes 본문) — 학습 기록: docs/study/algorithm-study-log.md §12
```

- [ ] **Step 6 (사용자 커밋, 직접)**

```bash
git add lib/crisisDetection.ts
git commit -m "Refine direct crisis hits with morphemes

Compound nouns (자살골) and other words (자살자) drop to normalized so
Gemini judges them; a standalone noun or any phrase keyword stays direct.

Code-Origin: 직접"
```

- [ ] **Step 7 (Claude): 기록** — `docs/study/AUTHORSHIP.md` 직접 작성 목록에 한 줄:

```md
| 2026-11-18 | `lib/crisisDetection.ts` | 형태소로 direct 다시 보기 `refineWithMorphemes` (9/9) | 함수 본문 전체(구절 키워드 확인, 토큰 순회, 합성어 판단) | 테스트 9개(실제 Kiwi 토큰), `NOUN_KEYWORDS`·`Token`·함수 뼈대, 힌트, 리뷰. Kiwi 로딩·서버 연결은 바이브 | §12 |
```

학습 기록에는 §11 뒤에 "12. 형태소로 경계 오탐 줄이기" 절(설정 · 디버깅 과정 표 · 핵심 교훈)을 넣고, 면접 예상 질문에 두 줄을 더한다:

| 질문 | 답 |
|---|---|
| 형태소 분석기를 왜 직접 만들지 않았나요? | 정확하지만 사전과 언어 모델이 필요해 직접 구현할 범위를 벗어난다. 검증된 Kiwi를 쓰고, 그 결과로 판정하는 규칙을 직접 설계했다. |
| Kiwi를 그대로 믿지 않은 이유는? | 실험해 보니 "자살골"을 자살 + 골로 쪼갰다. "자살 토큰이 있는가"만 보면 오탐이 그대로라서, 같은 어절에 명사가 붙는지로 합성어를 구분했다. |

(§12 이후 절 번호가 하나씩 밀린다. 현재 진도 절은 이름으로 찾는다.)

```bash
git add docs/study/AUTHORSHIP.md docs/study/algorithm-study-log.md
git commit -m "Log the morpheme refinement and register it as direct work

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 서버 연결 (동시 실행 + 미리 준비)

**Files:**
- Create: `lib/crisisDecision.ts`
- Create: `lib/crisisDecision.test.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/chat/page.tsx` (준비 요청 `useEffect`)

**Interfaces:**
- Consumes: `refineWithMorphemes`, `NOUN_KEYWORDS`, `crisisLevel` (Task 3), `analyzeTokens`, `getKiwi` (Task 2), `generateReplyWithCrisisJudgment` (`lib/ai.ts`)
- Produces (`lib/crisisDecision.ts`):
  - `export function needsMorphemeCheck(text: string): boolean` — `crisisLevel(text) === "direct"`이고 원문에 명사 키워드가 있을 때 true
  - `export function decideCrisis(text: string, tokens: readonly Token[] | null, judgedCrisis: boolean): boolean` — `tokens`가 `null`(Kiwi 실패·시간 초과)이면 `true`. 아니면 `refineWithMorphemes`가 `direct`면 `true`, `normalized`면 `judgedCrisis`.
  - `export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null>`
  - `export const KIWI_WAIT_MS = 8000;`

- [ ] **Step 1: 실패하는 테스트** (`lib/crisisDecision.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { decideCrisis, needsMorphemeCheck, withTimeout } from "./crisisDecision";

const tok = (form: string, tag: string, wordPosition: number) => ({ form, tag, wordPosition });
const 자살골 = [tok("자살", "NNG", 0), tok("골", "NNG", 0), tok("넣", "VV", 1), tok("었", "EP", 1), tok("어", "EF", 1)];

describe("needsMorphemeCheck", () => {
  it("명사 키워드가 원문에 있는 direct만 다시 본다", () => {
    expect(needsMorphemeCheck("자살골 넣었어")).toBe(true);
    expect(needsMorphemeCheck("죽고 싶어")).toBe(false); // 구절 키워드
    expect(needsMorphemeCheck("자 살")).toBe(false); // normalized
    expect(needsMorphemeCheck("안녕")).toBe(false);
  });
});

describe("decideCrisis", () => {
  it("Kiwi 결과가 없으면(실패·시간 초과) 안내한다", () => {
    expect(decideCrisis("자살골 넣었어", null, false)).toBe(true);
  });
  it("합성어면 Gemini 판단을 따른다", () => {
    expect(decideCrisis("자살골 넣었어", 자살골, false)).toBe(false);
    expect(decideCrisis("자살골 넣었어", 자살골, true)).toBe(true);
  });
  it("혼자 쓰인 명사면 Gemini 판단과 상관없이 안내한다", () => {
    const tokens = [tok("자살", "NNG", 0), tok("하", "XSV", 0), tok("고", "EC", 0), tok("싶", "VX", 1), tok("어", "EF", 1)];
    expect(decideCrisis("자살하고 싶어", tokens, false)).toBe(true);
  });
});

describe("withTimeout", () => {
  it("시간 안에 끝나면 값을, 넘으면 null을 돌려준다", async () => {
    expect(await withTimeout(Promise.resolve(1), 50)).toBe(1);
    expect(await withTimeout(new Promise((r) => setTimeout(() => r(1), 100)), 10)).toBeNull();
  });
  it("실패해도 null을 돌려준다", async () => {
    expect(await withTimeout(Promise.reject(new Error("x")), 50)).toBeNull();
  });
});
```

Run: `npx vitest run lib/crisisDecision.test.ts`
Expected: FAIL (모듈 없음)

- [ ] **Step 2: 구현** (`lib/crisisDecision.ts`)

```ts
// 서버의 최종 위기 판정을 정한다. Kiwi(서버 전용)와 사용자가 직접 쓴 refineWithMorphemes를 잇는다.
// Kiwi 관련 실패는 모두 "안내함"으로 끝난다(미탐을 늘리지 않는 것이 우선).
import { crisisLevel, NOUN_KEYWORDS, refineWithMorphemes, type Token } from "./crisisDetection";

// Gemini 답장(보통 2~4초)과 동시에 기다린다. 첫 준비가 Vercel에서 약 5초라 여유를 둔다.
export const KIWI_WAIT_MS = 8000;

export function needsMorphemeCheck(text: string): boolean {
  return crisisLevel(text) === "direct" && NOUN_KEYWORDS.some((k) => text.includes(k));
}

export function decideCrisis(text: string, tokens: readonly Token[] | null, judgedCrisis: boolean): boolean {
  if (tokens === null) return true;
  return refineWithMorphemes(text, tokens) === "direct" ? true : judgedCrisis;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(null); }
    );
  });
}
```

Run: `npx vitest run lib/crisisDecision.test.ts`
Expected: 전부 PASS

- [ ] **Step 3: 라우트 연결** (`app/api/chat/route.ts`)

import에 추가:

```ts
import { getKiwi, analyzeTokens } from "@/lib/kiwi";
import { decideCrisis, KIWI_WAIT_MS, needsMorphemeCheck, withTimeout } from "@/lib/crisisDecision";
```

`POST`의 `try` 블록 안 판정 부분을 아래로 바꾼다(위 주석에 "명사 키워드 direct는 형태소로 다시 본다" 한 줄 추가):

```ts
    const text = lastUserMessage?.content ?? "";

    if (level === "normalized") {
      const judged = await generateReplyWithCrisisJudgment(messages, withContext(CRISIS_JUDGE_CONTEXT));
      reply = judged.reply;
      crisis = judged.crisis;
    } else if (needsMorphemeCheck(text)) {
      // 명사 키워드("자살", "자해")가 원문에 있는 direct: 합성어("자살골")일 수 있다.
      // Gemini에게 판단 칸을 함께 받으면서, 그동안 Kiwi로 형태소를 본다(둘을 동시에 시작).
      const [judged, tokens] = await Promise.all([
        generateReplyWithCrisisJudgment(messages, withContext(CRISIS_JUDGE_CONTEXT)),
        withTimeout(analyzeTokens(text), KIWI_WAIT_MS),
      ]);
      reply = judged.reply;
      crisis = decideCrisis(text, tokens, judged.crisis);
    } else {
      reply = await generateReply(
        messages,
        level === "direct" ? withContext(CRISIS_NOTICE_CONTEXT) : context
      );
      crisis = level === "direct";
    }
```

파일 끝에 준비용 `GET`을 추가한다:

```ts
// 채팅방에 들어오면 화면이 한 번 보낸다(결과는 안 기다림). 같은 라우트라 같은 함수 인스턴스에
// Kiwi가 올라가, 사용자가 입력하는 동안 첫 준비(약 5초)를 끝내 둔다.
export async function GET() {
  await getKiwi().catch((error) => console.error("Kiwi 준비 실패", error));
  return new Response(null, { status: 204 });
}
```

- [ ] **Step 4: 채팅방 진입 시 준비 요청** (`app/chat/page.tsx`, 첫 `useEffect` 앞에)

```tsx
  // Kiwi(위기 판정용 형태소 분석기)를 미리 준비시킨다. 화면은 결과를 기다리지 않는다.
  useEffect(() => {
    fetch("/api/chat", { method: "GET" }).catch(() => {});
  }, []);
```

- [ ] **Step 5: 로컬 수동 확인**

Run: `npm run build && npx next start -p 3107` (다른 터미널)
그다음 `curl -s -o /dev/null -w "%{http_code} %{time_total}\n" http://localhost:3107/api/chat` 두 번.
Expected: `204` 두 번. 두 번째가 훨씬 빠름. (POST 경로는 Gemini 키가 필요하므로 Task 6에서 미리보기로 확인)

- [ ] **Step 6: 전체 확인과 커밋**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: 모두 통과

```bash
git add lib/crisisDecision.ts lib/crisisDecision.test.ts app/api/chat/route.ts app/chat/page.tsx
git commit -m "Refine direct noun hits with Kiwi in /api/chat and warm it on entry

When a direct hit contains 자살 or 자해, the route asks Gemini for a
crisis verdict and runs Kiwi at the same time; refineWithMorphemes
decides whether the hit stands. Any Kiwi failure or an 8s wait keeps the
notice. The chat page sends one GET on entry so Kiwi is ready by the
time the user types.

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: 사용자 검토**

---

### Task 5: 측정 (경계 오탐 문장 추가, 47문장 다시 재기)

**Files:**
- Modify: `lib/crisisEval.data.ts` (새 kind `compound` 문장)
- Modify: `lib/crisisDetection.eval.test.ts` (형태소 적용 후 결과 표 + 보장 검사)
- Modify: `docs/study/algorithm-study-log.md` (§12 측정 결과)

- [ ] **Step 1: 평가 문장 추가** (`lib/crisisEval.data.ts`)

`EvalKind`에 `"compound"`를 더하고(주석: `compound  키워드가 합성어나 다른 단어의 일부로 들어간 일상 문장 → 형태소로 normalized가 돼야 함`), 목록 끝에:

```ts
  // compound (5): 형태소 재검사 대상 (2026-11-18)
  { text: "어제 축구에서 자살골 넣었어", crisis: false, kind: "compound" },
  { text: "자살골 때문에 경기 졌어", crisis: false, kind: "compound" },
  { text: "아자살자 오늘도 힘내자", crisis: false, kind: "compound" },
  { text: "자해방지 교육 들었어", crisis: false, kind: "compound" },
  { text: "자살충동이 자꾸 들어", crisis: true, kind: "compound" },
```

마지막 문장은 합성어지만 실제 위기다. 형태소로는 normalized가 되고 Gemini가 잡아야 한다(측정 대상).

- [ ] **Step 2: 형태소 적용 측정 추가** (`lib/crisisDetection.eval.test.ts` 끝)

```ts
import { analyzeTokens } from "./kiwi";
import { refineWithMorphemes } from "./crisisDetection";

describe("형태소 재검사 후 측정 (실제 Kiwi)", () => {
  it("결과 표와 보장 검사", async () => {
    const refined = [];
    for (const s of CRISIS_EVAL_SET) {
      const level = crisisLevel(s.text);
      const after = level === "direct" ? refineWithMorphemes(s.text, await analyzeTokens(s.text)) : level;
      refined.push({ ...s, before: level, after });
    }
    console.table(refined.filter((r) => r.before !== r.after).map((r) => ({ 문장: r.text, 정답위기: r.crisis, 전: r.before, 후: r.after })));
    // 그대로 쓴 위기 표현은 하나도 낮아지지 않는다(미탐 0 유지)
    expect(refined.filter((r) => r.kind === "explicit" && r.after !== "direct").map((r) => r.text)).toEqual([]);
    // 합성어 일상 문장은 direct가 아니게 된다
    expect(refined.filter((r) => r.kind === "compound" && !r.crisis && r.after === "direct").map((r) => r.text)).toEqual([]);
  }, 60_000);
});
```

(맨 위 import에 `analyzeTokens`, `refineWithMorphemes`를 합친다. `countBy`의 `kinds` 배열에도 `"compound"`를 더한다.)

- [ ] **Step 3: 실행과 기록**

Run: `npx vitest run lib/crisisDetection.eval.test.ts`
Expected: PASS. 새 문장 중 Kiwi가 실험과 다르게 쪼개는 것이 있어 보장 검사가 실패하면, 검사를 고쳐 맞추지 말고 그 문장과 토큰을 사용자에게 보여 주고 판정 규칙을 바꿀지 함께 정한다(바꾸면 Task 3의 직접 작성 범위). 출력 표를 학습 기록 §12 "측정"에 옮긴다(전/후 판정이 바뀐 문장, explicit 미탐 0, compound 일상 4개 direct 0). "자살충동이 자꾸 들어"의 Gemini 판단은 Task 6에서 미리보기로 확인해 같은 절에 적는다.

- [ ] **Step 4: 커밋**

```bash
git add lib/crisisEval.data.ts lib/crisisDetection.eval.test.ts docs/study/algorithm-study-log.md
git commit -m "Measure the morpheme refinement on compound-word sentences

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Vercel 미리보기 확인, 문서, 병합

**Files:**
- Modify: `README.md` (위기 감지 섹션: 형태소 재검사, 측정, 한계)
- Modify: `docs/study/algorithm-study-log.md` (§12 배포 측정, 현재 진도)

- [ ] **Step 1: 브랜치 올리기**

```bash
git push -u origin feat/kiwi-crisis-boundary
```

Vercel MCP `list_deployments`(team `team_2y9OmjqrD5N1bEDOsHLnY8Rm`, branch `feat/kiwi-crisis-boundary`)로 READY를 기다린다. 빌드 로그에 `kiwi-model: downloaded`가 있어야 한다.

- [ ] **Step 2: 준비 시간 측정**

`web_fetch_vercel_url`로 미리보기의 `GET /api/chat`을 두 번 부른다. 첫 번째 응답 시간(콜드)과 두 번째(웜)를 적는다.

- [ ] **Step 3: 사용자와 실제 대화 확인** — 사용자가 미리보기 주소에서 로그인해 채팅방에 들어간 뒤 5초 정도 지나 아래를 보낸다. 안내 띠 여부와 체감 지연을 함께 본다.

| 보낼 문장 | 기대 |
|---|---|
| 어제 축구에서 자살골 넣었어 | 안내 띠 없음 |
| 자살충동이 자꾸 들어 | 안내 띠 있음 (Gemini 판단) |
| 나 자살하고 싶어 | 안내 띠 있음 |
| 오늘 점심 뭐 먹지 | 안내 띠 없음, 지연 없음 |

그다음 `/chats`에서 오늘 기록을 열어 위 결과와 안내 띠가 같은지 본다(Task 1).

- [ ] **Step 4: 문서 갱신** — README 위기 감지 섹션에 형태소 재검사 단계와 측정(Task 5 표, Step 2·3 결과), 한계("자살 예방 캠페인" 같은 독립어 오탐은 남음, 첫 준비 약 5초를 진입 시 미리 준비로 숨김)를 추가한다. 학습 기록 현재 진도를 갱신한다.

```bash
git add README.md docs/study/algorithm-study-log.md
git commit -m "Document the Kiwi morpheme refinement and its preview measurements

Code-Origin: 바이브
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: 병합** — 사용자 승인 후:

```bash
git switch master && git merge --no-ff feat/kiwi-crisis-boundary -m "Merge feat/kiwi-crisis-boundary" && git push origin master
git branch -d feat/kiwi-crisis-boundary && git push origin --delete feat/kiwi-crisis-boundary
```

프로덕션 배포가 READY인지 확인하고, 같은 네 문장을 실제 서비스에서 한 번 더 확인한다.

- [ ] **Step 6: 취준 자료 갱신 안내** — 취준 저장소(`~/projects/chwijun`)의 자소서 직무 강점·포트폴리오 PDF 트러블슈팅 쪽에 반영할 내용을 사용자에게 정리해 준다(실제 수정은 사용자가 원할 때).
