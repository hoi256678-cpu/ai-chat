# "내 건강 기록" 통합 화면 설계

## 배경

현재 워치 데이터(`/biometrics`)와 지난 증상체크 기록(`/symptom-check/history`)은 서로 다른 진입 경로를 가진 완전히 별개의 화면이다. `/biometrics`는 메인 허브(`/main`)에 바로 카드로 노출되지만, `/symptom-check/history`는 `/symptom-check` 마법사 결과 화면 안의 "지난 기록 보기" 버튼으로만 들어갈 수 있어 진입 경로가 비대칭이다. 두 화면 모두 "사용자가 자기 건강 상태를 되짚어보는" 같은 성격의 기능이므로, 하나의 "내 건강 기록" 진입점 아래 탭으로 묶어 발견성과 일관성을 높인다.

## 결정된 구조

새 라우트 `app/health-records/page.tsx`를 만들고, 그 안에서 "증상 기록" / "워치 데이터" 두 탭을 세그먼트 버튼으로 전환한다. 탭 상태는 `?tab=symptoms|biometrics` 쿼리 파라미터로 관리한다 (기본값 `symptoms`). 각 탭의 실제 내용은 기존 두 페이지의 로직을 그대로 옮긴 컴포넌트가 담당하며, 로직 자체는 변경하지 않는다 — 이번 작업은 진입점 통합이지 기능 재설계가 아니다.

```
/main
  └─ "내 건강 기록" 카드 (기존 "워치 데이터 확인하기" 카드를 이 라벨/링크로 교체)
       ↓
/health-records?tab=symptoms (기본값)   /health-records?tab=biometrics
  └─ SymptomHistorySection                └─ BiometricsSection
     (기존 /symptom-check/history 로직)      (기존 /biometrics 로직)

/symptom-check (마법사 결과 화면)
  └─ "지난 기록 보기" 버튼 → /health-records?tab=symptoms 로 변경
```

### 컴포넌트

- **`app/health-records/page.tsx`** (신규): 공통 헤더("내 건강 기록" + `/main`으로 돌아가는 뒤로가기 버튼, 기존 `/symptom-check/history`·`/biometrics` 헤더와 동일한 스타일) + 탭 세그먼트 UI + `searchParams`의 `tab` 값에 따라 `SymptomHistorySection` 또는 `BiometricsSection`을 렌더링. 탭 전환은 `router.replace`로 쿼리 파라미터만 바꿔 페이지 자체는 유지한다.
- **`components/SymptomHistorySection.tsx`** (신규, 기존 `app/symptom-check/history/page.tsx`에서 헤더를 제외한 나머지 전체를 이동): 기록 목록 로딩, `CardDeck` 렌더링, 카드 클릭 시 뜨는 상세 시트, 시트 안 삭제 아이콘 → 확인 팝업 → `deleteSymptomCheck` 호출까지 기존 state·핸들러를 그대로 옮긴다. 로직 변경 없음.
- **`components/BiometricsSection.tsx`** (신규, 기존 `app/biometrics/page.tsx`에서 헤더를 제외한 나머지 전체를 이동): Health Connect 동기화 버튼, `HeartRateChart`, 측정값 리스트, Gemini AI 분석 버튼/결과까지 기존 state·핸들러를 그대로 옮긴다. 로직 변경 없음.
- **`app/main/page.tsx`**: "워치 데이터 확인하기" `MenuCard`를 `label="내 건강 기록"`, `description="증상 기록과 워치 데이터 한눈에 보기"`, `onClick={() => router.push("/health-records")}`로 교체. 아이콘은 기존 워치(심박 파형) 아이콘을 그대로 유지한다.
- **`app/symptom-check/page.tsx`**: "지난 기록 보기" 버튼의 `router.push("/symptom-check/history")`를 `router.push("/health-records?tab=symptoms")`로 변경.
- **삭제되는 파일**: `app/symptom-check/history/page.tsx`, `app/biometrics/page.tsx`. 두 경로를 참조하는 곳은 위 두 지점(메인 허브 카드, 마법사의 "지난 기록 보기" 버튼)뿐이라 별도 리다이렉트는 두지 않는다.

`lib/symptomHistory.ts`, `lib/biometrics.ts`, `lib/nativeHealthConnect.ts` 등 데이터/네이티브 계층은 전혀 손대지 않는다 — 이번 변경은 순수하게 화면(라우트/컴포넌트) 계층 재구성이다.

## 데이터 흐름

각 섹션 컴포넌트는 지금과 동일하게 자신의 `useEffect`에서 각자의 데이터 소스(`getSymptomChecks()` / `getRecentBiometrics()`)를 호출한다. 탭을 전환해도 이미 마운트된 섹션의 state를 유지할지, 언마운트 후 재요청할지는 두 섹션을 동시에 렌더링하지 않고(비활성 탭은 `hidden` 처리가 아니라 조건부 렌더링으로 언마운트) 탭을 바꿀 때마다 다시 마운트되는 방식으로 구현한다 — 두 화면 모두 기존에 "매번 새로 불러오는" 전제로 짜여 있고, 상태 보존을 위해 별도 캐싱 로직을 추가하는 것은 이번 스코프를 벗어난다.

## 에러 처리

각 섹션의 기존 에러 처리(불러오기 실패 문구, 삭제 실패 배너, Health Connect 미설치/권한 거부 안내 등)는 그대로 유지한다. 새로 추가되는 실패 지점은 없다 — 탭 전환은 클라이언트 라우팅(쿼리 파라미터 변경)일 뿐이라 실패할 수 있는 네트워크 동작이 없다.

## 테스트

이 리포는 Next.js 쪽에 테스트 러너가 없다 (`CLAUDE.md` 기준). `npm run lint`와 `npx tsc --noEmit`로 정적 검증하고, 가능하면 `.env.local` 구성 후 dev 서버에서 탭 전환·기존 기능(증상 기록 삭제, 워치 동기화/분석) 회귀를 수동 확인한다.

## 범위 및 리스크

- **로직 이동만 수행, 재작성 아님**: 두 섹션 컴포넌트는 기존 페이지의 JSX/로직을 그대로 옮기는 것이 원칙이라, 이 스펙만으로는 두 화면의 디자인이 서로 어우러지도록 다듬는 작업(예: 공통 여백/타이포 통일)은 포함하지 않는다. 필요하면 후속 작업으로 분리한다.
- **탭 재마운트로 인한 재요청**: 탭을 왔다갔다 하면 그때마다 Supabase/Health Connect에 다시 요청한다. 사용 빈도상 성능 문제가 될 가능성은 낮다고 보지만, 체감상 느리면 후속으로 탭 간 상태 보존을 고려할 수 있다.

## 다음 단계

이 스펙을 기반으로 구현 계획을 `docs/superpowers/plans/`에 별도로 작성한다 (writing-plans 스킬). 예상 작업 단위: (1) `SymptomHistorySection`/`BiometricsSection` 컴포넌트 분리, (2) `app/health-records/page.tsx` 신규 작성(헤더+탭), (3) 메인 허브 카드 교체, (4) 마법사 "지난 기록 보기" 링크 변경, (5) 기존 두 페이지 파일 삭제, (6) lint/타입체크 및 가능하면 수동 회귀 확인.
