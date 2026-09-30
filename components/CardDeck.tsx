"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

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
// CSS `scroll-behavior: smooth` — both proved inconsistent in testing
// (sometimes resolving instantly instead of animating, likely CSS
// scroll-snap correcting the position before the browser's own smooth-
// scroll had a frame to run). scroll-snap-type is turned off for the
// duration so its snap-correction can't fight our per-frame writes, then
// restored once we land exactly on the target.
function animateScrollTo(
  track: HTMLDivElement,
  target: number,
  duration = 280,
  onComplete?: () => void
) {
  const start = track.scrollLeft;
  const distance = target - start;
  if (Math.abs(distance) < 1) {
    onComplete?.();
    return;
  }

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
      onComplete?.();
    }
  }
  requestAnimationFrame(step);
}

export type CardDeckProps<T> = {
  items: T[];
  getKey: (item: T) => string;
  onSelect: (item: T) => void;
  cardClassName: (active: boolean) => string;
  renderCard: (item: T, active: boolean) => ReactNode;
};

// Full-bleed, app-switcher-style swipeable card deck (mouse-drag + native
// touch swipe). Extracted from components/SymptomHistorySection.tsx so other
// lists (e.g. medications) can reuse the same drag/snap mechanics without
// duplicating this file's math.
export function CardDeck<T>({
  items,
  getKey,
  onSelect,
  cardClassName,
  renderCard,
}: CardDeckProps<T>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // dragRef only exists WHILE a drag is live (mousedown..mouseup) — it is
  // set to null the instant mouseup fires. Without that, a stray mousemove
  // between two drags would still see the *previous* drag's stale
  // startX/startScrollLeft and yank the track to a bogus position.
  const dragRef = useRef<{
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  // Separate from dragRef: the card <button>'s click event fires right
  // after mouseup, in the same event-loop turn, and needs to know whether
  // the drag that just ended actually moved the track (to suppress
  // opening the card).
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

  // Centers a given card in the track (same math as the post-drag snap in
  // handleMouseUp), then runs onComplete once it's actually settled there.
  function focusCard(index: number, onComplete?: () => void) {
    const track = trackRef.current;
    const card = cardRefs.current[index];
    if (!track || !card) {
      onComplete?.();
      return;
    }
    const targetLeft = card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
    setActiveIndex(index);
    animateScrollTo(track, targetLeft, 280, onComplete);
  }

  // A card's onClick fires right after mouseup — skip it (once) when the
  // mouse actually dragged the track, so panning past a card doesn't also
  // open it. On wide viewports where neighboring cards peek in, clicking one
  // of those dimmed side cards brings it to front first — it only opens
  // once it's finished settling into the center, not mid-slide.
  function handleCardClick(item: T, index: number) {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    if (index !== activeIndex) {
      focusCard(index, () => onSelect(item));
      return;
    }
    onSelect(item);
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

  return (
    <>
      {/* Full-bleed (not the app's usual mx-auto max-w-md column) so each
          card can be as large as the screen itself, the way a phone's
          app-switcher deck fills the whole width. */}
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
            percentages resolve against the track's own outer width, while
            the card wrappers' width percentages resolve against the
            track's (padding-reduced) content box — nesting one inside the
            other compounds instead of adding up. A spacer sized off the
            same basis as the cards (both direct flex children of the
            unpadded track) keeps the percentages simply summing to 100%. */}
        <div
          aria-hidden
          className="w-[6%] shrink-0 sm:w-[15%] md:w-[22.5%] lg:w-[29%]"
        />
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <div
              key={getKey(item)}
              className="flex w-[88%] shrink-0 snap-center justify-center px-2 sm:w-[70%] md:w-[55%] lg:w-[42%]"
            >
              <button
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                // A partially-offscreen card gaining focus makes the browser
                // auto-scroll it into view, which fires handleTrackScroll and
                // flips activeIndex to this card *before* onClick reads it —
                // so a click on a dimmed side card would look like it was
                // already active and open immediately instead of just
                // focusing. Suppressing the mousedown-triggered focus (Tab
                // navigation is unaffected, that doesn't fire mousedown)
                // keeps activeIndex — and thus the open-vs-focus decision —
                // exactly what it was when the click started.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleCardClick(item, index)}
                className={cardClassName(active)}
              >
                {renderCard(item, active)}
              </button>
            </div>
          );
        })}
        <div
          aria-hidden
          className="w-[6%] shrink-0 sm:w-[15%] md:w-[22.5%] lg:w-[29%]"
        />
      </div>

      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-4">
          {items.map((item, index) => (
            <span
              key={getKey(item)}
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
  );
}
