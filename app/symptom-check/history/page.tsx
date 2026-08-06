"use client";

import { useEffect, useRef, useState } from "react";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Tracks which card sits closest to the track's horizontal center, so the
  // "front" card (like the one centered in a phone's app-switcher deck) can
  // be emphasized while its neighbors peek in, dimmed, from the sides.
  function handleTrackScroll() {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setActiveIndex(closestIndex);
  }

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
            <>
              <div
                ref={trackRef}
                onScroll={handleTrackScroll}
                className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3"
                style={{ paddingLeft: "12%", paddingRight: "12%" }}
              >
                {records.map((record, index) => {
                  const active = index === activeIndex;
                  return (
                    <button
                      key={record.id}
                      ref={(el) => {
                        cardRefs.current[index] = el;
                      }}
                      onClick={() => setSelectedRecord(record)}
                      className={
                        active
                          ? "flex h-44 w-[76%] shrink-0 snap-center scale-100 flex-col rounded-3xl border border-accent/25 bg-surface p-5 text-left opacity-100 shadow-[0_12px_28px_-14px_rgba(22,33,44,0.28)] transition-all duration-200"
                          : "flex h-44 w-[76%] shrink-0 snap-center scale-[0.94] flex-col rounded-3xl border border-line bg-surface p-5 text-left opacity-50 shadow-none transition-all duration-200"
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-ink">
                          {record.bodyPart}
                        </span>
                        <span className="text-xs text-sub">
                          {formatRelativeDate(record.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-ink">
                        {record.conditions[0] ?? record.symptoms.join(", ")}
                      </p>
                      <p className="text-xs font-medium text-accent">
                        눌러서 자세히 보기 →
                      </p>
                    </button>
                  );
                })}
              </div>

              {records.length > 1 && (
                <div className="flex justify-center gap-1.5 pt-2">
                  {records.map((record, index) => (
                    <span
                      key={record.id}
                      aria-hidden
                      className={
                        index === activeIndex
                          ? "h-1.5 w-4 rounded-full bg-accent transition-all"
                          : "h-1.5 w-1.5 rounded-full bg-line transition-all"
                      }
                    />
                  ))}
                </div>
              )}
            </>
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
