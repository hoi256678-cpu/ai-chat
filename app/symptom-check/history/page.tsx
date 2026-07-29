"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSymptomChecks,
  type SymptomCheckRecord,
} from "@/lib/symptomHistory";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
        className="flex shrink-0 items-center gap-3 border-b border-line px-3 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/symptom-check")}
          aria-label="증상 체크로 돌아가기"
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
        <span className="font-semibold text-ink">지난 증상체크 기록</span>
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
                className="rounded-2xl border border-line bg-surface"
              >
                <button
                  onClick={() => setExpandedId(expanded ? null : record.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">
                      {record.bodyPart}
                    </span>
                    <span className="text-xs text-sub">
                      {formatDateTime(record.createdAt)}
                    </span>
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
                  <div className="flex flex-col gap-3 border-t border-line px-5 py-4">
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

                    {record.conditions.length > 0 && (
                      <div>
                        <h2 className="mb-1 text-xs font-medium text-sub">
                          의심되는 증상/질환
                        </h2>
                        <ul className="flex flex-col gap-1">
                          {record.conditions.map((condition) => (
                            <li
                              key={condition}
                              className="text-sm font-semibold text-ink"
                            >
                              {condition}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {record.homeCare.length > 0 && (
                      <div>
                        <h2 className="mb-1 text-xs font-medium text-sub">
                          집에서 할 수 있는 응급처치·관리법
                        </h2>
                        <ul className="flex flex-col gap-1">
                          {record.homeCare.map((tip) => (
                            <li key={tip} className="flex gap-2 text-sm text-ink">
                              <span className="text-sub">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {record.foods.length > 0 && (
                      <div>
                        <h2 className="mb-1 text-xs font-medium text-sub">
                          이럴 때 먹으면 좋은 음식
                        </h2>
                        <ul className="flex flex-col gap-1">
                          {record.foods.map((food) => (
                            <li key={food} className="flex gap-2 text-sm text-ink">
                              <span className="text-sub">•</span>
                              <span>{food}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {record.departments.length > 0 && (
                      <div>
                        <h2 className="mb-2 text-xs font-medium text-sub">
                          가보면 좋을 진료과
                        </h2>
                        <div className="flex flex-wrap gap-2">
                          {record.departments.map((department) => (
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

                    {record.summary && (
                      <p className="text-sm leading-relaxed text-sub">
                        {record.summary}
                      </p>
                    )}

                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                      {record.disclaimer}
                    </div>
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
