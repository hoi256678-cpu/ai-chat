"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateKey } from "@/lib/chatHistory";
import { saveMedication } from "@/lib/medications";

const today = formatDateKey(new Date());

const PRESETS = [
  { label: "아침", time: "08:00" },
  { label: "점심", time: "13:00" },
  { label: "저녁", time: "19:00" },
];

type PendingMed = {
  key: string;
  name: string;
  times: string[];
  endDate: string;
  fromPhoto: boolean;
};

function createPending(name: string, fromPhoto: boolean): PendingMed {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    times: [],
    endDate: "",
    fromPhoto,
  };
}

export default function AddMedicationPage() {
  const router = useRouter();
  const [photo, setPhoto] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [manualName, setManualName] = useState("");
  const [pending, setPending] = useState<PendingMed[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("사진 용량이 너무 커요. 4MB 이하 사진을 선택해주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleExtract() {
    if (!photo) return;
    setExtracting(true);
    setError("");
    try {
      const res = await fetch("/api/medications/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "약 이름을 찾지 못했어요.");
      setCandidates([...new Set((data.names ?? []) as string[])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "약 이름을 찾지 못했어요.");
    } finally {
      setExtracting(false);
    }
  }

  function toggleName(name: string) {
    setPending((prev) => {
      const exists = prev.some((p) => p.name === name);
      if (exists) return prev.filter((p) => p.name !== name);
      return [...prev, createPending(name, true)];
    });
  }

  function addManualName() {
    const trimmed = manualName.trim();
    if (!trimmed) return;
    if (!pending.some((p) => p.name === trimmed)) {
      setPending((prev) => [...prev, createPending(trimmed, false)]);
    }
    setManualName("");
  }

  function updateName(key: string, name: string) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, name } : p)));
  }

  function toggleTime(key: string, time: string) {
    setPending((prev) =>
      prev.map((p) => {
        if (p.key !== key) return p;
        const times = p.times.includes(time)
          ? p.times.filter((t) => t !== time)
          : [...p.times, time].sort();
        return { ...p, times };
      })
    );
  }

  function setEndDate(key: string, endDate: string) {
    setPending((prev) => prev.map((p) => (p.key === key ? { ...p, endDate } : p)));
  }

  function removePending(key: string) {
    setPending((prev) => prev.filter((p) => p.key !== key));
  }

  async function handleSave() {
    setError("");
    if (pending.length === 0) {
      setError("등록할 약을 추가해주세요.");
      return;
    }
    const invalid = pending.some(
      (p) =>
        !p.name.trim() ||
        p.times.length === 0 ||
        p.times.some((t) => !t) ||
        !p.endDate
    );
    if (invalid) {
      setError("모든 약에 이름, 복용 시간대, 종료일을 입력해주세요.");
      return;
    }

    setSaving(true);
    const failed: PendingMed[] = [];
    for (const med of pending) {
      try {
        await saveMedication({
          name: med.name.trim(),
          times: med.times,
          startDate: today,
          endDate: med.endDate,
          photo: med.fromPhoto ? photo : null,
        });
      } catch {
        failed.push(med);
      }
    }
    setSaving(false);

    if (failed.length === 0) {
      router.push("/medications");
      return;
    }
    setPending(failed);
    setError(`${failed.length}개 저장에 실패했어요. 다시 시도해주세요.`);
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-1 px-2 py-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/medications")}
          aria-label="복용 알림으로 돌아가기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
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
        <span className="px-1 font-semibold text-ink">약 추가</span>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <section>
          <h2 className="mb-2 text-xs font-semibold text-sub">
            처방전/진단서 사진 (선택)
          </h2>
          {!photo ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-3.5 text-sm font-medium text-sub transition hover:border-accent/40">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path
                  d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
              </svg>
              사진 첨부
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          ) : (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 data URL 미리보기 */}
              <img
                src={photo}
                alt="첨부한 처방전 사진"
                className="h-40 w-full rounded-2xl object-cover"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60"
                >
                  {extracting ? "분석 중…" : "AI로 약 이름 찾기"}
                </button>
                <button
                  onClick={() => {
                    setPhoto(null);
                    setCandidates([]);
                  }}
                  className="rounded-full border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-tint"
                >
                  사진 지우기
                </button>
              </div>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {candidates.map((name) => {
                const selected = pending.some((p) => p.name === name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleName(name)}
                    className={
                      selected
                        ? "rounded-full border-2 border-accent bg-tint px-3 py-1.5 text-xs font-semibold text-ink"
                        : "rounded-full border-2 border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/40"
                    }
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold text-sub">약 이름 직접 추가</h2>
          <div className="flex gap-2">
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addManualName();
                }
              }}
              placeholder="예: 타이레놀정500mg"
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-sub/60 focus:border-accent"
            />
            <button
              onClick={addManualName}
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-tint"
            >
              추가
            </button>
          </div>
        </section>

        {pending.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 text-xs font-semibold text-sub">등록 예정 목록</h2>
            <div className="flex flex-col gap-3">
              {pending.map((med) => (
                <div
                  key={med.key}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={med.name}
                      onChange={(event) => updateName(med.key, event.target.value)}
                      className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => removePending(med.key)}
                      aria-label={`${med.name} 제거`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-tint"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.time}
                        onClick={() => toggleTime(med.key, preset.time)}
                        className={
                          med.times.includes(preset.time)
                            ? "rounded-full border-2 border-accent bg-tint px-3 py-1.5 text-xs font-semibold text-ink"
                            : "rounded-full border-2 border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-accent/40"
                        }
                      >
                        {preset.label} {preset.time}
                      </button>
                    ))}
                  </div>

                  {med.times.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {med.times.map((time) => (
                        <label
                          key={time}
                          className="flex items-center gap-1.5 text-xs text-sub"
                        >
                          시간
                          <input
                            type="time"
                            value={time}
                            onChange={(event) => {
                              const newTime = event.target.value;
                              setPending((prev) =>
                                prev.map((p) =>
                                  p.key === med.key
                                    ? {
                                        ...p,
                                        times: Array.from(
                                          new Set(
                                            p.times.map((t) =>
                                              t === time ? newTime : t
                                            )
                                          )
                                        ).sort(),
                                      }
                                    : p
                                )
                              );
                            }}
                            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-accent"
                          />
                        </label>
                      ))}
                    </div>
                  )}

                  <label className="mt-3 flex flex-col gap-1 text-left">
                    <span className="text-xs font-medium text-sub">종료일</span>
                    <input
                      type="date"
                      min={today}
                      value={med.endDate}
                      onChange={(event) => setEndDate(med.key, event.target.value)}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {error && (
          <p
            ref={errorRef}
            className="mt-4 text-center text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(47,135,224,0.65)] transition hover:bg-accent-deep active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? "저장 중…" : "저장하기"}
        </button>
      </div>
    </main>
  );
}
