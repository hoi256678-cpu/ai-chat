# 갤럭시 워치 생체 데이터 연동 기능 설계 (탐색 단계)

> **상태 (2026-09-09):** 아이디어 탐색 및 기술 조사 단계 — 구현 착수 전, 아키텍처 방향 미결정.

## 배경

기존 증상체크·복약관리 기능에 이어, 갤럭시 워치에서 심박수 등 생체 데이터를 받아와 Gemini로 분석해주는 기능을 추가하고 싶음. 집에 갤럭시 워치가 있어 그걸로 개발/시연 가능.

## 조사 결과

### 웹앱(브라우저)에서 직접 연동은 불가능

- Galaxy Watch(Watch4 이후, Wear OS 기반)는 표준 BLE Heart Rate 서비스를 열어두지 않고, Google의 **Wearable Data Layer API**(워치 앱 ↔ 페어링된 폰 앱 전용 채널)로만 통신함
- Web Bluetooth API(브라우저가 BLE GATT 기기에 직접 접속하는 표준 API)는 존재하고 Safari도 macOS 15/iOS 16부터 지원하지만, Galaxy Watch가 애초에 그 표준 채널을 안 쓰기 때문에 브라우저로는 접근 불가
- 따라서 이 기능은 지금의 Next.js/Vercel 웹앱 구조 안에서는 구현 불가능 — 네이티브 안드로이드 개발이 필요함

### Samsung Health Sensor SDK 아키텍처

- 공식 SDK이며 [Samsung Developer](https://developer.samsung.com/health/sensor/guide/introduction.html) 일반 가입만으로 사용 가능 (별도 파트너 승인 불필요로 확인됨)
- **SDK 코드는 워치 자체에서 실행되는 Wear OS 앱**에 들어감 (폰 앱이 아님) — 워치 앱이 `samsung-health-sensor-api.aar`로 심박수 등 센서 데이터를 수집
- 워치 → 폰 전송은 Google **Wearable Data Layer API**(`MessageClient`)로 JSON 메시지를 보내고, 폰 쪽은 `DataListenerService`로 수신
- 참고: [Measure and Transfer Heart Rate Data from Galaxy Watch to a Paired Android Phone](https://developer.samsung.com/health/blog/en/transfer-heart-rate-from-galaxy-watch-to-a-phone)
- 즉 "워치 앱 + 폰 리스너 앱" 두 조각이 최소 단위 — 폰 앱 하나로 끝나지 않음

### 아이폰 사용자는 원천적으로 이용 불가

- Galaxy Watch4 이후 모델(Wear OS 기반)은 삼성이 iOS 연동 앱을 만들지 않아 **아이폰과 페어링 자체가 안 됨** (Watch3까지의 Tizen 기반 구형 모델만 아이폰 지원)
- "Merge"라는 서드파티 우회 앱이 알림/일부 건강 데이터를 Apple Health로 동기화해주지만, 비공식 브릿지라 Samsung Health Sensor SDK 방식과는 무관
- 참고: [iPhones may finally support your Galaxy Watch, but there's a catch - SamMobile](https://www.sammobile.com/news/iphones-may-finally-support-your-galaxy-watch-but-theres-a-catch/)
- → 이 기능은 "갤럭시 워치 + 갤럭시(안드로이드) 폰" 조합 사용자로 스코프가 원천적으로 제한됨. 웹앱의 나머지 기능(채팅, 증상체크 등)은 계속 아이폰/PC 어디서든 사용 가능해야 하므로, 이 기능만 플랫폼 조건부로 노출해야 함 (예: `navigator.userAgent`로 안드로이드 여부 감지 후 "워치 연결하기" 버튼만 조건부 렌더링).

## 아키텍처 옵션

### 옵션 A — 순수 브릿지 (권장, 시간 제약 시)

워치 Wear OS 앱 + 폰 리스너 앱을 별도로 만들어 **생체 데이터를 서버(Supabase)로 전송하는 역할만** 하게 하고, 로그인·채팅·증상체크·복약관리·분석 화면 등 나머지 전부는 지금의 웹앱을 그대로 유지. 새 백엔드 작업은 `/api/biometrics` 같은 엔드포인트 하나 추가 + Supabase 테이블 하나 추가 정도.

- 장점: 이미 완성·검증된 웹앱 코드를 전혀 안 건드림. 작업 범위가 명확하게 작음.
- 단점(개발): 워치용 Wear OS 프로젝트 + 폰용 리스너 앱, 두 개를 새로 세팅해야 함.
- 단점(사용자 경험): 앱이 두 개로 쪼개짐(워치 동기화 앱 vs 브라우저로 여는 웹앱) — 홈 화면 아이콘 두 개, 로그인 세션 두 번 관리, "동기화 앱 켜서 확인 → 웹앱 열어서 분석 보기" 식으로 화면 전환이 필요해 캡스톤 시연 흐름이 매끄럽지 않을 수 있음.

### 옵션 B — 브릿지 + WebView 셸

기존 웹앱을 Capacitor 등으로 WebView 안에 감싸 "앱 하나"처럼 만들고, 그 안에 워치 브릿지(리스너) 기능만 네이티브 모듈로 추가. 사용자에게는 앱 하나로 보임.

- 장점(사용자 경험): 로그인 세션 하나, 화면 전환 없이 앱 하나 안에서 완결됨.
- 단점(개발): 카메라(복약 사진 인식)·위치(병원찾기)·Kakao Maps SDK 등 기존 웹 기능이 WebView 안에서 브라우저와 동일하게 동작한다는 보장이 없어 추가 디버깅 필요. Capacitor/Android Studio 빌드 환경을 새로 학습해야 함.
- 단점(사용자 경험): 완전 네이티브 앱보다 로딩이 굼뜨게 느껴질 수 있고, 오프라인 시 취약하며, 권한 요청 팝업이 미묘하게 이질적으로 보일 수 있음.

### 옵션 C — 전체 네이티브 리라이트 (비추천)

채팅·증상체크·복약관리까지 안드로이드 네이티브로 전부 다시 작성. 이미 완성된 웹앱을 갈아엎는 셈이라 솔로 개발 + 마감 시간 제약 대비 리스크가 가장 큼 — 채택하지 않음.

## 결론

아직 미결정. 마감까지 남은 시간에 따라 A(빠르고 안전, 대신 경험이 쪼개짐) vs B(경험은 매끄럽지만 개발 리스크·시간 더 필요) 중 선택 필요. 결정되면 별도 구현 계획(`docs/superpowers/plans/`)으로 태스크를 쪼갤 것.
