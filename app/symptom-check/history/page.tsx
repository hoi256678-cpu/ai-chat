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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
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

          {records.map((record) => {
            const expanded = expandedId === record.id;
            return (
              <div
                key={record.id}
                className={
                  expanded
                    ? "rounded-2xl border border-accent/25 bg-surface transition"
                    : "rounded-2xl border border-line bg-surface transition"
                }
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : record.id)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="shrink-0 text-sm font-semibold text-ink">
                        {record.bodyPart}
                      </span>
                      <span className="shrink-0 text-xs text-sub">
                        {formatRelativeDate(record.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-sub">
                      {record.conditions[0] ?? record.symptoms.join(", ")}
                    </p>
                  </div>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className={
                      expanded
                        ? "rotate-180 shrink-0 text-sub transition-transform"
                        : "shrink-0 text-sub transition-transform"
                    }
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {expanded && (
                  <div className="flex flex-col gap-5 border-t border-line px-5 py-4">
                    <div>
                      <h2 className="mb-1 text-xs font-medium text-sub">
                        증상
                      </h2>
                      <p className="text-sm text-ink">
                        {record.symptoms.join(", ")}
                      </p>
                    </div>

                    <div className="flex gap-6">
                      <div>
                        <h2 className="mb-1 text-xs font-medium text-sub">
                          지속 기간
                        </h2>
                        <p className="text-sm text-ink">{record.duration}</p>
                      </div>
                      <div>
                        <h2 className="mb-1 text-xs font-medium text-sub">
                          정도
                        </h2>
                        <p className="text-sm text-ink">{record.severity}</p>
                      </div>
                    </div>

                    <SymptomResultView result={record} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
