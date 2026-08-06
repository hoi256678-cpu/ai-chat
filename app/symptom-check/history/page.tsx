"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSymptomChecks,
  type SymptomCheckRecord,
} from "@/lib/symptomHistory";
import { SymptomResultView } from "@/components/SymptomResultView";

function formatRelativeDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    const time = date.toLocaleString("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `오늘 ${time}`;
  }
  if (diffDays === 1) return "어제";
  if (diffDays > 1 && diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default function SymptomCheckHistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<SymptomCheckRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SymptomCheckRecord | null>(
    null
  );

  useEffect(() => {
    getSymptomChecks()
      .then((data) => {
        setRecords(data);
        setReady(true);
      })
      .catch(() => {
        setError("기록을 불러오지 못했어요.");
        setReady(true);
      });
  }, []);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-2"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/symptom-check")}
          aria-label="증상 체크로 돌아가기"
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
        <span className="px-1 font-semibold text-ink">지난 증상체크 기록</span>
      </header>

      <div
        className="flex-1 overflow-y-auto py-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-md">
          {!ready && (
            <p className="pt-10 text-center text-sm text-sub">불러오는 중…</p>
          )}
          {ready && error && (
            <p className="pt-10 text-center text-sm text-danger">{error}</p>
          )}
          {ready && !error && records.length === 0 && (
            <p className="pt-10 text-center text-sm text-sub">
              아직 증상체크 기록이 없어요.
            </p>
          )}

          {ready && !error && records.length > 0 && (
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2">
              {records.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setSelectedRecord(record)}
                  className="flex w-40 shrink-0 snap-start flex-col rounded-2xl border border-line bg-surface p-4 text-left transition active:scale-[0.97]"
                >
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {record.bodyPart}
                    </span>
                  </div>
                  <span className="mt-0.5 text-[11px] text-sub">
                    {formatRelativeDate(record.createdAt)}
                  </span>
                  <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-ink">
                    {record.conditions[0] ?? record.symptoms.join(", ")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="닫기"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setSelectedRecord(null)}
          />
          <div
            className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-surface"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="shrink-0 px-5 pt-5">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">
                  {selectedRecord.bodyPart} ·{" "}
                  {formatRelativeDate(selectedRecord.createdAt)}
                </span>
                <button
                  onClick={() => setSelectedRecord(null)}
                  aria-label="닫기"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-tint"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="mb-1 text-xs font-medium text-sub">증상</h2>
                  <p className="text-sm text-ink">
                    {selectedRecord.symptoms.join(", ")}
                  </p>
                </div>

                <div className="flex gap-6">
                  <div>
                    <h2 className="mb-1 text-xs font-medium text-sub">
                      지속 기간
                    </h2>
                    <p className="text-sm text-ink">{selectedRecord.duration}</p>
                  </div>
                  <div>
                    <h2 className="mb-1 text-xs font-medium text-sub">정도</h2>
                    <p className="text-sm text-ink">{selectedRecord.severity}</p>
                  </div>
                </div>

                <SymptomResultView result={selectedRecord} />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
