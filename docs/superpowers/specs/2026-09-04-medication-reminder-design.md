# 복용 알림(투약 스케줄) 기능 설계

## 배경

기존 기능(AI 상담 채팅, 증상 체크, 근처 병원 찾기)에 이어 네 번째 핵심 기능으로 "복용 알림"을 추가한다. 사용자가 처방전/진단서 사진을 찍으면 AI가 약 이름을 읽어주고, 복용 시간대와 종료일을 등록하면 그 시간마다 앱을 열었을 때 알려주고 먹었는지 체크·기록할 수 있게 한다.

메인 허브(`/main`)를 "너무 비어 보인다"는 이유로 다듬던 중, "최근 활동" 카드 대신 이 기능의 요약을 메인에 넣기로 했다 — 그래서 메인 허브 재작업은 이 기능이 완성된 뒤 별도로 진행한다(이 스펙의 범위 밖).

## 브랜치/AI 프로바이더 제약

이 저장소는 `local-ollama` 브랜치 기준으로 `lib/ai.ts`가 기본적으로 로컬 Ollama(`exaone3.5:7.8b`, 텍스트 전용, 비전 불가)로 라우팅한다. 사진에서 약 이름을 읽는 작업은 이미지 입력이 필수이므로, 이 기능만은 `lib/ai.ts` 라우터를 거치지 않고 `lib/gemini.ts`를 통해 **항상 Gemini**를 직접 호출한다 — `2026-07-31-skin-check-design.md`에서 사진 분류 검증을 Gemini로 강제한 것과 같은 이유(로컬 모델은 비전 능력이 없거나 검증되지 않음).

## 데이터 모델 (Supabase)

기존 `messages`/`symptom_checks`/`events` 테이블과 동일한 패턴(RLS로 본인 행만 select/insert, 필요한 것만 delete 허용)을 따른다.

```sql
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  times text[] not null,        -- 예: ['08:00','13:00','19:00'], HH:MM 24시간제
  start_date text not null,     -- "YYYY-MM-DD", 기본값 오늘
  end_date text not null,       -- "YYYY-MM-DD", 필수 입력
  photo text,                   -- 처방전 사진 base64 데이터 URL, 선택
  created_at timestamptz not null default now()
);

create table public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  date_key text not null,       -- 어느 날짜분 복용인지
  time text not null,           -- 어느 시간대 슬롯인지 (medications.times의 원소 중 하나)
  taken_at timestamptz not null default now(),
  unique (medication_id, date_key, time)
);
```

- `medications`: select/insert/delete own (수정은 지원하지 않음 — 스코프 밖 참고)
- `medication_logs`: select/insert own (체크 취소 기능은 없으므로 delete 불필요)
- 인덱스: `medications(user_id, end_date)`, `medication_logs(user_id, medication_id, date_key)`

## 사진 → 약 이름 인식

- `lib/gemini.ts`에 `extractMedicineNames(photoDataUrl: string): Promise<string[]>` 추가 — Gemini `generateContent`에 멀티모달 파트(`{text: prompt}`, `{inline_data: {mime_type, data}}`)로 요청
- 프롬프트: 처방전/진단서 사진에서 보이는 약 이름만 한국어 그대로 JSON 배열로 반환하라고 지시 (증상체크의 `parseSymptomResult`와 동일하게 코드펜스 제거 후 파싱)
- 파싱 실패 또는 인식된 이름이 없으면 빈 배열 반환 — 에러를 사용자에게 노출하지 않고 수동 입력으로 자연스럽게 유도(기존 `symptomHistory` 저장 실패 처리와 동일한 best-effort 철학)
- 신규 라우트 `app/api/medications/extract/route.ts`: `{ photo }` 받아 `{ names: string[] }` 반환, 입력 검증 + 에러를 한국어 JSON으로 매핑(기존 API 라우트들과 동일한 얇은 래퍼 패턴)

## `lib/medications.ts` (신규)

`lib/symptomHistory.ts`와 동일한 RLS-직접호출 패턴:

- `saveMedication(input): Promise<void>` — insert
- `getMedications(): Promise<MedicationRecord[]>` — 전체(활성+종료) 조회, `end_date` 내림차순 또는 `created_at` 내림차순
- `deleteMedication(id): Promise<void>`
- `logDose(medicationId, dateKey, time): Promise<void>` — insert into `medication_logs`, unique 제약 위반(중복 체크)은 무시하고 성공 처리
- `getDoseLogs(dateKey): Promise<MedicationLogRecord[]>` — 오늘자 체크 상태 조회용

## 페이지 & 플로우

### `/medications` — 목록 + 오늘의 체크리스트

- 상단 "오늘": 종료되지 않은(`start_date <= 오늘 <= end_date`) 모든 약의 오늘자 시간 슬롯을 시간순으로 모아 리스트로 표시
  - 슬롯 상태 3가지: 아직 안 옴(회색) / 지금 먹을 시간·지남(강조, `text-danger` 또는 `text-accent`) / 체크 완료(회색+체크마크, `logDose`의 `taken_at` 시각 표시)
  - "먹었어요" 탭 → `logDose` 호출, 낙관적 업데이트로 즉시 체크 표시
- 하단 "등록된 약" 목록: 이름, 복용 시간대, 종료일까지 D-day(또는 "종료됨"), 삭제 버튼(`deleteMedication`, 확인 없이 즉시 — 되돌릴 데이터가 크지 않음)
- 빈 상태: 등록된 약이 없으면 "+ 약 추가"로 유도하는 안내 카드
- 헤더에 "+ 약 추가" → `/medications/add`로 이동

### `/medications/add` — 단일 폼 페이지 (마법사 아님)

1. **사진 업로드(선택)** — `<input type="file" accept="image/*" capture="environment">` + `FileReader` → base64, 4MB 제한(`app/symptom-check/page.tsx`의 `handlePhotoChange`와 동일한 검증 재사용)
   - "AI로 약 이름 찾기" 버튼 → `/api/medications/extract` 호출 → 로딩 중 표시 → 후보 이름들을 체크박스 목록으로 렌더
2. **등록 예정 목록** — 체크된 후보 + "약 이름 직접 추가" 텍스트 입력으로 보탠 이름들이 하나의 목록으로 쌓임. 각 항목마다:
   - 이름 (텍스트, 수정 가능)
   - 복용 시간대: 아침(08:00)/점심(13:00)/저녁(19:00) 프리셋 체크박스, 체크된 슬롯의 시간은 개별 수정 가능(`<input type="time">`)
   - 종료일: `<input type="date">`, 필수
   - 항목별 삭제(× 버튼)
3. **저장** — 목록의 각 항목을 `saveMedication`으로 순차 insert. 전부 성공하면 `/medications`로 이동. 일부만 실패하면 성공한 항목은 목록에서 제거하고, 실패한 항목만 에러 메시지와 함께 폼에 남겨 재시도할 수 있게 함 — 증상체크처럼 실패를 숨기지 않고 명시적으로 알림(데이터 등록이라 실패를 숨기면 안 됨)

## 메인 허브 연동

이번 스펙 범위 밖 — 이 기능이 끝난 뒤 별도로 "오늘 N/M 복용" 또는 "지금 복용할 약 있음" 요약 카드를 `/main`에 추가하는 작업을 진행한다.

## 스코프 밖 (Non-goals)

- 브라우저/앱이 닫혀 있을 때 오는 푸시 알림(Web Push + 서비스워커 + 크론) — 앱을 열어야 확인 가능한 것으로 충분하다고 확인함
- 지난 날짜에 놓친 복용 슬롯의 소급 표시/알림 — 오늘 하루치만 다룸
- 복용률 통계, 별도 히스토리 화면 — `medication_logs`는 남기되 조회 UI는 "오늘" 화면 안에서만
- 등록된 약의 시간대/종료일 수정 — 삭제 후 재등록으로 대체
- 처방전 사진 없이도 되는 흐름은 이미 포함(수동 입력) — OCR 인식률 보장이나 재시도 UI는 다루지 않음(실패 시 그냥 수동 입력 유도)

## 검증 계획

레포에 테스트 러너 없음(`CLAUDE.md` 명시) — 수동 스모크 테스트로 검증:

- 사진 업로드 → 약 이름 인식 → 후보 체크 → 시간대/종료일 설정 → 저장 → `/medications`에 반영되는지
- 사진 없이 수동 입력만으로 등록되는지
- 오늘 시간대가 지나면 강조 표시로 바뀌는지, "먹었어요" 체크 후 새로고침해도 상태가 유지되는지(`medication_logs` 조회 확인)
- 종료일이 지난 약이 "오늘" 체크리스트에서 빠지는지
- 약 삭제 시 목록/오늘 체크리스트에서 즉시 사라지는지
