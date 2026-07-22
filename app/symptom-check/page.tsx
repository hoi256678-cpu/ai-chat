"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";
import type { SymptomResult } from "@/lib/symptomCheck";
import { BodyDiagram } from "@/components/BodyDiagram";

const QUICK_BODY_PARTS = ["피부", "전신", "기타"];

// shown only after a specific diagram region is selected, to narrow down further
const SUB_BODY_PARTS: Record<string, string[]> = {
  "머리": ["눈", "코", "귀", "입/치아"],
};

const SYMPTOMS_BY_PART: Record<string, string[]> = {
  "머리": ["두통", "어지러움", "시야 흐림", "이명", "기타"],
  "목": ["뻣뻣함", "통증", "삼킬 때 아픔", "붓기", "기타"],
  "어깨": ["통증", "움직임 제한", "저림", "붓기", "기타"],
  "가슴": ["답답함", "통증", "두근거림", "숨참", "기타"],
  "배(복부)": ["복통", "메스꺼움/구토", "설사", "변비", "소화불량", "기타"],
  "등 위쪽": ["뻐근함", "통증", "자세 관련 통증", "기타"],
  "허리": ["통증", "뻐근함", "다리 저림", "움직임 제한", "기타"],
  "골반": ["통증", "저림", "움직임 제한", "기타"],
  "엉덩이": ["통증", "저림(다리로 이어짐)", "앉을 때 불편함", "기타"],
  "팔": ["통증", "저림/마비", "부어오름", "힘빠짐", "기타"],
  "팔꿈치": ["통증", "뻣뻣함", "부어오름", "구부리기 힘듦", "기타"],
  "손목/손": ["저림/마비", "통증", "붓기", "쥐는 힘 약화", "기타"],
  "다리": ["통증", "저림/마비", "부어오름", "쥐남(경련)", "기타"],
  "무릎": ["통증", "붓기", "삐걱거림/소리", "구부리기 힘듦", "불안정함", "기타"],
  "발목/발": ["통증", "붓기", "삠(염좌)", "저림", "걷기 힘듦", "기타"],
  "눈": ["시림", "충혈", "가려움", "시야 흐림", "눈곱", "기타"],
  "귀": ["통증", "먹먹함", "이명", "가려움", "분비물", "기타"],
  "코": ["코막힘", "콧물", "재채기", "냄새 저하", "코피", "기타"],
  "입/치아": ["치통", "잇몸 통증", "구내염", "목 안 통증", "입 마름", "기타"],
  "전신": ["발열", "오한", "피로감", "식욕 저하", "체중 변화", "기타"],
  "피부": ["발진", "가려움", "붉어짐", "부어오름", "물집", "기타"],
};

const FALLBACK_SYMPTOMS = [
  "통증",
  "저림/마비",
  "부어오름",
  "발열",
  "어지러움",
  "메스꺼움/구토",
  "기타",
];

function getSymptomOptions(bodyPart: string | null) {
  if (!bodyPart) return FALLBACK_SYMPTOMS;
  return SYMPTOMS_BY_PART[bodyPart] ?? FALLBACK_SYMPTOMS;
}

const DURATIONS = ["오늘 처음", "며칠째", "1주일 이상", "한 달 이상(만성)"];

const SEVERITIES = ["약함", "보통", "심함"];

const TOTAL_STEPS = 5;

export default function SymptomCheckPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);

  const [bodyPartView, setBodyPartView] = useState<"front" | "back">("front");
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [showCustomBodyPart, setShowCustomBodyPart] = useState(false);
  const [customBodyPart, setCustomBodyPart] = useState("");

  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [showCustomSymptom, setShowCustomSymptom] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");

  const [duration, setDuration] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SymptomResult | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  function selectBodyPart(part: string) {
    setBodyPart(part);
    setShowCustomBodyPart(false);
    setSymptoms([]);
    setShowCustomSymptom(false);
    setCustomSymptom("");
  }

  function selectCustomBodyPart() {
    setBodyPart("");
    setShowCustomBodyPart(true);
    setSymptoms([]);
    setShowCustomSymptom(false);
    setCustomSymptom("");
  }

  function toggleSymptom(value: string) {
    if (value === "기타") {
      setShowCustomSymptom((prev) => !prev);
      return;
    }
    setSymptoms((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function reset() {
    setStep(0);
    setBodyPartView("front");
    setBodyPart(null);
    setShowCustomBodyPart(false);
    setCustomBodyPart("");
    setSymptoms([]);
    setShowCustomSymptom(false);
    setCustomSymptom("");
    setDuration(null);
    setSeverity(null);
    setNote("");
    setError("");
    setResult(null);
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    const finalSymptoms = [
      ...symptoms,
      ...(showCustomSymptom && customSymptom.trim() ? [customSymptom.trim()] : []),
    ];

    try {
      const res = await fetch("/api/symptom-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyPart,
          symptoms: finalSymptoms,
          duration,
          severity,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "결과를 받지 못했습니다.");
      }
      setResult(data as SymptomResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  const symptomOptions = getSymptomOptions(bodyPart);

  const canGoNext =
    (step === 0 && bodyPart && bodyPart.trim().length > 0) ||
    (step === 1 &&
      (symptoms.length > 0 || (showCustomSymptom && customSymptom.trim().length > 0))) ||
    (step === 2 && duration) ||
    (step === 3 && severity);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/main")}
          aria-label="메인으로 돌아가기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="font-semibold text-ink">증상 체크</span>
      </header>

      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-md flex-col">
          {!result && (
            <>
              <p className="mb-6 text-center text-xs font-medium text-sub">
                STEP {step + 1} / {TOTAL_STEPS}
              </p>

              {step === 0 && (
                <StepSection title="어디가 아프세요?" subtitle="그림에서 부위를 눌러 선택하세요.">
                  <BodyDiagram
                    view={bodyPartView}
                    onViewChange={setBodyPartView}
                    selected={showCustomBodyPart ? null : bodyPart}
                    onSelect={selectBodyPart}
                  />

                  <p className="mt-4 text-center text-sm text-sub">
                    {showCustomBodyPart
                      ? "직접 입력해주세요."
                      : bodyPart
                        ? `선택한 부위: ${bodyPart}`
                        : "그림을 눌러 부위를 선택하세요."}
                  </p>

                  {!showCustomBodyPart && bodyPart && SUB_BODY_PARTS[bodyPart] && (
                    <div className="mt-4">
                      <p className="mb-2 text-center text-xs text-sub">
                        더 구체적으로 선택할 수 있어요.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {SUB_BODY_PARTS[bodyPart].map((part) => (
                          <ChipCard
                            key={part}
                            label={part}
                            selected={bodyPart === part}
                            onClick={() => selectBodyPart(part)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {QUICK_BODY_PARTS.map((part) => (
                      <ChipCard
                        key={part}
                        label={part}
                        selected={part === "기타" ? showCustomBodyPart : bodyPart === part}
                        onClick={() =>
                          part === "기타" ? selectCustomBodyPart() : selectBodyPart(part)
                        }
                      />
                    ))}
                  </div>

                  {showCustomBodyPart && (
                    <input
                      value={customBodyPart}
                      onChange={(event) => {
                        setCustomBodyPart(event.target.value);
                        setBodyPart(event.target.value);
                      }}
                      placeholder="예: 손목, 발목"
                      className="mt-4 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
                    />
                  )}
                </StepSection>
              )}

              {step === 1 && (
                <StepSection title="어떤 증상이 있나요?" subtitle="여러 개 선택할 수 있어요.">
                  <CardGrid>
                    {symptomOptions.map((symptom) => (
                      <Card
                        key={symptom}
                        label={symptom}
                        selected={
                          symptom === "기타"
                            ? showCustomSymptom
                            : symptoms.includes(symptom)
                        }
                        onClick={() => toggleSymptom(symptom)}
                      />
                    ))}
                  </CardGrid>

                  {showCustomSymptom && (
                    <input
                      value={customSymptom}
                      onChange={(event) => setCustomSymptom(event.target.value)}
                      placeholder="예: 손 떨림"
                      className="mt-3 w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none placeholder:text-sub/60 focus:border-accent"
                    />
                  )}
                </StepSection>
              )}

              {step === 2 && (
                <StepSection title="얼마나 됐나요?">
                  <CardGrid>
                    {DURATIONS.map((item) => (
                      <Card
                        key={item}
                        label={item}
                        selected={duration === item}
                        onClick={() => setDuration(item)}
                      />
                    ))}
                  </CardGrid>
                </StepSection>
              )}

              {step === 3 && (
                <StepSection title="정도가 어느 정도인가요?">
                  <CardGrid>
                    {SEVERITIES.map((item) => (
                      <Card
                        key={item}
                        label={item}
                        selected={severity === item}
                        onClick={() => setSeverity(item)}
                      />
                    ))}
                  </CardGrid>
                </StepSection>
              )}

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
                </StepSection>
              )}

              {loading && (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-tint">
                    <div className="loading-bar-fill h-full w-1/3 rounded-full bg-accent" />
                  </div>
                  <p className="text-sm text-sub">AI가 증상을 분석하고 있어요…</p>
                </div>
              )}

              {error && (
                <p className="mt-4 text-center text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}

              {!loading && (
                <div className="mt-8 flex items-center gap-3">
                  {step > 0 && (
                    <button
                      onClick={() => setStep((s) => s - 1)}
                      className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-tint"
                    >
                      이전
                    </button>
                  )}

                  {step < TOTAL_STEPS - 1 ? (
                    <button
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!canGoNext}
                      className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-40"
                    >
                      다음
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-deep"
                    >
                      결과 확인하기
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                {result.disclaimer}
              </div>

              <div className="rounded-2xl border border-line bg-surface p-5">
                <h2 className="mb-1 text-xs font-medium text-sub">
                  의심되는 증상/질환
                </h2>
                <ul className="flex flex-col gap-1">
                  {result.conditions.length > 0 ? (
                    result.conditions.map((condition) => (
                      <li key={condition} className="text-base font-semibold text-ink">
                        {condition}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-sub">{result.summary}</li>
                  )}
                </ul>
              </div>

              {result.departments.length > 0 && (
                <div className="rounded-2xl border border-line bg-surface p-5">
                  <h2 className="mb-2 text-xs font-medium text-sub">
                    가보면 좋을 진료과
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {result.departments.map((department) => (
                      <span
                        key={department}
                        className="rounded-full bg-tint px-3 py-1.5 text-sm font-medium text-ink"
                      >
                        {department}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.conditions.length > 0 && result.summary && (
                <p className="px-1 text-sm leading-relaxed text-sub">
                  {result.summary}
                </p>
              )}

              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={reset}
                  className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-tint"
                >
                  다시 하기
                </button>
                <button
                  onClick={() => router.push("/main")}
                  className="flex-1 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-deep"
                >
                  메인으로
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StepSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-center text-xl font-bold tracking-tight text-ink">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-center text-sm text-sub">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function ChipCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        selected
          ? "rounded-full border-2 border-accent bg-tint px-4 py-2 text-sm font-semibold text-ink transition"
          : "rounded-full border-2 border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40"
      }
    >
      {label}
    </button>
  );
}

function Card({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        selected
          ? "rounded-2xl border-2 border-accent bg-tint px-4 py-3.5 text-sm font-semibold text-ink transition"
          : "rounded-2xl border-2 border-line bg-surface px-4 py-3.5 text-sm font-medium text-ink transition hover:border-accent/40"
      }
    >
      {label}
    </button>
  );
}
