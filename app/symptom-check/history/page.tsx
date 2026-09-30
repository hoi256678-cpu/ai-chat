"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSymptomCheck,
  getSymptomChecks,
  type SymptomCheckRecord,
} from "@/lib/symptomHistory";
import { SymptomResultView } from "@/components/SymptomResultView";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { CardDeck } from "@/components/CardDeck";

export default function SymptomCheckHistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<SymptomCheckRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<SymptomCheckRecord | null>(
    null
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  function closeSheet() {
    setSelectedRecord(null);
    setConfirmingDelete(false);
  }

  async function handleDelete(id: string) {
    setDeleteError("");
    closeSheet();
    setRecords((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteSymptomCheck(id);
    } catch {
      setDeleteError("삭제에 실패했어요. 새로고침 후 다시 시도해주세요.");
    }
  }

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
        <h1 className="px-1 text-xl font-bold tracking-tight text-ink">지난 증상체크 기록</h1>
      </header>

      <div
        className="flex flex-1 flex-col overflow-y-auto py-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {deleteError && (
          <p className="mb-4 px-5 text-center text-sm text-danger" role="alert">
            {deleteError}
          </p>
        )}

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
          <CardDeck
            items={records}
            getKey={(record) => record.id}
            onSelect={(record) => {
              setSelectedRecord(record);
              setConfirmingDelete(false);
            }}
            cardClassName={(active) =>
              active
                ? "flex h-[26rem] w-full shrink-0 scale-100 flex-col rounded-[2rem] border border-accent/25 bg-surface p-7 text-left opacity-100 shadow-[0_20px_40px_-16px_rgba(22,33,44,0.32)] transition-all duration-300 sm:h-[30rem]"
                : "flex h-[26rem] w-full shrink-0 scale-90 flex-col rounded-[2rem] border border-line bg-surface p-7 text-left opacity-40 shadow-none transition-all duration-300 sm:h-[30rem]"
            }
            renderCard={(record) => (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-ink sm:text-2xl">
                    {record.bodyPart}
                  </span>
                  <span className="text-xs text-sub sm:text-sm">
                    {formatRelativeDate(record.createdAt)}
                  </span>
                </div>

                {record.photo && (
                  <div className="relative mt-4 h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-tint sm:h-40">
                    {/* Blurred preview only — the clear photo is one tap
                        away in the detail sheet, not exposed in the
                        swipeable deck. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={record.photo}
                      alt=""
                      aria-hidden
                      draggable={false}
                      className="h-full w-full scale-110 object-cover blur-xl"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/90 drop-shadow">
                      눌러서 사진 보기
                    </span>
                  </div>
                )}

                <p className="mt-4 line-clamp-4 flex-1 text-base leading-relaxed text-ink sm:text-lg">
                  {record.conditions[0] ?? record.symptoms.join(", ")}
                </p>
                <p className="text-sm font-medium text-accent">
                  눌러서 자세히 보기 →
                </p>
              </>
            )}
          />
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="닫기"
            className="sheet-backdrop-in absolute inset-0 bg-ink/40"
            onClick={closeSheet}
          />
          <div
            className="sheet-rise-in relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-surface sm:max-w-xl md:max-w-2xl"
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
                  onClick={closeSheet}
                  aria-label="닫기"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-tint"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <div className="flex flex-col gap-6">
                {selectedRecord.photo && (
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-ink">
                      첨부한 사진
                    </h2>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRecord.photo}
                      alt="증상체크 당시 첨부한 사진"
                      className="w-full rounded-2xl object-cover"
                    />
                  </div>
                )}

                <div>
                  <h2 className="mb-2 text-sm font-semibold text-ink">증상</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRecord.symptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="rounded-full bg-tint px-2.5 py-1 text-xs font-medium text-ink"
                      >
                        {symptom}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-6">
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-ink">
                      지속 기간
                    </h2>
                    <p className="text-sm text-ink">{selectedRecord.duration}</p>
                  </div>
                  <div>
                    <h2 className="mb-2 text-sm font-semibold text-ink">정도</h2>
                    <p className="text-sm text-ink">{selectedRecord.severity}</p>
                  </div>
                </div>

                <SymptomResultView result={selectedRecord} />
              </div>
            </div>

            <div className="shrink-0 border-t border-line px-5 pt-3">
              {confirmingDelete ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-tint active:scale-[0.98]"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => handleDelete(selectedRecord.id)}
                    className="flex-1 rounded-full bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                  >
                    정말 삭제
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="w-full rounded-full border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-tint active:scale-[0.98]"
                >
                  삭제하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
