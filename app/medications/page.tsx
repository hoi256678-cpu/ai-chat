"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateKey } from "@/lib/chatHistory";
import {
  getMedications,
  getDoseLogs,
  deleteMedication,
  logDose,
  computeDoseSlots,
  type MedicationRecord,
  type MedicationLogRecord,
} from "@/lib/medications";

function dDay(endDate: string, today: string): string {
  const diffDays = Math.round(
    (new Date(endDate).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return "종료됨";
  if (diffDays === 0) return "오늘까지";
  return `D-${diffDays}`;
}

export default function MedicationsPage() {
  const router = useRouter();
  const today = formatDateKey(new Date());
  const [medications, setMedications] = useState<MedicationRecord[] | null>(null);
  const [logs, setLogs] = useState<MedicationLogRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getMedications(), getDoseLogs(today)])
      .then(([meds, todayLogs]) => {
        setMedications(meds);
        setLogs(todayLogs);
      })
      .catch(() => setError("불러오지 못했어요."));
    // fetch once on mount only; `today` is intentionally read fresh on each
    // render (see stale date_key fix below) but must not re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheck(medicationId: string, time: string) {
    setError("");
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
          <h1 className="text-xl font-bold tracking-tight text-ink">복용 알림</h1>
        </div>
        <button
          onClick={() => router.push("/medications/add")}
          className="rounded-full bg-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98]"
        >
          + 약 추가
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {error && (
          <p className="mb-4 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {medications === null && (
          <p className="pt-10 text-center text-sm text-sub">불러오는 중…</p>
        )}

        {medications !== null && medications.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
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
            {slots.length > 0 && (
              <section className="mt-2">
                <h2 className="mb-2 text-xs font-semibold text-sub">오늘</h2>
                <div className="flex flex-col gap-2">
                  {slots.map((slot) => {
                    const due = !slot.taken && slot.time <= nowHHMM;
                    return (
                      <button
                        key={`${slot.medicationId}-${slot.time}`}
                        onClick={() =>
                          !slot.taken && handleCheck(slot.medicationId, slot.time)
                        }
                        disabled={slot.taken}
                        className={
                          slot.taken
                            ? "flex w-full items-center justify-between rounded-2xl border border-line bg-tint px-4 py-3 text-left opacity-60"
                            : due
                              ? "flex w-full items-center justify-between rounded-2xl border-2 border-danger bg-danger-tint px-4 py-3 text-left transition active:scale-[0.98]"
                              : "flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left transition hover:border-accent/40 active:scale-[0.98]"
                        }
                      >
                        <span>
                          <span className="block text-sm font-semibold text-ink">
                            {slot.name}
                          </span>
                          <span className="block text-xs text-sub">{slot.time}</span>
                        </span>
                        <span className="text-sm font-medium text-ink">
                          {slot.taken ? "✓ 완료" : due ? "먹었어요" : "예정"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="mb-2 text-xs font-semibold text-sub">등록된 약</h2>
              <div className="flex flex-col gap-2">
                {medications.map((med) => (
                  <div
                    key={med.id}
                    className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{med.name}</p>
                      <p className="text-xs text-sub">
                        {med.times.join(", ")} · {dDay(med.endDate, today)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(med.id)}
                      aria-label={`${med.name} 삭제`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-tint hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
