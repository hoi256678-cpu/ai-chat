# 채팅 상담사 페르소나 + 개인 기록 참고 기능 설계

## 배경

`/chat`(채팅 시작하기)은 이 앱의 핵심 기능인데도 지금까지 시스템 프롬프트/페르소나가 전혀 없었다. `lib/gemini.ts`의 `generateReply`는 `context`가 주어질 때만 `systemInstruction`으로 넣는데, 지금 유일하게 이걸 채우는 곳은 `lib/events.ts`의 `buildEventContext`(다가오는 일정이 있을 때만 붙는 한 줄 넛지)뿐이다. 반면 증상체크(`lib/symptomCheck.ts`)나 복약 주의사항(`lib/gemini.ts`의 `getMedicationPrecautions`)은 이미 페르소나·디스클레이머 관행이 있다.

이번 작업은 두 가지를 더한다: ① 실제 상담 기법(공감적 경청, 반영적 질문)을 반영한 성격/말투, ② 사용자가 이미 이 앱에 쌓아온 기록(복약, 증상체크, 워치 심박수)을 대화 맥락으로 참고해서 "내 기록을 아는 개인 AI 의사"처럼 느껴지게 하는 것.

## 결정된 아키텍처

새 서브시스템을 만들지 않고, 기존 `buildEventContext` 패턴을 그대로 확장한다. `lib/gemini.ts`/`lib/ai.ts`/`app/api/chat/route.ts`의 시그니처는 그대로 두고(하나의 문자열 `context`를 systemInstruction으로 보내는 방식 불변), 그 문자열을 구성하는 조각을 늘린다.

```
lib/chatPersona.ts (신규, 상수)         ─┐
lib/events.ts        buildEventContext ─┤
lib/medications.ts   buildMedicationContext (신규) ─┼─▶ app/chat/page.tsx가 join("\n\n") ─▶ POST /api/chat { messages, context } ─▶ lib/ai.ts ─▶ lib/gemini.ts (systemInstruction)
lib/symptomHistory.ts buildSymptomHistoryContext (신규) ─┤
lib/biometrics.ts    buildBiometricContext (신규)  ─┘

app/api/chat/route.ts: Gemini 호출 *전에* lib/crisisDetection.ts로 키워드 세이프넷 검사 (신규)
```

### 컴포넌트

- **`lib/chatPersona.ts`** (신규): 상수 `CHAT_PERSONA_PROMPT: string`. 항상 포함되는 기본 시스템 프롬프트. 공감적 경청·반영적 질문 톤을 명시적으로 지시하고, "사용자의 건강 기록을 아는 개인 AI 주치의처럼 자연스럽게 되물어봐도 됨"이라는 정체성을 부여한다. 동시에 앱 전체의 비진단 헤징 관행(`lib/symptomCheck.ts`의 `FALLBACK_DISCLAIMER`와 동일한 태도: 확정 진단·처방 금지, 병원 방문 권유는 자연스러운 타이밍에만)을 지시하고, 위기 신호 감지 시 정해진 안전 메시지만 출력하라는 규칙을 포함한다(아래 크라이시스 세이프넷과 이중 방어).
- **`lib/medications.ts`에 `buildMedicationContext(meds: MedicationRecord[], dueSlots: DoseSlot[]): string | undefined`** (신규 함수, 기존 파일에 추가): 복용 중인 약 이름 목록 + 오늘 복용 현황(먹음/안 먹음) 한 줄 요약. 약이 없으면 `undefined`.
- **`lib/symptomHistory.ts`에 `buildSymptomHistoryContext(records: SymptomCheckRecord[]): string | undefined`** (신규 함수): 최신순 최대 3건만, 날짜+부위+증상+AI 요약(`summary`) 한 줄씩. 기록 없으면 `undefined`. 사진(`photo`)은 텍스트 컨텍스트에 넣지 않음(용량·민감정보 문제).
- **`lib/biometrics.ts`에 `buildBiometricContext(readings: BiometricRecord[]): string | undefined`** (신규 함수): 원본 나열 대신 최근 평균/최고/최저 bpm과 가장 최근 측정값·시각만 요약. 기록 0~1건이면 `undefined`(추세라 부를 게 없음).
- **`lib/crisisDetection.ts`** (신규): `CRISIS_KEYWORDS: string[]`(예: "자살", "죽고싶", "죽고 싶", "자해" 등)과 `containsCrisisSignal(text: string): boolean`, 그리고 고정 문자열 `CRISIS_SAFETY_MESSAGE`를 export. 안내 문구에는 확인된 현재 번호인 **자살예방상담전화 109**(24시간, 통합)와 위급 시 **112/119**를 포함한다.
- **`app/api/chat/route.ts`** (수정): `generateReply` 호출 전에 `messages` 배열의 마지막 `user` 메시지에 `containsCrisisSignal`을 적용. 매칭되면 Gemini를 호출하지 않고 `{ reply: CRISIS_SAFETY_MESSAGE }`를 바로 반환.
- **`app/chat/page.tsx`** (수정): 마운트 시 `getUpcomingEvents`와 같은 타이밍에 `getMedications`+`getDueSlots`, `getSymptomChecks`, `getRecentBiometrics`를 병렬로 한 번 더 불러와 state에 저장. 전송 시 `[CHAT_PERSONA_PROMPT, buildEventContext(...), buildMedicationContext(...), buildSymptomHistoryContext(...), buildBiometricContext(...)].filter(Boolean).join("\n\n")`을 `context`로 보낸다.

## 데이터 흐름

1. 사용자가 `/chat`에 진입 → 오늘 대화 기록, 다가오는 일정, 복약 목록+오늘 복용 현황, 최근 증상체크 3건, 최근 심박수 통계를 병렬로 조회 (전부 기존 함수 재사용, 신규 Supabase 쿼리 없음).
2. 사용자가 메시지를 입력하고 전송 → 프론트에서 각 `build*Context` 함수로 문자열 조각을 만들고 페르소나 프롬프트와 합쳐 하나의 `context`로 조립.
3. `POST /api/chat`이 요청을 받으면, Gemini를 부르기 전에 먼저 최신 사용자 메시지를 `containsCrisisSignal`로 검사.
   - 매칭 시: Gemini 호출 없이 고정 안전 메시지 반환 (지연 없음, 오작동 시에도 안전).
   - 매칭 안 되면: 기존과 동일하게 `generateReply(messages, context)` 호출 → Gemini가 조립된 컨텍스트를 시스템 프롬프트로 사용해 응답.
4. 응답은 기존과 동일하게 `lib/chatHistory.ts`를 통해 저장된다.

이 조회들은 페이지 마운트 시 한 번만 실행되고 메시지 전송마다 다시 실행되지 않으므로, 응답 지연에 영향을 주지 않는다(3번 항목의 "서버가 매번 DB 조회" 대안을 기각한 이유이기도 함).

## 에러 처리

- **기록 조회 실패** (예: Supabase 일시 오류): 각 `build*Context` 호출부에서 `.catch(() => undefined)` 처리해 해당 조각만 빠지고 나머지 대화는 정상 진행 — 캘린더 일정(`buildEventContext`)이 이미 이 방식으로 동작 중.
- **위기 세이프넷 오탐(false positive)**: 키워드 매칭은 보수적으로 짧은 리스트만 사용하고, 고정 메시지 자체도 "혼자 감당하지 않으셨으면 해요"처럼 부담 없는 톤으로 작성해 오탐이어도 대화 흐름을 크게 해치지 않게 한다.
- **위기 세이프넷 미탐(false negative)**: 키워드 세이프넷은 방어선 중 하나일 뿐이고, 페르소나 프롬프트 자체에도 동일 규칙을 지시해 이중 방어. 두 방어 모두 완벽할 수 없다는 한계는 "범위 및 리스크"에 명시.
- **Gemini 응답 실패**: 기존 `/api/chat`의 에러 처리(한국어 에러 메시지 반환)를 그대로 사용, 변경 없음.

## 테스트

이 리포는 Next.js 쪽에 테스트 러너가 없음(CLAUDE.md 기준) — 기존 관행을 따라 자동 테스트는 추가하지 않는다.
- `npm run lint`, `npm run build`로 타입 체크.
- 로컬에서 복약·증상체크·심박수 데이터가 있는 계정으로 실제 대화하며 자연스럽게 언급되는지 확인 (기록이 전혀 없는 신규 계정에서도 정상 동작하는지 — 모든 컨텍스트 조각이 `undefined`인 경우).
- 위기 키워드가 포함된 문장("죽고싶어" 등)을 직접 보내 Gemini 호출 없이 고정 메시지가 즉시 반환되는지 확인.

## 범위 및 리스크

- **위기 감지는 완벽하지 않다.** 키워드 세이프넷은 "죽고싶다"처럼 직접적인 표현만 잡고, 은유적/우회적 표현은 놓칠 수 있다. 프롬프트 레벨 지시가 이를 보완하지만, 이것도 LLM의 판단에 의존하므로 100% 보장은 아니다. 이건 캡스톤 프로젝트 범위에서 합리적인 완화 수준이라고 판단하되, 실제 배포 전 사용자에게 이 한계를 인지시킬 필요가 있다.
- **109 번호는 검색으로 확인한 2024년 1월 통합 이후 현재(2026년) 유효한 번호**([보건복지부 보도자료](https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1479607&act=view))지만, 정책은 바뀔 수 있으니 장기적으로는 하드코딩보다 설정값으로 분리하는 것도 고려할 수 있다(지금은 YAGNI로 상수 처리).
- **컨텍스트 조각이 늘어날수록 매 메시지 요청의 토큰 수가 늘어난다.** 증상체크/심박수 요약을 각각 3건/통계치로 제한한 것도 이 때문. 사용자가 기록이 아주 많아지면 조회 자체(각 함수의 `limit`)도 재검토 필요.
- **개인정보:** 복약/증상/심박 데이터가 매 대화 요청마다 Gemini API로 전송된다는 점은 기존에 증상체크·복약 주의사항 기능에서 이미 감수하고 있는 것과 동일한 수준의 노출이라 새로운 리스크는 아니다.

## 다음 단계

이 스펙을 기반으로 구현 계획을 `docs/superpowers/plans/`에 작성한다(writing-plans 스킬). 예상 작업 단위: (1) `lib/chatPersona.ts` 작성, (2) `lib/crisisDetection.ts` 작성 + `/api/chat` 라우트에 세이프넷 삽입, (3) 세 도메인 lib에 `build*Context` 함수 추가, (4) `app/chat/page.tsx` 조립 로직 연결, (5) 로컬 수동 테스트(기록 있음/없음/위기 문장 3가지 시나리오).
