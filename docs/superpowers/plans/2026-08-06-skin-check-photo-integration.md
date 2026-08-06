# 피부질환 사진 분류 - 증상체크 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/symptom-check` 위저드에서 `bodyPart === "피부"`일 때 사진을 첨부하면, 로컬 `ml-service`(학습된 EfficientNet-B0, `ml-service/skin_model.pth`)가 분류한 결과를 Gemini 프롬프트에 컨텍스트로 주입해 더 정확한 안내를 받는다.

**Architecture:** Next.js Route Handler(`app/api/symptom-check/route.ts`)가 base64 사진을 받아 `lib/skinClassifier.ts`를 통해 로컬 `ml-service`(`POST http://localhost:8000/predict`, FastAPI)를 호출하고, 그 결과를 `lib/symptomCheck.ts`의 프롬프트 빌더에 텍스트 컨텍스트로 삽입한 뒤 `lib/gemini.ts`를 직접 호출한다. 사진이 없는 기존 요청은 그대로 `lib/ai.ts`의 `generateReply`(이 브랜치에서는 Ollama 기본) 경로를 탄다. `ml-service`가 꺼져 있거나 응답이 없으면 분류 없이 기존 텍스트 전용 플로우로 자동 폴백한다.

**Tech Stack:** Next.js App Router(canary) Route Handler, React 19 클라이언트 컴포넌트(`FileReader` base64 인코딩), FastAPI `ml-service`(기존 구현 완료, PR #1 머지됨).

## Global Constraints

- 레포에 Next.js용 테스트 러너가 없음(`CLAUDE.md` 명시) — 각 태스크는 `npx tsc --noEmit` + `npm run lint`로 정적 검증하고, 실제 동작은 curl / 브라우저 수동 스모크 테스트로 검증한다.
- `ml-service`는 로컬 전용이며 절대 배포되지 않는다 — 사진 분류 호출이 실패(타임아웃/연결거부)해도 사용자에게 에러를 노출하지 말고 텍스트 전용 플로우로 조용히 폴백한다(기존 `symptomHistory` 저장 실패 처리와 동일한 best-effort 패턴).
- 분류는 `bodyPart === "피부"`일 때만 UI에 노출한다.
- 사진이 포함된 요청은 `lib/ai.ts`의 `generateReply`(Ollama 자동전환)를 거치지 않고 `lib/gemini.ts`를 직접 호출한다 — 분류 결과와 증상의 일치 여부 검증은 Gemini가 맡는다는 설계 스펙(`docs/superpowers/specs/2026-07-31-skin-check-design.md`)의 결정을 그대로 따른다.
- 이 브랜치(`local-ollama`)에서 작업 완료 후, `master`(Gemini 전용 배포 브랜치)로 선택적으로 포팅한다 — `lib/ai.ts`를 건드리지 않는 변경이므로 그대로 cherry-pick 가능.
- 기존 스타일 컨벤션 유지: `text-danger`(에러), `rounded-2xl`/`border-line`/`bg-surface`(카드), `bg-accent`(강조 버튼) 등 `app/symptom-check/page.tsx`에 이미 쓰인 클래스 재사용.

---

### Task 1: `lib/skinClassifier.ts` — ml-service 클라이언트

**Files:**
- Create: `lib/skinClassifier.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `classifySkinPhoto(photoDataUrl: string): Promise<SkinClassification | null>`, `describeClassification(classification: SkinClassification): string`, `type SkinClassification = { class: string; confidence: number }` — Task 3에서 소비.

- [ ] **Step 1: `lib/skinClassifier.ts` 작성**

```ts
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export type SkinClassification = {
  class: string;
  confidence: number;
};

// ml-service/organize_ham10000.py의 TARGET_CLASSES(HAM10000 dx 코드)와 1:1 대응.
// classes.json 순서가 바뀌면(재학습 시 클래스 조합을 바꾸면) 이 맵도 함께 갱신할 것.
const CLASS_LABELS: Record<string, string> = {
  akiec: "광선각화증/보웬병(전암성 병변) 의심 소견",
  bcc: "기저세포암 의심 소견",
  df: "피부섬유종(양성 종양) 의심 소견",
  vasc: "혈관종/혈관 관련 병변 의심 소견",
};

export async function classifySkinPhoto(
  photoDataUrl: string
): Promise<SkinClassification | null> {
  const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64Data] = match;

  try {
    const bytes = Buffer.from(base64Data, "base64");
    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: mimeType }), "photo.jpg");

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (typeof data.class !== "string" || typeof data.confidence !== "number") {
      return null;
    }
    return { class: data.class, confidence: data.confidence };
  } catch {
    // ml-service가 꺼져있거나(연결 거부), 8초 내 응답이 없는 경우(AbortSignal.timeout) —
    // 두 경우 모두 분류 없이 텍스트 전용 플로우로 폴백시키는 게 목적이므로 에러를 삼킨다.
    return null;
  }
}

export function describeClassification(classification: SkinClassification): string {
  const label = CLASS_LABELS[classification.class] ?? classification.class;
  const percent = Math.round(classification.confidence * 100);
  return `${label} (모델 확신도 ${percent}%)`;
}
```

- [ ] **Step 2: `.env.local.example`에 `ML_SERVICE_URL` 추가**

`OLLAMA_MODEL=` 줄 바로 다음, `NEXT_PUBLIC_SUPABASE_URL=` 앞에 추가:

```
# Optional: local skin-classifier ml-service base URL (default http://localhost:8000).
# Dev-only — ml-service only listens on localhost, so this has no effect on
# a deployed/Vercel build (that path always falls back to text-only).
ML_SERVICE_URL=
```

- [ ] **Step 3: 정적 검증**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 에러 없이 통과.

- [ ] **Step 4: 커밋**

```bash
git add lib/skinClassifier.ts .env.local.example
git commit -m "Add ml-service client for skin photo classification"
```

---

### Task 2: `lib/symptomCheck.ts` — 분류 결과를 프롬프트에 주입

**Files:**
- Modify: `lib/symptomCheck.ts:21-46` (`buildSymptomPrompt`)

**Interfaces:**
- Consumes: 없음 (Task 1과 독립 — `classificationNote`는 단순 `string | undefined` 파라미터로 받음, `lib/skinClassifier.ts`를 직접 import하지 않음)
- Produces: `buildSymptomPrompt(input: SymptomInput, classificationNote?: string): string` — 기존 시그니처에 선택 파라미터만 추가. Task 3에서 소비.

- [ ] **Step 1: `buildSymptomPrompt` 수정**

`lib/symptomCheck.ts`의 기존 `buildSymptomPrompt` 함수 전체를 아래로 교체:

```ts
export function buildSymptomPrompt(input: SymptomInput, classificationNote?: string) {
  const classificationSection = classificationNote
    ? `\n[AI 이미지 분류 결과 (참고용)]
- 사용자가 첨부한 피부 사진을 로컬 딥러닝 모델이 분석한 결과: ${classificationNote}
- 이 결과가 사용자가 보고한 증상과 일치하는지 검토하세요. 일치하면 안내에 반영하고, 불일치하는 듯하면 이를 명시적으로 언급하며 병원 방문을 권장하세요.
- 확신도가 낮게 표기되어 있다면(60% 미만) 참고 정보로만 다루고 과신하지 마세요.\n`
    : "";

  return `당신은 사용자가 병원에 가기 전 참고할 수 있도록 도와주는 의료 정보 안내 도우미입니다.
아래 증상 정보를 바탕으로 가능성 있는 질환 후보와 방문하면 좋을 병원 진료과를 안내해주세요.

[증상 정보]
- 아픈 부위: ${input.bodyPart}
- 증상: ${input.symptoms.join(", ")}
- 지속 기간: ${input.duration}
- 통증/불편함 정도: ${input.severity}
- 추가 설명: ${input.note || "없음"}
${classificationSection}
규칙:
- 확정적인 진단 표현("~입니다") 대신 "~일 가능성이 있습니다" 같은 완곡한 표현을 사용하세요.
- 반드시 정확한 진단은 병원에서 받아야 한다는 점을 강조하세요.
- homeCare(응급처치·관리법)와 foods(추천 음식)는 병원 방문 전까지 집에서 시도해볼 수 있는 일반적이고 안전한 수준으로만 안내하고, 약물 복용량이나 구체적인 처치 지시는 하지 마세요. 증상이 심하거나 응급 상황일 수 있다고 판단되면 homeCare 항목에 즉시 병원 방문(또는 119)을 권하는 문구를 포함하세요.
- 아래 JSON 형식으로만 답변하고, 다른 텍스트나 마크다운 코드 블록은 포함하지 마세요.

{
  "conditions": ["가능성 있는 질환 후보 2~3개"],
  "departments": ["추천 진료과 1~2개, 예: 정형외과, 내과, 피부과 등"],
  "summary": "한두 문장으로 된 요약 설명",
  "disclaimer": "정확한 진단은 병원에서 받아야 한다는 안내 문구",
  "homeCare": ["집에서 시도해볼 수 있는 응급처치·관리법 2~4개"],
  "foods": ["증상 완화에 도움될 만한 음식/식이 요령 2~4개"]
}`;
}
```

`parseSymptomResult`와 기존 타입들은 변경하지 않는다.

- [ ] **Step 2: 정적 검증**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 둘 다 통과. (실제 동작은 Task 3의 curl 테스트에서 end-to-end로 검증 — 이 저장소에 Next.js용 테스트 러너가 없어 단위 테스트로 별도 격리 검증할 수단이 없음)

- [ ] **Step 3: 커밋**

```bash
git add lib/symptomCheck.ts
git commit -m "Inject skin-photo classification result into symptom-check prompt"
```

---

### Task 3: `app/api/symptom-check/route.ts` — 라우팅 로직

**Files:**
- Modify: `app/api/symptom-check/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `classifySkinPhoto`, `describeClassification`, `SkinClassification`(Task 1) / `buildSymptomPrompt(input, classificationNote?)`(Task 2) / `generateReply`(`lib/ai.ts`, 기존) / `generateReply as generateGeminiReply`(`lib/gemini.ts`, 기존)

- [ ] **Step 1: `route.ts` 전체 교체**

```ts
import { generateReply } from "@/lib/ai";
import { generateReply as generateGeminiReply } from "@/lib/gemini";
import { classifySkinPhoto, describeClassification } from "@/lib/skinClassifier";
import {
  buildSymptomPrompt,
  parseSymptomResult,
  type SymptomInput,
} from "@/lib/symptomCheck";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const input: SymptomInput = {
    bodyPart: body?.bodyPart ?? "",
    symptoms: Array.isArray(body?.symptoms) ? body.symptoms : [],
    duration: body?.duration ?? "",
    severity: body?.severity ?? "",
    note: body?.note ?? "",
  };
  const photo: string | undefined =
    typeof body?.photo === "string" && body.photo.length > 0
      ? body.photo
      : undefined;

  if (!input.bodyPart || input.symptoms.length === 0) {
    return Response.json(
      { error: "아픈 부위와 증상을 선택해주세요." },
      { status: 400 }
    );
  }

  try {
    const classification = photo ? await classifySkinPhoto(photo) : null;
    const classificationNote = classification
      ? describeClassification(classification)
      : undefined;
    const prompt = buildSymptomPrompt(input, classificationNote);
    const raw = photo
      ? await generateGeminiReply([{ role: "user", content: prompt }])
      : await generateReply([{ role: "user", content: prompt }]);
    const result = parseSymptomResult(raw);
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: ml-service + Next dev 서버 기동**

```bash
cd ml-service && source .venv/Scripts/activate && uvicorn serve:app --port 8000 &
cd .. && npm run dev &
```

- [ ] **Step 3: 사진 포함 요청 curl 스모크 테스트**

파일명은 `ls ml-service/organized/akiec | head -1`로 확인:

```bash
SAMPLE=$(ls ml-service/organized/akiec | head -1)
BASE64=$(base64 -w0 "ml-service/organized/akiec/$SAMPLE")
cat > /tmp/payload.json <<EOF
{"bodyPart":"피부","symptoms":["발진","가려움"],"duration":"며칠째","severity":"보통","note":"","photo":"data:image/jpeg;base64,$BASE64"}
EOF
curl -s -X POST http://localhost:3000/api/symptom-check -H "Content-Type: application/json" -d @/tmp/payload.json
```

Expected: `{"conditions": [...], "departments": [...], "summary": "...", ...}` 형태 JSON. `GEMINI_API_KEY`가 `.env.local`에 설정돼 있어야 함(기존 요구사항). `summary`나 `conditions`에 피부 관련 소견이 자연스럽게 반영되는지 육안 확인.

- [ ] **Step 4: 사진 없는 요청도 기존대로 동작하는지 확인**

```bash
curl -s -X POST http://localhost:3000/api/symptom-check -H "Content-Type: application/json" -d '{"bodyPart":"머리","symptoms":["두통"],"duration":"오늘 처음","severity":"약함","note":""}'
```

Expected: 기존과 동일하게 JSON 응답(이 브랜치 기본값인 Ollama 경유). 사진 유무에 따라 라우팅이 갈라져도 사진 없는 경로는 회귀 없어야 함.

- [ ] **Step 5: ml-service를 끈 상태에서 사진 포함 요청 — 폴백 확인**

```bash
# ml-service 프로세스 kill 후
curl -s -X POST http://localhost:3000/api/symptom-check -H "Content-Type: application/json" -d @/tmp/payload.json
```

Expected: 에러 없이 정상 JSON 응답(분류 없이 텍스트만으로 처리) — `classifySkinPhoto`가 `null`을 반환하고 프롬프트에 분류 섹션이 빠질 뿐, 요청 자체는 실패하지 않아야 함.

- [ ] **Step 6: 커밋**

```bash
git add app/api/symptom-check/route.ts
git commit -m "Route symptom-check photos through ml-service classification + Gemini"
```

---

### Task 4: `app/symptom-check/page.tsx` — 사진 첨부 UI

**Files:**
- Modify: `app/symptom-check/page.tsx`

**Interfaces:**
- Consumes: 없음 (클라이언트 상태 + 기존 `fetch("/api/symptom-check")` 호출부만 확장, Task 3의 `photo` 필드와 계약 일치)

- [ ] **Step 1: `photo` 상태 추가**

`app/symptom-check/page.tsx:82` (`const [result, setResult] = useState<SymptomResult | null>(null);`) 바로 다음에 추가:

```ts
  const [photo, setPhoto] = useState<string | null>(null);
```

- [ ] **Step 2: 사진 인코딩 핸들러 추가**

`selectBodyPart` 함수 앞(파일 84번째 줄 근처)에 추가:

```ts
  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }
```

- [ ] **Step 3: `reset()`에 사진 초기화 추가**

`reset()` 함수(파일 127-141줄) 안, `setResult(null);` 다음 줄에 추가:

```ts
    setPhoto(null);
```

- [ ] **Step 4: STEP 4(추가로 하고 싶은 말) 섹션에 사진 첨부 UI 추가**

기존 `{step === 4 && (...)}` 블록(366-377줄)을 아래로 교체:

```tsx
              {step === 4 && (
                <StepSection title="추가로 하고 싶은 말이 있나요?" subtitle="선택 사항이에요.">
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="예: 계단을 오를 때 더 아파요"
                    rows={4}
                    disabled={loading}
                    className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent disabled:opacity-60"
                  />

                  {bodyPart === "피부" && (
                    <div className="mt-4">
                      {!photo ? (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-3.5 text-sm font-medium text-sub transition hover:border-accent/40">
                          <CameraIcon className="h-4 w-4" />
                          사진 첨부 (선택)
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handlePhotoChange}
                          />
                        </label>
                      ) : (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 로컬에서 방금 고른 data URL 미리보기, next/image 최적화 대상 아님 */}
                          <img
                            src={photo}
                            alt="첨부한 피부 사진"
                            className="h-40 w-full rounded-2xl object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setPhoto(null)}
                            aria-label="사진 제거"
                            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition active:scale-95"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </StepSection>
              )}
```

- [ ] **Step 5: 아이콘 컴포넌트 추가**

파일 끝(`CheckIcon` 함수 뒤, 568줄 근처)에 추가:

```tsx
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

- [ ] **Step 6: `handleSubmit`에 `photo` 필드 추가**

`app/symptom-check/page.tsx:153-163`의 `fetch` 호출 바디를 교체:

```ts
        body: JSON.stringify({
          bodyPart,
          symptoms: finalSymptoms,
          duration,
          severity,
          note,
          photo,
        }),
```

- [ ] **Step 7: 정적 검증**

```bash
npx tsc --noEmit
npm run lint
```

Expected: 통과. `no-img-element` 규칙이 활성화돼 있다면 Step 4에서 추가한 eslint-disable 주석으로 억제되는지 확인 — 만약 lint가 이 규칙을 아예 갖고 있지 않다면(경고 자체가 없다면) 주석을 제거해도 무방.

- [ ] **Step 8: 브라우저 수동 스모크 테스트**

`npm run dev` + `uvicorn serve:app --port 8000`(ml-service) 둘 다 켠 상태에서:

1. `/symptom-check` 접속 → STEP 1에서 "피부" 선택 → 증상 1개 이상 선택 → 기간/정도 선택
2. STEP 5(추가로 하고 싶은 말)에서 "사진 첨부 (선택)" 버튼 확인 — 다른 부위(예: "머리")를 선택했을 때는 이 버튼이 보이지 않아야 함
3. 실제 피부 사진(또는 `ml-service/organized/*/*.jpg` 샘플) 선택 → 썸네일 미리보기 렌더링 확인 → 우측 상단 X 버튼으로 제거 후 다시 첨부 가능한지 확인
4. "결과 확인하기" 제출 → 결과 화면에 분류가 반영된 듯한 자연스러운 안내가 나오는지 확인
5. "다시 하기" 클릭 → 사진 상태가 초기화되어 새로 시작 가능한지 확인

- [ ] **Step 9: 커밋**

```bash
git add app/symptom-check/page.tsx
git commit -m "Add optional skin-photo attach UI to symptom-check step 4"
```

---

### Task 5: 마무리 — 문서 갱신 + `master` 포팅 검토

**Files:**
- Modify: `docs/superpowers/specs/2026-07-31-skin-check-design.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 스펙 문서에 완료 상태 기록**

`docs/superpowers/specs/2026-07-31-skin-check-design.md` 맨 위에 짧은 상태 메모 추가:

```markdown
> **상태 (2026-08-06):** ml-service 학습 완료(검증 정확도 91.7%, 4 클래스). "기존 증상체크 플로우에 통합" + API 라우트 변경까지 구현 완료(`local-ollama`). "지난 기록 화면 리뉴얼"과 "캘린더 연동"은 아직 미착수 — 별도 계획으로 진행 예정.
```

- [ ] **Step 2: `CLAUDE.md`에 `ML_SERVICE_URL` 환경변수 문서화**

`Requires 두 Kakao 키` 문단 뒤에 추가:

```markdown
Optional `ML_SERVICE_URL` in `.env.local` (default `http://localhost:8000`) points `/symptom-check`'s photo-attach path at the local `ml-service` FastAPI server (see below) — only relevant when testing the skin-photo classification flow locally.
```

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/specs/2026-07-31-skin-check-design.md CLAUDE.md
git commit -m "Docs: note skin-photo classification integration status"
```

- [ ] **Step 4: `master`로 포팅할지 사용자와 확인**

이 기능은 `lib/ai.ts`를 직접 건드리지 않으므로 `master`(Gemini 전용)에도 그대로 cherry-pick 가능. 다만 `master`에는 아직 `ml-service/`가 없으므로, `master`에도 PR #1과 동일한 내용을 먼저 머지해야 함 — 별도 작업으로 사용자에게 진행 여부 확인.

---

## 계획 자체 검증 (self-review 결과)

**스펙 커버리지:** `docs/superpowers/specs/2026-07-31-skin-check-design.md`의 "기존 증상체크 플로우에 통합"(Task 4) + "API 라우트 변경"(Task 1-3) 섹션은 전부 커버함. "지난 기록 화면 리뉴얼"과 "캘린더 연동" 섹션은 사진 분류 기능과 독립적인 별개 UI 작업이라 이 계획의 스코프에서 제외하고 Task 5에서 후속 계획으로 명시함 — 하나의 계획에 억지로 묶으면 리뷰 단위가 너무 커짐.

**플레이스홀더 스캔:** 없음 — 모든 스텝에 실제 코드/명령어 포함.

**타입 일관성:** `SkinClassification`(Task 1) → `describeClassification`(Task 1, 반환 `string`) → `classificationNote?: string`(Task 2 파라미터명 일치) → `route.ts`에서의 사용(Task 3) 전부 일치 확인. `photo?: string`(base64 data URL) 필드명이 `page.tsx`(Task 4)의 body와 `route.ts`(Task 3)의 파싱 양쪽에서 동일하게 `photo` 사용 확인.
