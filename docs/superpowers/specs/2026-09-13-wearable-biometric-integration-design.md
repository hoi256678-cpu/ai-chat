# 갤럭시 워치 생체 데이터 연동 설계 (확정판)

> **상태 (2026-09-13):** 아키텍처 확정. [2026-09-09 탐색 문서](./2026-09-09-wearable-biometric-integration-design.md)의 옵션 A/B 검토를 이어받아, 그 문서에는 없던 Health Connect 경로를 반영해 최종 결정.

## 배경

[2026-09-09 문서](./2026-09-09-wearable-biometric-integration-design.md)에서 웹앱 단독으로는 워치 연동이 불가능하다는 것, "옵션 B(WebView 셸)"가 캡스톤 시연상 앱 하나로 보이는 경험을 만든다는 것까지 결정했음. 다만 그 문서는 "Samsung Health Sensor SDK + 커스텀 Wear OS 앱 + Wearable Data Layer API" 경로만 조사했고, 이 경로는 워치용 프로젝트를 별도로 만들어야 해서 개발량이 큼.

이후 조사에서 더 간단한 경로를 발견: 갤럭시 워치는 이미 Samsung Health 앱과 자동으로 페어링되어 있고(별도 설정 불필요), Samsung Health는 그 데이터를 안드로이드 표준 저장소인 **Health Connect**로 동기화해준다. 즉 커스텀 워치 앱 없이, 폰 쪽에서 Health Connect만 읽으면 됨.

## 결정된 아키텍처

**커스텀 Wear OS 앱, Samsung Health Sensor SDK, `MessageClient`/`DataListenerService` — 전부 불필요.** 폰 전용(phone-only) 구성으로 확정.

```
갤럭시 워치 (심박수 측정)
   ↓ (Samsung 자체 동기화, 배터리 정책 기반 — 개발 불필요)
Samsung Health 앱 (이미 설치·페어링됨)
   ↓ (데이터 생성/변경 즉시 반영)
Health Connect (안드로이드 표준 건강데이터 저장소)
   ↓ (권한 승인 후 우리 앱이 읽음)
Capacitor 셸 앱의 HealthConnectPlugin (신규, 네이티브)
   ↓ (Capacitor JS 브리지)
웹앱(JS) — lib/biometrics.ts
   ↓ (Supabase 직접 insert, RLS로 보안)
Supabase `biometrics` 테이블
   ↓
/biometrics 페이지 — Gemini 분석
```

### 컴포넌트

- **Android 셸 앱 (Capacitor)**: 기존 배포된 Next.js 웹앱(Vercel URL)을 WebView로 감싸 앱 하나처럼 보이게 함. 카메라(복약 사진)·위치(병원찾기)·Kakao Maps SDK는 이미 표준 웹 API라 WebView에서도 대체로 동작하지만, 실제 빌드 후 회귀 확인 필요 (아래 "범위/리스크" 참조).
- **`HealthConnectPlugin`** (신규 네이티브 Capacitor 플러그인): Health Connect 가용성 확인, 권한 요청, `HeartRateRecord` 조회, JS로 결과 반환. 순수 리더 — 쓰기·워치 통신 없음.
- **`lib/biometrics.ts`** (신규, `lib/medications.ts`와 동일 패턴): Supabase에 직접 CRUD. 컴포넌트는 Supabase를 직접 호출하지 않음.
- **Supabase `biometrics` 테이블** (신규): `id`, `user_id`, `heart_rate` (int), `measured_at` (timestamptz), `created_at`. Unique 제약 `(user_id, measured_at)` — `medication_logs`와 동일하게 `23505`를 성공으로 처리해 중복 동기화를 안전하게 무시. RLS: `auth.uid() = user_id`, select/insert만 (수정·삭제 없음 — 워치 측정값은 불변 기록).
- **`/biometrics` 페이지** (신규): 최근 측정값 리스트 + "새로고침"(재동기화) + "분석하기"(Gemini) 버튼. `Capacitor.getPlatform() === 'android'`가 아니면 `/main`에서 진입점 자체를 숨김.
- **분석 로직** (`lib/biometrics.ts` 또는 신규 `lib/biometricAnalysis.ts`): 최근 측정값들을 Gemini에 보내 해석. `lib/symptomCheck.ts`/복약 precautions와 동일한 디스클레이머 톤 ("병원/전문의 확인 필요"로 마무리).

## 데이터 흐름

1. 사용자가 `/biometrics`에 진입 (또는 "새로고침" 탭).
2. JS가 `HealthConnectPlugin.requestPermissions()` 호출 (최초 1회, OS 표준 권한 다이얼로그) → 이후는 캐시된 승인 상태 사용.
3. JS가 `lib/biometrics.ts`로 마지막 저장된 `measured_at`을 조회 → 그 시각 이후 구간을 `HealthConnectPlugin.readRecentHeartRate(since)`에 넘겨 네이티브에 위임.
4. 플러그인이 Health Connect의 `HeartRateRecord`를 조회해 `[{measuredAt, bpm}, ...]` 배열로 JS에 반환.
5. JS가 `lib/biometrics.ts`로 Supabase에 insert (RLS 보안, 중복은 `23505`로 무시).
6. 페이지가 최신 리스트를 렌더링. 사용자가 "분석하기"를 누르면 Gemini 분석 결과를 카드로 표시.

동기화는 명시적 트리거(페이지 진입/새로고침)만 사용하고 백그라운드 폴링(WorkManager 등)은 두지 않음 — 캡스톤 범위에서 개발량을 최소화하기 위한 선택. 워치→Samsung Health 동기화 자체가 배터리 정책 기반 지연을 가지므로("지금 이 순간"이 아니라 "최근 측정된 값"), 백그라운드 폴링을 추가해도 실시간성이 크게 개선되지 않음.

## 에러 처리

- **Health Connect 미설치** (구형 안드로이드 버전): 플러그인이 가용성 확인 실패를 반환 → JS가 "Health Connect 설치 필요" 안내 + Play Store 링크 표시.
- **권한 거부**: 설명 문구 + 재요청 버튼. 에러로 처리하지 않고 정상 흐름의 한 상태로 취급.
- **측정 데이터 없음**: 에러 아님 — "Samsung Health에서 측정해보세요" 빈 상태 안내.
- **Gemini 분석 실패**: 기존 `symptomCheck.ts`의 파싱 실패 폴백과 동일하게, 에러를 사용자에게 그대로 노출하지 않고 안전한 기본 문구로 대체.
- **iPhone/PC 브라우저**: 기능 진입점 자체가 안 보이므로 이 경로에서 에러 상태가 발생하지 않음.

## 테스트

이 리포는 Next.js 쪽에 테스트 러너가 없음 (CLAUDE.md 기준, `ml-service`만 pytest 보유) — 그 관행을 따름. Health Connect 연동은 실제 기기(보유한 안드로이드 폰)에서의 수동 확인이 유일한 현실적 검증 방법이라 자동 테스트는 추가하지 않음.

## 범위 및 리스크

- **아이폰 사용자는 이 기능을 쓸 수 없음** — Galaxy Watch4+ 자체가 iOS와 페어링이 안 되기 때문(플랫폼 근본 제약, 우리 설계와 무관). `/biometrics` 진입점을 안드로이드에서만 노출해 나머지 기능(채팅·증상체크·복약관리)은 계속 아이폰/PC에서 정상 동작.
- **Capacitor WebView 셸 안에서 기존 웹 기능 회귀 가능성**: 카메라(복약 사진), Geolocation(병원찾기), Kakao Maps SDK가 WebView 안에서 브라우저와 동일하게 동작하는지 셸 빌드 후 실기기로 회귀 확인 필요. 문제 발생 시 해당 기능만 Capacitor 플러그인(예: `@capacitor/camera`, `@capacitor/geolocation`)으로 교체.
- **실시간성 낮음**: 워치→Samsung Health 동기화가 배터리 정책 기반이라 초 단위 실시간 심박수 스트리밍은 아님. 캡스톤 시연 목적(측정값을 가져와 AI가 해석)에는 충분하다고 판단.
- **Samsung Health 앱 의존**: 사용자가 Samsung Health에서 Health Connect 데이터 공유 권한을 켜둔 상태여야 함 (설정 토글 1회, 코드로 강제 불가 — 안내 문구로 유도).

## 다음 단계

이 스펙을 기반으로 구현 계획을 `docs/superpowers/plans/`에 별도로 작성 (writing-plans 스킬). 예상 작업 단위: (1) Capacitor 셸 앱 세팅 + 기존 웹앱 WebView 로드, (2) `HealthConnectPlugin` 네이티브 구현, (3) Supabase `biometrics` 테이블 + RLS + `lib/biometrics.ts`, (4) `/biometrics` 페이지 + Gemini 분석, (5) 실기기 회귀 확인 (카메라/위치/지도).
