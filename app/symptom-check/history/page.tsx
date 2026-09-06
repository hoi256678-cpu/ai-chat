"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  getSymptomChecks,
  type SymptomCheckRecord,
} from "@/lib/symptomHistory";
import { SymptomResultView } from "@/components/SymptomResultView";
import { formatRelativeDate } from "@/lib/formatRelativeDate";

// Shared by the live onScroll handler (keeps activeIndex in sync while the
// user drags or swipes) and the explicit post-drag snap (see handleMouseUp)
// — both need "which card is nearest the track's horizontal center" from
// the same DOM measurements.
function findClosestCard(
  track: HTMLDivElement,
  cards: (HTMLButtonElement | null)[]
): { index: number; card: HTMLButtonElement } | null {
  const center = track.scrollLeft + track.clientWidth / 2;
  let closestIndex = 0;
  let closestDistance = Infinity;
  let closestCard: HTMLButtonElement | null = null;
  cards.forEach((card, index) => {
    if (!card) return;
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - center);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
      closestCard = card;
    }
  });
  return closestCard ? { index: closestIndex, card: closestCard } : null;
}

// Animates the track's scrollLeft to an exact target ourselves (ease-out
// cubic, ~280ms) instead of trusting `scrollTo({behavior:"smooth"})` or
// CSS `scroll-behavior: smooth` — both were inconsistent in testing here
// (sometimes resolving instantly instead of animating, likely CSS
// scroll-snap correcting the position before the browser's own smooth-
// scroll had a frame to run). scroll-snap-type is turned off for the
// duration so its snap-correction can't fight our per-frame writes, then
// restored once we land exactly on the target.
function animateScrollTo(track: HTMLDivElement, target: number, duration = 280) {
  const start = track.scrollLeft;
  const distance = target - start;
  if (Math.abs(distance) < 1) return;

  const previousSnapType = track.style.scrollSnapType;
  track.style.scrollSnapType = "none";
  const startTime = performance.now();

  function step(now: number) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    track.scrollLeft = start + distance * eased;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      track.style.scrollSnapType = previousSnapType;
    }
  }
  requestAnimationFrame(step);
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

  // Mouse-drag panning for the card track. Touch/trackpad swipe already
  // works via native overflow-x scrolling (no mousedown/mousemove involved),
  // so this is purely additive for desktop mouse users.
  //
  // dragRef only exists WHILE a drag is live (mousedown..mouseup) — it is
  // set to null the instant mouseup fires. Without that, a stray mousemove
  // between two drags (e.g. the cursor drifting back toward the track
  // before the next mousedown) would still see the *previous* drag's
  // stale startX/startScrollLeft and yank the track to a bogus position —
  // this was the actual cause of "drag does nothing, track springs back
  // to an earlier card no matter how far I drag."
  const dragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  // Separate from dragRef: the card <button>'s click event fires right
  // after mouseup, in the same event-loop turn, and needs to know whether
  // the drag that just ended actually moved the track (to suppress
  // opening the card). Set once in handleMouseUp, consumed once by
  // handleCardClick — independent of dragRef's own lifecycle.
  const justDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  function handleMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = {
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
      moved: false,
    };
    setIsDragging(true);
  }

  // Listens on window (not just the track) so a fast drag that outruns the
  // cursor past the track's edge still keeps tracking, and mouseup always
  // gets caught even if the button is released outside the track.
  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const track = trackRef.current;
      const drag = dragRef.current;
      if (!track || !drag) return;
      const delta = event.clientX - drag.startX;
      if (Math.abs(delta) > 3) drag.moved = true;
      track.scrollLeft = drag.startScrollLeft - delta;
    }

    function handleMouseUp() {
      const drag = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      if (!drag?.moved) return;
      justDraggedRef.current = true;

      // Explicitly settle on the nearest card ourselves instead of relying
      // on CSS scroll-snap to catch a JS-driven scrollLeft change.
      const track = trackRef.current;
      if (!track) return;
      const closest = findClosestCard(track, cardRefs.current);
      if (closest) {
        const targetLeft =
          closest.card.offsetLeft +
          closest.card.offsetWidth / 2 -
          track.clientWidth / 2;
        animateScrollTo(track, targetLeft);
        setActiveIndex(closest.index);
      }
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // A card's onClick fires right after mouseup — skip it (once) when the
  // mouse actually dragged the track, so panning past a card doesn't also
  // open it.
  function handleCardClick(record: SymptomCheckRecord) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setSelectedRecord(record);
  }

  // Tracks which card sits closest to the track's horizontal center, so the
  // "front" card (like the one centered in a phone's app-switcher deck) can
  // be emphasized while its neighbors peek in, dimmed, from the sides.
  function handleTrackScroll() {
    const track = trackRef.current;
    if (!track) return;
    const closest = findClosestCard(track, cardRefs.current);
    if (closest) setActiveIndex(closest.index);
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
        className="flex flex-1 flex-col overflow-y-auto py-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
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
            {/* Full-bleed (not the app's usual mx-auto max-w-md column) so
                each card can be as large as the screen itself, the way a
                phone's app-switcher deck fills the whole width. */}
            <div
              ref={trackRef}
              onScroll={handleTrackScroll}
              onMouseDown={handleMouseDown}
              className={
                isDragging
                  ? "no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth select-none [cursor:grabbing]"
                  : "no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth [cursor:grab]"
              }
            >
              {/* Leading spacer — NOT container padding, deliberately. Padding
                  percentages resolve against the track's own outer width,
                  while the card wrappers' width percentages resolve against
                  the track's (padding-reduced) content box — nesting one
                  inside the other compounds instead of adding up, so at the
                  lg breakpoint the first/last card's centered position fell
                  outside the scrollable range entirely and could never be
                  reached. A spacer sized off the same basis as the cards
                  (both direct flex children of the unpadded track) keeps the
                  percentages simply summing to 100%. */}
              <div
                aria-hidden
                className="w-[6%] shrink-0 sm:w-[15%] md:w-[22.5%] lg:w-[29%]"
              />
              {records.map((record, index) => {
                const active = index === activeIndex;
                return (
                  <div
                    key={record.id}
                    className="flex w-[88%] shrink-0 snap-center justify-center px-2 sm:w-[70%] md:w-[55%] lg:w-[42%]"
                  >
                    <button
                      ref={(el) => {
                        cardRefs.current[index] = el;
                      }}
                      onClick={() => handleCardClick(record)}
                      className={
                        active
                          ? "flex h-[26rem] w-full shrink-0 scale-100 flex-col rounded-[2rem] border border-accent/25 bg-surface p-7 text-left opacity-100 shadow-[0_20px_40px_-16px_rgba(22,33,44,0.32)] transition-all duration-300 sm:h-[30rem]"
                          : "flex h-[26rem] w-full shrink-0 scale-90 flex-col rounded-[2rem] border border-line bg-surface p-7 text-left opacity-40 shadow-none transition-all duration-300 sm:h-[30rem]"
                      }
                    >
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
                    </button>
                  </div>
                );
              })}
              <div
                aria-hidden
                className="w-[6%] shrink-0 sm:w-[15%] md:w-[22.5%] lg:w-[29%]"
              />
            </div>

            {records.length > 1 && (
              <div className="flex justify-center gap-1.5 pt-4">
                {records.map((record, index) => (
                  <span
                    key={record.id}
                    aria-hidden
                    className={
                      index === activeIndex
                        ? "h-1.5 w-5 rounded-full bg-accent transition-all"
                        : "h-1.5 w-1.5 rounded-full bg-line transition-all"
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="닫기"
            className="sheet-backdrop-in absolute inset-0 bg-ink/40"
            onClick={() => setSelectedRecord(null)}
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
                  onClick={() => setSelectedRecord(null)}
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
          </div>
        </div>
      )}
    </main>
  );
}
