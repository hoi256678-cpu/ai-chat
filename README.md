<div align="center">

# HealthMate

**부담 없이 털어놓는 AI 상담 채팅을 중심으로, 증상 체크·병원 찾기·복약 관리까지 한곳에서 하는 헬스케어 웹앱**

의료IT공학과 졸업작품 · 지도교수 김상대 교수님 · 20205103 안성훈

[**🔗 배포 사이트**](https://ai-chat-black-nine.vercel.app)

![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_API-8E75B2?logo=googlegemini&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?logo=pytorch&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

</div>

<p align="center">
  <img src="docs/images/shot_chat_crisis.png" width="720" alt="AI 상담 채팅: 자살골에는 안내 없이 대화를 이어 가고, 자살충동에는 상담전화 109 안내 띠가 붙는다" />
  <br/><sub>AI 상담 채팅 (배포 환경): "자살골"은 안내 없이 대화를 이어 가고, "자살충동"에는 상담전화 109 안내 띠가 붙습니다</sub>
</p>

<p align="center">
  <img src="docs/images/demo_symptom_check.gif" width="320" alt="증상 체크 데모: 부위 선택부터 AI 분석 결과, 추천 진료과까지" />
  <br/><sub>증상 체크 데모: 부위 → 증상 → 기간 → 정도 → 메모 → AI 분석 결과 → 추천 진료과</sub>
</p>

<p align="center">
  <img src="docs/images/shot_main.png" width="23%" alt="메인 화면" />
  <img src="docs/images/shot_symptom.png" width="23%" alt="증상 체크: 부위 선택" />
  <img src="docs/images/shot_result.png" width="23%" alt="증상 분석 결과" />
  <img src="docs/images/shot_med.png" width="23%" alt="복용/복약 관리" />
</p>

---

## 왜 만들었나요?

힘든 마음을 털어놓고 싶어도 상담을 찾아가는 것 자체가 부담일 때가 있습니다. HealthMate의 중심은 **언제든 편하게 이야기할 수 있는 AI 상담 채팅**입니다. 대화 중 도움이 필요한 신호가 보이면 놓치지 않고 자살예방상담전화 109로 이어 주도록, 확실한 표현은 코드가, 애매한 표현만 AI가 판단하게 설계했습니다.

여기에 몸이 아플 때 흔히 생기는 "어느 과에 가야 하지?", "이 약은 언제 먹더라?" 같은 질문을 위해 **증상 체크 → 진료과 추천 → 주변 병원 → 복약 관리**를 함께 묶었습니다.

> ⚠️ HealthMate의 모든 결과는 **사전 참고용**이며 의사의 진단을 대신하지 않습니다. 화면마다 이 안내를 표시합니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 💬 **AI 상담 채팅 (핵심)** | 상담사 말투와 원칙을 정한 프롬프트로 대화하고, 오늘 대화·복약 현황·최근 증상 기록을 함께 참고해 내 상황을 아는 답을 합니다. 대화는 날짜별로 저장되어 달력에서 다시 볼 수 있습니다. 위기 표현(자살·자해 등)이 보이면 답변 아래에 자살예방상담전화 109 안내를 붙입니다. 띄어 쓰거나 기호를 섞은 표현("죽.고.싶.다")도 잡고, "자살골" 같은 합성어에는 괜히 울리지 않습니다([평가 문장 64개](docs/crisis-eval-set.md)). |
| 🩺 **증상 체크** | 인체 그림에서 아픈 부위를 누르고 증상·기간·정도를 5단계로 입력하면, AI가 의심 질환과 진료과를 정리해 줍니다. |
| 📷 **피부 사진 분석** | 피부 증상이면 사진을 함께 올릴 수 있습니다. 직접 학습한 이미지 분류 모델(EfficientNet-B0)이 병변 종류와 확신도를 알려주고, 이 결과를 AI 분석에 함께 넣습니다. |
| 🏥 **주변 병원 찾기** | 추천된 진료과로 현재 위치 반경 5km 안의 병원을 거리순으로 지도에 보여줍니다. (카카오 로컬 API) |
| 💊 **복용/복약 관리** | 약 봉투나 처방전 사진을 찍으면 약 이름을 인식해 등록하고, 복용 시간 알림·달력 기록을 제공합니다. 약 주의사항은 지금은 AI가 만든 참고용이며, 식약처 공식 데이터로 바꿀 예정입니다. |
| 📋 **내 건강 기록** | 지난 증상 체크 결과를 날짜별로 다시 볼 수 있습니다. |

## 기술 스택과 선택 이유

| 영역 | 선택 | 왜 골랐나 |
|---|---|---|
| 웹 프레임워크 | **Next.js 16 (App Router)**, React 19 | 화면과 서버 API(`app/api/*`)를 한 저장소에서 만들 수 있습니다. Gemini·카카오 키를 서버 라우트에만 두어 브라우저에 노출하지 않으려고 골랐습니다. |
| 언어 · 스타일 | **TypeScript**, **Tailwind CSS 4** | AI 응답(JSON)과 DB 레코드에 타입을 붙여 필드 누락을 컴파일 단계에서 잡습니다. 색은 CSS 변수 토큰으로 정의해 OS 다크 모드를 따라갑니다. |
| 인증 · DB | **Supabase** (Auth + Postgres) | 별도 백엔드 서버 없이 브라우저에서 바로 DB를 읽고 씁니다. 대신 모든 테이블에 RLS(`auth.uid() = user_id`)를 걸어 남의 기록은 읽을 수 없게 했습니다. 세션을 쿠키에 저장해 `proxy.ts`가 서버에서 로그인 여부를 확인합니다. |
| AI | **Gemini API** (REST 직접 호출) | 사진 입력(처방전 약 이름 인식)과 JSON 형식 응답이 모두 필요했습니다. SDK 없이 `fetch`로 호출해 의존성을 줄였습니다. |
| 지도 · 병원 검색 | **카카오 로컬 / 지도 API** | 처음에는 네이버 API를 썼는데, 카카오 키워드 검색은 좌표와 반경을 바로 받아 거리순으로 돌려줍니다. 주소 변환 단계가 하나 줄어서 옮겼습니다. |
| 이미지 모델 | **PyTorch**, EfficientNet-B0 전이학습 | ImageNet으로 사전학습된 가벼운 모델을 가져와 피부 병변 4종에 맞게 다시 학습했습니다. |
| 모델 서빙 | **FastAPI** | 모델이 Python이라 같은 언어로 `POST /predict` 하나만 여는 작은 서버를 따로 두었습니다. 웹앱과 코드를 공유하지 않아서, 서버가 꺼져도 웹앱은 영향을 받지 않습니다. |
| 형태소 분석 | **Kiwi** (`kiwi-nlp`, WebAssembly) | 위기 키워드가 "자살골"처럼 합성어의 일부일 때를 거르려고 썼습니다. 한국어 형태소 분석기를 직접 만드는 대신 검증된 라이브러리를 쓰고, 그 결과로 판정하는 규칙만 직접 짰습니다. 서버에서만 돌립니다. |
| 테스트 | **Vitest** | 알고리즘(Aho-Corasick, 정규화)과 위기 판정을 테스트로 고정하고, 정답을 붙인 평가 문장으로 오탐·미탐을 잽니다. |
| 배포 | **Vercel** | GitHub에 push하면 자동으로 배포됩니다. |

## 아키텍처

```mermaid
flowchart TB
    subgraph Client["사용자 기기"]
        B["PC · 모바일 브라우저"]
    end

    subgraph Vercel["Vercel"]
        Pages["Next.js 페이지<br/>(proxy.ts 로그인 확인)"]
        API["API 라우트<br/>/api/chat · /api/symptom-check<br/>/api/hospitals · /api/medications/*"]
    end

    B --> Pages
    Pages -->|fetch| API
    Pages -->|"직접 읽기/쓰기 (RLS)"| DB[("Supabase<br/>Auth + Postgres")]
    API --> Gemini["Gemini API"]
    API --> Kakao["카카오 로컬 API"]
    Pages -->|지도 SDK| KMap["카카오 지도"]
    API -->|피부 사진, 8초 제한| ML["ML 서버<br/>FastAPI + EfficientNet-B0"]
```

- **두 갈래의 데이터 경로:** 기록 저장과 조회는 브라우저에서 Supabase로 직접 갑니다. RLS가 사용자를 구분해서 중간 서버가 필요 없습니다. 외부 API 키가 필요한 호출(AI, 병원 검색, 이미지 분류)만 서버 라우트를 거칩니다.
- **로그인 확인은 한 곳에서:** `proxy.ts`가 보호할 페이지 목록만 지정해 로그인 여부를 확인합니다. 페이지마다 따로 두었던 확인 코드 5개를 이 파일 하나로 합쳤습니다. `/api/*`는 이 목록에 넣지 않아서, Supabase 장애가 AI 기능까지 막지 않습니다.
- **선택 기능은 꺼져도 괜찮게:** ML 서버가 없어도 피부 사진 분석만 빠지고 나머지 기능은 그대로 동작합니다.

## 주요 흐름

<details open>
<summary><b>1. AI 상담 채팅과 위기 표현 감지</b></summary>

<p align="center">
  <img src="docs/images/shot_chat_calendar.png" width="720" alt="대화 일기: 달력에서 날짜를 고르면 그날 기분과 일정을 남기고 지난 대화를 다시 볼 수 있다" />
  <br/><sub>대화 일기: 날짜별 대화 기록, 그날 기분과 일정. 일정은 AI 상담이 오늘·내일 일을 참고하는 데 쓰입니다</sub>
</p>

```mermaid
sequenceDiagram
    actor U as 사용자
    participant C as /chat
    participant DB as Supabase
    participant A as /api/chat
    participant G as Gemini

    C->>DB: 입장 시 한 번 조회<br/>(오늘 대화, 복약 현황, 최근 증상 3건)
    U->>C: 메시지 입력
    C->>A: 대화 + 상담사 페르소나 + 내 기록 요약
    Note over A: crisisLevel() 판정 (lib/crisisDetection.ts)<br/>정규화 + Aho-Corasick
    alt direct이고 "자살"·"자해"가 들어 있음 (합성어일 수 있음)
        par 동시에 시작
            A->>G: 대화 + 응답 형식 강제 {reply, crisis}
        and
            A->>A: Kiwi 형태소 분석 → refineWithMorphemes()
        end
        A-->>C: 혼자 쓰인 단어면 109 안내 띠, 합성어면 Gemini 판단을 따름
    else direct: 원문에 위기 표현이 그대로 있음
        A->>G: 대화 + "안내가 따로 나간다"는 지시
        G-->>A: 공감하는 답변
        A-->>C: 답변 + 109 안내 띠 (항상)
    else normalized: 정규화해야만 걸림 ("죽.고.싶.다", "모자 살 거야")
        A->>G: 대화 + 응답 형식 강제 {reply, crisis}
        G-->>A: 답변 + 위기 여부 판단
        A-->>C: 답변 (+ crisis가 true면 109 안내 띠)
    else none: 일반 메시지
        A->>G: 대화 + 시스템 프롬프트
        G-->>A: 답변
        A-->>C: 답변
    end
    C--)DB: 대화 저장 (서버의 최종 판정 crisis도 함께)
```
</details>

<details>
<summary><b>2. 증상 체크 → 진료과 추천 → 주변 병원</b></summary>

```mermaid
sequenceDiagram
    actor U as 사용자
    participant P as /symptom-check
    participant A as /api/symptom-check
    participant ML as ML 서버
    participant G as Gemini
    participant H as /api/hospitals
    participant K as 카카오 로컬
    participant DB as Supabase

    U->>P: 부위 → 증상 → 기간 → 정도 → 메모 (5단계)
    P->>A: 증상 입력 (피부면 사진 첨부 가능)
    opt 사진이 있으면
        A->>ML: POST /predict (8초 제한)
        ML-->>A: 병변 종류 + 확신도
        Note over A,ML: 꺼져 있거나 시간 초과면<br/>사진 없이 텍스트 분석으로 진행
    end
    A->>G: 증상 프롬프트 (+ 분류 결과)
    G-->>A: JSON (의심 질환, 진료과, 요약, 안내문)
    A-->>P: 결과 (JSON 파싱 실패 시 안전한 기본값)
    P--)DB: 결과 저장 (실패해도 화면은 그대로)
    U->>P: 추천 진료과 선택
    P->>H: 현재 위치 + 진료과
    H->>K: 키워드 검색 (반경 5km, 거리순)
    K-->>P: 병원 목록 → 카카오 지도에 표시
```
</details>

<details>
<summary><b>3. 복약 등록과 복용 알림</b></summary>

```mermaid
flowchart TD
    S["약 봉투·처방전 사진"] -->|/api/medications/extract| E["Gemini가 약 이름 + 복용 간격 인식"]
    M["직접 입력"] --> T
    E --> T["복용 간격 → 하루 복용 시각 생성<br/>예: 08:00, 4시간 → 6회"]
    T -->|/api/medications/precautions| P["Gemini가 주의사항 3~5개 작성"]
    P --> DB[("Supabase<br/>medications")]
    DB --> D["오늘 먹을 약 체크리스트"]
    D -->|복용 체크| L[("medication_logs<br/>중복 체크는 무시")]
    D --> N["30초마다 시간 지난 복용 확인"]
    N --> Bell["메인 화면 종 알림"]
    N --> Toast["어느 화면에서나 토스트 알림"]
```
</details>

<details>
<summary><b>4. 회원가입 · 로그인 · 페이지 보호</b></summary>

```mermaid
flowchart LR
    SU["/signup<br/>닉네임 + 이메일 + 비밀번호"] -->|가입 후 바로 로그아웃| L["/ 로그인"]
    L -->|자동 로그인 체크| C1["쿠키 세션 (유지)"]
    L -->|체크 안 함| C2["쿠키 세션 (브라우저 닫으면 삭제)"]
    C1 & C2 --> PX{"proxy.ts<br/>로그인했나?"}
    PX -->|예| Main["/main 허브"]
    PX -->|아니오| L
    Main --> F["/chat · /symptom-check · /medications<br/>/health-records · /settings"]
```
</details>

## 기술적으로 고민한 부분

### 1. 위기 표현 감지: 변형 표현까지 잡는 단계별 판정 (직접 구현)

**문제:** 처음에는 위기 키워드 7개를 `includes()`로 하나씩 확인했습니다. 그래서 "죽 고 싶어", "죽.고.싶.다"처럼 띄어 쓰거나 기호를 섞은 표현을 놓쳤습니다. 위기 감지에서는 놓치는 것(미탐)이 잘못 울리는 것(오탐)보다 위험합니다.

**설계:** 정규화(한글·영문·숫자만 남김)를 하면 변형은 잡히지만 "내일 모자 살 거야" 같은 우연한 조합도 걸립니다. 그래서 원문용과 정규화용 Aho-Corasick 두 개로 판정을 세 단계로 나눴습니다.

| 판정 | 뜻 | 처리 |
|---|---|---|
| `direct` | 원문에 키워드가 그대로 있음 | 109 안내를 항상 표시 |
| `normalized` | 정규화해야만 걸림 | Gemini가 문맥으로 판단해 위기일 때만 안내 |
| `none` | 걸리지 않음 | 평소 대화 |

확실한 것은 코드가 결정적으로 처리하고, 애매한 것만 AI의 문맥 판단에 맡기는 구조입니다.

**측정 결과** (2026-11-05 기준 정답을 붙인 47문장, `lib/crisisEval.data.ts`, 지금은 64문장 — [문장 전체와 판정 결과](docs/crisis-eval-set.md))

| 종류 | 결과 |
|---|---|
| 그대로 쓴 위기 표현 8개 | 8/8 `direct` (미탐 0) |
| 쪼개 쓴 위기 표현 8개 | 8/8 `normalized` → Gemini 판단 후 8/8 안내 |
| 평범한 일상 문장 12개 | 오탐 0 |
| 함정 문장 ("피자 살게", "의자 살까" 등) | 정규화로 걸린 함정은 Gemini가 위기 아님으로 판단 (0/5 오탐, 1건 API 오류) |

- **발견:** 처음에는 Gemini에게 "위기면 답 앞에 `[위기]`를 붙여라"라고 문장으로 지시했는데, 쪼개 쓴 위기 8개 중 1개만 표시됐습니다. 답장은 위로하면서 표시를 빠뜨린 것입니다. 응답 형식(JSON 스키마 `{reply, crisis}`)으로 판단 칸을 강제하자 8/8이 됐습니다. 프로그램이 읽어야 하는 값은 문장 속 지시가 아니라 응답 형식으로 받아야 한다는 것을 측정으로 확인했습니다.
- **한계:** "자살 예방 캠페인 포스터 만들었어"처럼 원문에 단어가 그대로 있는 문장은 `direct`로 걸리는 오탐이 남아 있습니다. 돌려 말하기("다 끝내고 싶어")는 키워드로 잡지 않고 상담 답변에 맡깁니다(답변에서 상담 권유 7/7).

**형태소로 합성어 거르기 (2026-11-20)**

"어제 축구에서 자살골 넣었어"처럼 키워드가 다른 단어의 일부일 때도 `direct`가 되는 문제가 있었습니다. 한국어 형태소 분석기 [Kiwi](https://github.com/bab2min/Kiwi)(`kiwi-nlp`, WebAssembly)로 문장을 쪼개 보니 Kiwi도 "자살골"을 `자살 + 골`로 나눠서, "자살이라는 토큰이 있나"만으로는 걸러지지 않았습니다. 그래서 **같은 어절에서 명사 키워드 바로 뒤에 다른 명사가 붙으면 합성어**로 보고 `normalized`로 낮춰 Gemini가 판단하게 했습니다(직접 작성: `refineWithMorphemes`).

| 문장 | 전 | 후 |
|---|---|---|
| 어제 축구에서 자살골 넣었어 | `direct` | `normalized` → 안내 없음 |
| 자살충동이 자꾸 들어 | `direct` | `normalized` → Gemini가 위기로 판단해 안내 |
| 나 자살하고 싶어 | `direct` | `direct` (혼자 쓰인 단어, 항상 안내) |

- 평가 문장 64개([전체 목록](docs/crisis-eval-set.md))에서 판정이 바뀐 것은 합성어 5개뿐이었고, 그대로 쓴 위기 표현 15개는 모두 `direct`를 유지했습니다(미탐 0). 배포 환경(Vercel 미리보기)에서 위 문장을 직접 보내 같은 결과를 확인했습니다.
- **왜 키워드를 좁히지 않았나:** 키워드를 "자살하고 싶" 같은 의도 표현으로 좁히면 오탐은 더 줄지만 "자살 생각이 나요" 같은 진짜 위기까지 AI 판단에 넘어갑니다. 위기 감지는 미탐이 먼저라, 넓은 키워드는 코드로 확실히 잡고 확실히 아닌 합성어만 걸렀습니다. Kiwi는 Gemini 판단과 동시에 시작하고, 실패하거나 8초를 넘기면 안내를 띄웁니다.
- **비용:** 모델 약 104MB(빌드 때 공식 릴리스에서 내려받아 저장소에 넣지 않음), 메모리 약 860MB, 서버가 깨어난 뒤 첫 준비 수 초. 채팅방에 들어오는 순간 준비 요청을 보내 사용자가 입력하는 동안 끝내 둡니다.
- 서버 로그에 Kiwi가 `Quantization is not supported for ArchType::none…`을 남기는데, 모델을 불러올 때 나오는 안내 문구라 동작과는 상관없습니다.
- **키워드 넓히기:** 붙여 쓴 형태(살기싫 등)와 의도 표현(살고 싶지 않, 목숨을 끊 등) 7개를 더해, 전에는 완전히 놓치던 위기 문장 4개를 `direct`로 잡았습니다. 대신 "뉴스에서 연예인이 목숨을 끊었대" 같은 문장도 안내가 뜨는 것을 감수했습니다.

**왜 Aho-Corasick인가 (트레이드오프)**

| 짧은 채팅 메시지 기준 (Mac, Node 24, 7회 중앙값, 호출당) | `includes()` | 정규화 + Aho-Corasick |
|---|---:|---:|
| 지금 규모: 키워드 14개 | **0.13µs** | 0.38µs |
| 역전 구간: 키워드 40개 → 45개 | 0.36µs → 0.42µs | 0.42µs → **0.40µs** |

키워드 40개까지는 `includes()`가, 45개부터는 Aho-Corasick이 빠릅니다(3번 반복해도 같음). `includes()`는 키워드가 늘수록 시간이 함께 늘지만(1,007개에서 11.1µs) Aho-Corasick은 키워드 수와 상관없이 약 0.4µs로 거의 같습니다. 지금 규모에서는 `includes()`가 더 빠릅니다. 다만 둘 다 1µs 미만이라 Gemini 응답(2~4초) 옆에서는 차이가 없습니다. `includes()`는 키워드 수만큼 글을 다시 훑고 Aho-Corasick은 한 번만 훑기 때문에, 변형 표현을 키워드로 늘려도 비용이 메시지 길이에만 비례한다는 점을 보고 골랐습니다.

**구현 과정:** 트라이 → BFS로 실패 링크 → Aho-Corasick 검색을 먼저 C로 직접 구현하고 자체 채점기로 검증한 뒤(`study/`), TypeScript로 옮겼습니다(`lib/algorithms/`). 단계마다 막혔던 지점과 디버깅 과정은 [`docs/study/algorithm-study-log.md`](docs/study/algorithm-study-log.md)에, 직접 작성한 코드와 AI가 맡은 부분(문제·테스트·채점기·측정 스크립트·리뷰)의 구분은 [`docs/study/AUTHORSHIP.md`](docs/study/AUTHORSHIP.md)에 기록했습니다.

### 2. 피부 병변 분류 모델 직접 학습

- 공개 피부경 이미지 데이터셋 **HAM10000**으로 ImageNet 사전학습 **EfficientNet-B0**를 전이학습했습니다.
- 4종 분류: 광선각화증/보웬병(akiec) · 기저세포암(bcc) · 피부섬유종(df) · 혈관 병변(vasc)
- **검증 정확도 91.7%**
- 데이터 정리(`organize_ham10000.py`), 분할(`prepare_data.py`), 학습(`train.py`), 서빙(`serve.py`) 단계마다 pytest 테스트를 두었습니다.

**안전 설계:** 모델 결과를 그대로 "진단"으로 보여주지 않습니다. "○○ 의심 소견 (모델 확신도 N%)" 형태로 AI 분석의 참고 자료로만 넘기고, ML 서버가 꺼져 있거나 8초 안에 응답하지 않으면 사진 없이 텍스트 분석으로 자동 전환됩니다(`lib/skinClassifier.ts`).

### 3. 의료 서비스다운 응답 설계

- 위기 표현이 확실하면(`direct`) AI 답변과 상관없이 상담·긴급 연락처(109 · 112 · 119) 안내 띠를 항상 표시합니다. 애매한 경우만 AI 판단에 맡깁니다.
- 모든 분석 결과 화면에 "사전 참고용이며 반드시 의료기관을 방문하라"는 안내를 고정으로 표시합니다.

## 한계와 향후 계획

- **ML 서버 상시 배포**: 지금은 ML 서버를 로컬 PC에서 실행하고 터널로 연결합니다. 클라우드 상시 배포가 다음 목표입니다.
- **확신도 보정**: 의료에서는 정확도만큼 "확신도를 믿을 수 있는가"가 중요하다고 보고, temperature scaling 등 보정 기법을 적용해 보려 합니다.
- **위기 판단의 단계별 기준선**: 지금 돌려 말하기("다 끝내고 싶어")는 키워드에 걸리지 않아 위기 판단을 받지 않습니다. `direct`가 아닌 모든 메시지에 AI 위험도 점수를 받고, 코드가 단계별 기준선(키워드 흔적이 있으면 민감하게, 없으면 엄격하게)으로 안내 여부를 정해 오탐과 미탐을 함께 줄이는 것이 다음 목표입니다.

## 실행 방법

### 웹앱

```bash
npm install
cp .env.local.example .env.local   # 키 값 채우기
npm run dev                        # http://localhost:3000
```

테스트: `npm test` (처음 실행할 때 Kiwi 모델 약 104MB를 내려받습니다).

필요한 환경 변수: `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `KAKAO_REST_API_KEY`, `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` (선택: `ML_SERVICE_URL`). DB 스키마는 `supabase/schema.sql`에 있습니다.

### ML 서버 (선택)

```bash
cd ml-service
pip install -r requirements.txt
uvicorn serve:app --port 8000
```

학습된 가중치 파일(`skin_model.pth`)은 용량 때문에 저장소에 포함하지 않았습니다. HAM10000을 내려받아 `train.py`로 다시 학습할 수 있습니다. ML 서버가 없으면 피부 사진 분석만 빠지고 나머지 기능은 그대로 동작합니다.

## 패키지 구조

```
ai-chat/
├── app/                        # Next.js App Router (페이지 + 서버 API)
│   ├── page.tsx                #   로그인
│   ├── signup/                 #   회원가입
│   ├── main/                   #   메인 허브 (기능 카드, 복용 알림 종)
│   ├── symptom-check/          #   5단계 증상 체크 → 결과 → 병원 지도
│   ├── chat/                   #   오늘의 AI 상담 채팅
│   ├── chats/                  #   지난 대화 달력 → [date] 날짜별 다시 보기
│   ├── medications/            #   복약 카드 + 오늘 체크리스트, add/ 약 등록
│   ├── health-records/         #   지난 증상 기록
│   ├── settings/               #   닉네임 변경
│   └── api/                    #   서버 전용 (API 키는 여기서만 사용)
│       ├── chat/               #     위기 감지 → Gemini 상담
│       ├── symptom-check/      #     (피부 분류) → Gemini 증상 분석
│       ├── hospitals/          #     카카오 로컬 병원 검색
│       └── medications/        #     extract(사진 → 약 이름), precautions(주의사항)
├── components/                 # UI 컴포넌트
│   ├── BodyDiagram.tsx         #   부위를 고르는 인체 그림 (SVG)
│   ├── HospitalMap.tsx         #   위치 확인 + 카카오 지도 마커
│   ├── SymptomResultView.tsx   #   증상 분석 결과 화면
│   ├── CardDeck.tsx            #   넘기는 카드 묶음 (복약, 증상 기록)
│   ├── DoseToaster.tsx         #   어느 화면에서나 뜨는 복용 알림
│   └── ...                     #   채팅 말풍선, 상세 시트 등
├── lib/                        # 화면과 분리한 로직
│   ├── ai.ts · gemini.ts       #   Gemini REST 호출
│   ├── symptomCheck.ts         #   증상 프롬프트 + JSON 파싱(실패 시 기본값)
│   ├── chatPersona.ts          #   상담사 말투·원칙 프롬프트
│   ├── crisisDetection.ts      #   위기 표현 단계별 판정 (direct / normalized / none)
│   ├── algorithms/             #   직접 구현: Aho-Corasick, 정규화 (+ 테스트)
│   ├── skinClassifier.ts       #   ML 서버 호출 (8초 제한, 실패 시 null)
│   ├── hospitals.ts            #   카카오 로컬 검색
│   ├── medications.ts          #   복약 CRUD, 복용 시각 생성, 오늘 체크리스트 계산
│   ├── doseNotifications.ts    #   복용 알림 (본 것 / 띄운 것 따로 관리)
│   ├── chatHistory.ts · symptomHistory.ts  # Supabase 기록 읽기/쓰기
│   └── supabase/client.ts      #   브라우저용 Supabase 클라이언트 (쿠키 세션)
├── proxy.ts                    # 보호 페이지 로그인 확인 (Next 16의 middleware)
├── supabase/schema.sql         # 테이블 + RLS 정책
├── ml-service/                 # 피부 병변 분류 (Python, 웹앱과 분리)
│   ├── organize_ham10000.py    #   데이터 정리
│   ├── prepare_data.py         #   학습/검증 분할
│   ├── train.py · model.py     #   EfficientNet-B0 전이학습
│   ├── serve.py                #   FastAPI POST /predict
│   └── test_*.py               #   단계별 pytest
├── study/                      # Aho-Corasick C 구현 + 자체 채점기
└── docs/
    ├── superpowers/            #   기능별 설계(specs) · 구현 계획(plans)
    ├── study/                  #   알고리즘 공부 기록, 직접 작성 코드 목록
    └── images/                 #   README 스크린샷
```

## 출처

- 피부 이미지 데이터: HAM10000 (Tschandl et al., 2018, Harvard Dataverse)
- 인체 그림: MoleMapper body map (Apache-2.0). 자세한 내용은 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- 형태소 분석: Kiwi (`kiwi-nlp` 0.24.1, 모델 v0.24.1 base, Apache-2.0). 자세한 내용은 같은 파일
