# 피부질환 이미지 분류 + 증상체크 통합 기능 설계

> **상태 (2026-08-06):** ml-service 학습 완료(검증 정확도 91.7%, 4 클래스). "기존 증상체크 플로우에 통합" + API 라우트 변경까지 구현 완료(`local-ollama`). "지난 기록 화면 리뉴얼"과 "캘린더 연동"은 아직 미착수 — 별도 계획으로 진행 예정.

## 배경

지도교수 피드백(2026-07-31, 스크린샷 2장):

1. 피부 이미지셋을 딥러닝 모델에 직접 학습 (본인 컴퓨터)
2. 그 모델을 웹앱(서버)에 연동
3. 사용자가 웹앱(브라우저)에서 카메라로 촬영
4. 분류 결과(무슨 병인지) + Gemini 결과를 합쳐서 병원 추천 또는 자가관리 권장
5. (참고, 이번 스코프 아님) 시계열 추적 — 1일차/31일차 사진 비교로 호전/악화 판단

피부질환은 "실생활에서 사용자가 쓰기 좋은 헬스케어 이미지처리 기능"의 대표 예시로 선택된 것 — 이 기능 자체가 최종 확정 스코프임.

이 기능은 capstone(의료IT공학과 졸업작품) 평가에서 "직접 만든 기술 깊이"를 보여주는 핵심 요소로, 기존에 논의된 "AI API 프롬프팅만으로는 기술 깊이 부족" 우려를 해소하는 방향.

## 제약 조건

- 솔로 개발, 졸작 마감까지 1개월 미만 남음 → MVP 범위를 최대한 좁게 잡음
- 로컬 GPU: RTX 4070 SUPER (12GB VRAM)
- 기존 스택: Next.js(canary) App Router + Supabase + Gemini/Ollama, `local-ollama`/`master` 두 브랜치 구조

## 데이터셋 & 모델

- **데이터셋**: ~~AI Hub "피부질환 진단 의료 이미지"~~ → **HAM10000** (하버드 Dataverse/Kaggle에 공개된 피부병변 이미지 벤치마크 데이터셋)로 변경. AI Hub 버전은 "헬스케어 데이터 안심존" 전용이라 로컬 다운로드가 불가능하고, IRB(기관생명윤리위원회) 심의 서류 + GPU 서버 신청 후 최소 14일 대기 + 30일 한정 이용이라는 절차가 있어 1개월 미만 마감과 맞지 않아 제외함 (2026-07-31 확인).
  - HAM10000은 7개 병변 클래스(`akiec`, `bcc`, `bkl`, `df`, `mel`, `nv`, `vasc`) 중 **`vasc`, `df`, `bcc`, `akiec` 4종**만 사용 — 시각적으로 서로 뚜렷이 구분되는 조합으로 골라서 정확도 90% 목표에 유리하게 함. `nv`(일반 점)는 전체의 약 67%를 차지하는 압도적 다수 클래스라 포함 시 정확도 지표가 왜곡될 수 있어 제외.
  - IRB나 별도 승인 절차 없이 즉시 다운로드 가능
- HAM10000 원본 배포 형식은 폴더당 클래스가 아니라 **평평한 이미지 폴더 + `HAM10000_metadata.csv`(image_id → dx 라벨)** 구조라, `prepare_data.py`가 기대하는 `raw_dir/<class>/*.jpg` 구조로 변환하는 어댑터 스크립트(`organize_ham10000.py`)가 한 단계 더 필요함
- 병리(조직검사) 이미지 데이터셋은 폰카메라 촬영 시나리오와 맞지 않아 제외
- **모델**: ImageNet 사전학습 CNN(EfficientNet-B0 또는 ResNet 계열)을 전이학습(fine-tuning) — 클래스 수를 좁혔기 때문에 처음부터 학습하는 것보다 12GB VRAM/1개월 제약에서 훨씬 현실적
- 학습 스크립트는 `ml-service/train.py`, 결과 가중치는 `ml-service/skin_model.pth`로 저장

## 서빙 아키텍처

- **`ml-service/`** (신규 최상위 디렉토리, Python/FastAPI) — `serve.py`가 `POST /predict`로 이미지를 받아 `{class, confidence}` 반환
- Next.js 앱과는 별도 프로세스로 로컬에서 `uvicorn`으로 구동 — 기존 `local-ollama` 브랜치가 로컬 Ollama 서버(`localhost:11434`)를 호출하는 것과 동일한 패턴
- Vercel 배포판(master)에서는 이 서비스가 존재하지 않으므로, 사진 분류는 로컬 개발 환경에서만 동작 — 프로덕션에서는 아래 에러 처리대로 텍스트 전용 경로로 자동 폴백

## 기존 증상체크 플로우에 통합 (신규 페이지/라우트 없음)

`app/symptom-check/page.tsx`는 이미 "피부"를 신체부위 퀵 옵션으로 갖고 있고 그때 증상 목록도 세팅되어 있음 — 새 페이지/라우트를 만들지 않고 기존 5단계 위저드에 조건부로 얹는다.

- **STEP 1 (증상 선택)**: 기존 그대로, 변경 없음
- **STEP 4 (추가로 하고 싶은 말)**: `bodyPart === "피부"`일 때만, 기존 메모 텍스트박스 **아래에** "사진 첨부 (선택)" 버튼 추가
  - `<input type="file" accept="image/*" capture="environment">` — 모바일에서는 카메라 앱, 데스크탑에서는 파일 선택창
  - 별도 라이브 카메라 프리뷰(getUserMedia)는 구현하지 않음 — 1개월 타임라인 리스크 회피
  - 선택된 이미지는 `FileReader`로 base64 인코딩해서 클라이언트 상태에 보관
- **제출**: 기존 `POST /api/symptom-check` 요청 바디에 `photo?: string` (base64) 필드만 추가

## API 라우트 (`app/api/symptom-check/route.ts`) 변경

1. `photo`가 있으면 로컬 `ml-service`(`http://localhost:8000/predict`)로 전달 → `{class, confidence}` 수신
   - 서비스 응답 없음/타임아웃 → 분류 없이 텍스트 증상만으로 기존 방식대로 진행 (사용자에게 실패를 노출하지 않는 best-effort 폴백 — `symptomHistory` 저장 실패 처리와 같은 패턴)
2. `lib/symptomCheck.ts`의 프롬프트 빌더에 분류 결과를 컨텍스트로 주입
   - 지시문: "이미지 분류 모델이 낸 결과가 사용자가 보고한 증상(가려움/붉어짐/지속기간 등)과 일치하는지 검토하라. 일치하면 그대로 안내하고, 불일치하는 듯하면 이를 명시적으로 언급하며 병원 방문/자가관리를 권장하라."
   - 분류 확신도(confidence)가 낮으면 "참고 정보로만 활용" 지시를 프롬프트에 추가해 과신 방지
3. **AI 프로바이더**: `photo`가 있는 요청은 `lib/ai.ts`의 `generateReply`(현재 브랜치 기준 Ollama 자동전환)를 거치지 않고 `lib/gemini.ts`를 **직접 호출**하도록 강제. 사진이 없는 기존 텍스트 전용 요청은 그대로 `generateReply` 유지.
   - 이유: 지도교수가 "제미나이 결과"와의 2차 검증을 명시적으로 지목했고, 분류 결과의 일치 여부를 판단하는 검증 역할은 로컬 모델(Ollama)보다 신뢰도가 검증된 Gemini가 맡는 게 안전
4. 반환 타입은 기존 `SymptomResult`({conditions, departments, summary, disclaimer, homeCare, foods}) 그대로 — 화면단(`SymptomResultView`, `HospitalMap`) 변경 없음

## 지난 기록 화면 리뉴얼 (`app/symptom-check/history/page.tsx`)

- 기존: 세로 아코디언 리스트 (탭하면 인라인 펼침)
- 변경: **가로 스와이프 카드** — 카드에는 부위·날짜·주요 소견만 요약 표시
- 카드 탭 → **하단 바텀시트**로 `SymptomResultView` 전체 상세 노출 (`app/chats/page.tsx`의 "기간 선택" 바텀시트와 동일한 `fixed inset-0 … items-end` 패턴 재사용)

## 캘린더 연동 (`app/chats/page.tsx`)

- `lib/symptomHistory.ts`에 `lib/chatHistory.ts`의 `getDatesWithHistory()`와 대응되는 **`getSymptomCheckDates()`** 추가
- 기존 메인 캘린더(`/chats`, "대화 일기")에 증상체크 기록이 있는 날을 **다른 색 점/배지**로 표시 — 기존 채팅 기록 점(`bg-accent`)과 시각적으로 구분되는 별도 마커
- 새 페이지 없이 기존 캘린더 하나에 정보만 추가

## 스코프 밖 (Non-goals, 이번 MVP)

- 시계열 추적(1일차 vs 31일차 호전/악화 비교) — 시간 남으면 추후 스트레치 목표
- 라이브 카메라 프리뷰 UI (getUserMedia 기반 커스텀 촬영 화면)
- 32종 전체 분류 — 5~10종 서브셋만

## 검증 계획

- 레포에 테스트 러너 없음(기존 CLAUDE.md 명시) — 자동화 테스트 대신 수동 스모크 테스트로 검증
- 모델 학습 시 held-out validation set으로 클래스별 정확도 산출 (졸작 발표 자료로도 활용)
- 수동 확인: 클래스별 샘플 사진으로 분류 결과 + Gemini 검증 문구가 말이 되는지, 확신도 낮은 케이스에서 과신하지 않는지 확인
