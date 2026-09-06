"use client";

import { useState } from "react";
import { generateIntervalTimes, type MedicationRecord } from "@/lib/medications";

export function dDay(endDate: string, today: string): string {
  const diffDays = Math.round(
    (new Date(endDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "종료됨";
  if (diffDays === 0) return "오늘까지";
  return `D-${diffDays}`;
}

export function TimeChips({ times, className = "" }: { times: string[]; className?: string }) {
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
      {disclaimer && <p className="text-xs leading-relaxed text-sub">{disclaimer}</p>}
    </div>
  );
}

export type MedicationDetailSheetProps = {
  medication: MedicationRecord;
  today: string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onSaveTimes: (id: string, times: string[]) => Promise<void>;
};

// Shared between /medications (tapping a card) and /chats (tapping a
// medication in the day panel) so both show exactly the same view/edit
// experience rather than two hand-rolled copies drifting apart.
export function MedicationDetailSheet({
  medication,
  today,
  onClose,
  onDelete,
  onSaveTimes,
}: MedicationDetailSheetProps) {
  const [editingTimes, setEditingTimes] = useState<string[] | null>(null);
  const [editInterval, setEditInterval] = useState({ start: "08:00", hours: "" });
  const [savingTimes, setSavingTimes] = useState(false);
  const [error, setError] = useState("");

  function startEditingTimes() {
    setEditingTimes([...medication.times]);
    setEditInterval({ start: "08:00", hours: "" });
    setError("");
  }

  function removeEditTime(time: string) {
    setEditingTimes((prev) => (prev ? prev.filter((t) => t !== time) : prev));
  }

  function changeEditTime(oldTime: string, newTime: string) {
    setEditingTimes((prev) =>
      prev
        ? Array.from(new Set(prev.map((t) => (t === oldTime ? newTime : t)))).sort()
        : prev
    );
  }

  function applyEditInterval() {
    const hours = Number(editInterval.hours);
    if (!editInterval.start || !hours || hours <= 0) return;
    const generated = generateIntervalTimes(editInterval.start, hours);
    if (generated.length === 0) return;
    setEditingTimes((prev) => Array.from(new Set([...(prev ?? []), ...generated])).sort());
  }

  async function saveEditingTimes() {
    if (!editingTimes || editingTimes.length === 0) return;
    setSavingTimes(true);
    setError("");
    try {
      await onSaveTimes(medication.id, editingTimes);
      setEditingTimes(null);
    } catch {
      setError("복용 시간을 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setSavingTimes(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="닫기"
        className="sheet-backdrop-in absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        className="sheet-rise-in relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:max-w-xl md:max-w-2xl"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="shrink-0 px-5 pt-5">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">
              {medication.name} · {dDay(medication.endDate, today)}
            </span>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-tint"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2">
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">복용 시간</h2>
              {editingTimes === null ? (
                <TimeChips times={medication.times} />
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2.5">
                    {editingTimes.map((time) => (
                      <div
                        key={time}
                        className="flex items-center gap-1.5 rounded-full bg-tint py-1 pl-3 pr-1 text-sm text-ink"
                      >
                        <input
                          type="time"
                          value={time}
                          onChange={(event) => changeEditTime(time, event.target.value)}
                          className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-accent"
                        />
                        <button
                          onClick={() => removeEditTime(time)}
                          aria-label={`${time} 삭제`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-surface hover:text-danger"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs text-sub">
                      시작시간
                      <input
                        type="time"
                        value={editInterval.start}
                        onChange={(event) =>
                          setEditInterval((prev) => ({ ...prev, start: event.target.value }))
                        }
                        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-sub">
                      간격(시간)
                      <input
                        type="number"
                        min="1"
                        max="24"
                        placeholder="예: 4"
                        value={editInterval.hours}
                        onChange={(event) =>
                          setEditInterval((prev) => ({ ...prev, hours: event.target.value }))
                        }
                        className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-accent"
                      />
                    </label>
                    <button
                      onClick={applyEditInterval}
                      className="rounded-full border-2 border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent/40"
                    >
                      주기로 추가
                    </button>
                  </div>

                  {error && (
                    <p className="text-sm text-danger" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm font-semibold text-ink">AI 복용 주의사항</h2>
              <PrecautionsView text={medication.precautions} />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-5 pt-3">
          {editingTimes === null ? (
            <div className="flex gap-2">
              <button
                onClick={startEditingTimes}
                className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98]"
              >
                복용 시간 수정
              </button>
              <button
                onClick={() => onDelete(medication.id)}
                className="flex-1 rounded-full border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-tint active:scale-[0.98]"
              >
                삭제하기
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingTimes(null)}
                className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-tint active:scale-[0.98]"
              >
                취소
              </button>
              <button
                onClick={saveEditingTimes}
                disabled={savingTimes || editingTimes.length === 0}
                className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep disabled:opacity-60 active:scale-[0.98]"
              >
                {savingTimes ? "저장 중…" : "저장하기"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
