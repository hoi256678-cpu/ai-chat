"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateKey } from "@/lib/chatHistory";
import {
  getMedications,
  getDoseLogs,
  deleteMedication,
  logDose,
  unlogDose,
  computeDoseSlots,
  type MedicationRecord,
  type MedicationLogRecord,
} from "@/lib/medications";
import { CardDeck } from "@/components/CardDeck";

function dDay(endDate: string, today: string): string {
  const diffDays = Math.round(
    (new Date(endDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "종료됨";
  if (diffDays === 0) return "오늘까지";
  return `D-${diffDays}`;
}

function TimeChips({ times, className = "" }: { times: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {times.map((time) => (
        <span
          key={time}
          className="rounded-full bg-tint px-2.5 py-1 text-xs font-medium text-ink"
        >
          {time}
        </span>
      ))}
    </div>
  );
}

// 불릿 각각이 보통 "투여 주의사항: ..." / "**흔한 부작용**: ..." 처럼 짧은 소제목 +
// 콜론으로 시작한다 — 그 소제목만 굵게 뽑아내서 본문과 시각적으로 구분한다.
function splitBulletLabel(text: string): { label: string | null; rest: string } {
  const bold = text.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
  if (bold) return { label: bold[1], rest: bold[2] };

  const plain = text.match(/^([^:：]{1,20})[:：]\s*(.+)$/);
  if (plain) return { label: plain[1], rest: plain[2] };

  return { label: null, rest: text };
}

// AI 응답은 "안내 문장 + 불릿 3~5개 + 마지막 한 줄 면책 문구" 형태로 오도록 프롬프트가
// 지시하고 있어(lib/gemini.ts getMedicationPrecautions) — 그 구조를 실제 목록으로
// 파싱해서 보여준다. 예상과 다른 형식이 오면(불릿이 하나도 없으면) 문단만 나열.
function PrecautionsView({ text }: { text: string | null }) {
  if (!text) {
    return <p className="text-sm leading-relaxed text-ink">주의사항 정보가 없어요.</p>;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletPattern = /^[-•*]\s+|^\d+[.)]\s+/;
  const disclaimer = lines.length > 1 ? lines[lines.length - 1] : null;
  const bodyLines = disclaimer ? lines.slice(0, -1) : lines;
  const hasBullets = bodyLines.some((line) => bulletPattern.test(line));

  if (!hasBullets) {
    return (
      <div className="flex flex-col gap-2">
        {lines.map((line, i) => (
          <p key={i} className="text-sm leading-relaxed text-ink">
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bodyLines
        .filter((line) => !bulletPattern.test(line))
        .map((line, i) => (
          <p key={`intro-${i}`} className="text-sm leading-relaxed text-ink">
            {line}
          </p>
        ))}
      <ul className="flex flex-col gap-3">
        {bodyLines
          .filter((line) => bulletPattern.test(line))
          .map((line, i) => {
            const { label, rest } = splitBulletLabel(line.replace(bulletPattern, ""));
            return (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>
                  {label && (
                    <span className="block font-semibold text-ink">{label}</span>
                  )}
                  {rest}
                </span>
              </li>
            );
          })}
      </ul>
      {disclaimer && (
        <p className="text-xs leading-relaxed text-sub">{disclaimer}</p>
      )}
    </div>
  );
}

export default function MedicationsPage() {
  const router = useRouter();
  const [today, setToday] = useState(() => formatDateKey(new Date()));
  const [medications, setMedications] = useState<MedicationRecord[] | null>(null);
  const [logs, setLogs] = useState<MedicationLogRecord[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<MedicationRecord | null>(null);

  useEffect(() => {
    getMedications()
      .then(setMedications)
      .catch(() => setError("불러오지 못했어요."));
  }, []);

  useEffect(() => {
    getDoseLogs(today)
      .then(setLogs)
      .catch(() => setError("불러오지 못했어요."));
  }, [today]);

  useEffect(() => {
    // 탭을 자정 너머로 계속 열어두면 today가 바뀌는데, 그걸 감지해서
    // 위 getDoseLogs 재조회를 트리거하기 위한 타이머 (30초 간격이면 충분).
    const id = setInterval(() => {
      const now = formatDateKey(new Date());
      setToday((prev) => (prev === now ? prev : now));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  async function handleToggle(medicationId: string, time: string, taken: boolean) {
    setError("");
    if (taken) {
      const previous = logs.find(
        (l) => l.medicationId === medicationId && l.time === time && l.dateKey === today
      );
      setLogs((prev) =>
        prev.filter(
          (l) => !(l.medicationId === medicationId && l.time === time && l.dateKey === today)
        )
      );
      try {
        await unlogDose(medicationId, today, time);
      } catch {
        if (previous) setLogs((prev) => [...prev, previous]);
        setError("체크 해제에 실패했어요. 다시 시도해주세요.");
      }
      return;
    }

    const optimisticId = `optimistic-${medicationId}-${time}`;
    setLogs((prev) => [
      ...prev,
      {
        id: optimisticId,
        medicationId,
        dateKey: today,
        time,
        takenAt: new Date().toISOString(),
      },
    ]);
    try {
      await logDose(medicationId, today, time);
    } catch {
      setLogs((prev) => prev.filter((log) => log.id !== optimisticId));
      setError("체크에 실패했어요. 다시 시도해주세요.");
    }
  }

  async function handleDelete(id: string) {
    setError("");
    setSelected(null);
    setMedications((prev) => (prev ?? []).filter((m) => m.id !== id));
    try {
      await deleteMedication(id);
    } catch {
      setError("삭제에 실패했어요. 새로고침 후 다시 시도해주세요.");
    }
  }

  const activeMedications = (medications ?? []).filter(
    (m) => m.startDate <= today && today <= m.endDate
  );

  const nowHHMM = new Date().toTimeString().slice(0, 5);

  const slots = computeDoseSlots(activeMedications, logs, today);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center justify-between px-3 pb-4 pr-3"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1">
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
          <h1 className="text-xl font-bold tracking-tight text-ink">복용/복약 알림</h1>
        </div>
        <button
          onClick={() => router.push("/medications/add")}
          className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98]"
        >
          + 약 추가
        </button>
      </header>

      <div
        className="flex flex-1 flex-col overflow-y-auto pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {error && (
          <p className="mb-4 px-5 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {medications === null && (
          <p className="px-5 pt-10 text-center text-sm text-sub">불러오는 중…</p>
        )}

        {medications !== null && medications.length === 0 && (
          <div className="mx-5 mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm text-sub">아직 등록된 약이 없어요.</p>
            <button
              onClick={() => router.push("/medications/add")}
              className="mt-3 text-sm font-medium text-accent"
            >
              + 약 추가하기
            </button>
          </div>
        )}

        {medications !== null && medications.length > 0 && (
          <>
            <section className="mt-2">
              <CardDeck
                items={medications}
                getKey={(med) => med.id}
                onSelect={setSelected}
                cardClassName={(active) =>
                  active
                    ? "flex h-[22rem] w-full shrink-0 scale-100 flex-col rounded-[2rem] border border-accent/25 bg-surface p-7 text-left opacity-100 shadow-[0_20px_40px_-16px_rgba(22,33,44,0.32)] transition-all duration-300"
                    : "flex h-[22rem] w-full shrink-0 scale-90 flex-col rounded-[2rem] border border-line bg-surface p-7 text-left opacity-40 shadow-none transition-all duration-300"
                }
                renderCard={(med) => (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xl font-bold text-ink sm:text-2xl">
                        {med.name}
                      </span>
                      <span className="shrink-0 text-xs text-sub sm:text-sm">
                        {dDay(med.endDate, today)}
                      </span>
                    </div>
                    <TimeChips times={med.times} className="mt-2" />
                    <p className="mt-4 line-clamp-5 flex-1 whitespace-pre-line text-sm leading-relaxed text-ink">
                      {med.precautions ?? "주의사항 정보가 없어요."}
                    </p>
                    <p className="text-sm font-medium text-accent">
                      눌러서 자세히 보기 →
                    </p>
                  </>
                )}
              />
            </section>

            {slots.length > 0 && (
              <section className="mt-8 px-5">
                <h2 className="mb-3 text-sm font-semibold text-sub">오늘 먹어야 할 약</h2>
                <div className="flex flex-col gap-2.5">
                  {slots.map((slot) => {
                    const due = !slot.taken && slot.time <= nowHHMM;
                    return (
                      <button
                        key={`${slot.medicationId}-${slot.time}`}
                        onClick={() =>
                          handleToggle(slot.medicationId, slot.time, slot.taken)
                        }
                        aria-pressed={slot.taken}
                        className={
                          slot.taken
                            ? "flex w-full items-center justify-between rounded-2xl border border-line bg-tint px-4 py-3.5 text-left transition active:scale-[0.98]"
                            : due
                              ? "flex w-full items-center justify-between rounded-2xl border-2 border-danger bg-danger-tint px-4 py-3.5 text-left transition active:scale-[0.98]"
                              : "flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition hover:border-accent/40 active:scale-[0.98]"
                        }
                      >
                        <span className="flex flex-col gap-0.5">
                          <span
                            className={
                              slot.taken
                                ? "text-sm font-semibold leading-snug text-ink opacity-60"
                                : "text-sm font-semibold leading-snug text-ink"
                            }
                          >
                            {slot.name}
                          </span>
                          <span className="text-xs leading-snug text-sub">{slot.time}</span>
                        </span>
                        <span
                          aria-hidden
                          className={
                            slot.taken
                              ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-white"
                              : "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-line"
                          }
                        >
                          {slot.taken && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 13l4 4L19 7"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="닫기"
            className="sheet-backdrop-in absolute inset-0 bg-ink/40"
            onClick={() => setSelected(null)}
          />
          <div
            className="sheet-rise-in relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:max-w-xl md:max-w-2xl"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="shrink-0 px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
              <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink">
                  {selected.name} · {dDay(selected.endDate, today)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleDelete(selected.id)}
                    aria-label={`${selected.name} 삭제`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-tint hover:text-danger"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="닫기"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-tint"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="mb-2 text-sm font-semibold text-ink">복용 시간</h2>
                  <TimeChips times={selected.times} />
                </div>

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-ink">AI 복용 주의사항</h2>
                  <PrecautionsView text={selected.precautions} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
