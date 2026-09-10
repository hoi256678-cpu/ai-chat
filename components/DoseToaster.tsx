"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { formatDateKey } from "@/lib/chatHistory";
import { getDueSlots, type DoseSlot } from "@/lib/medications";
import { isDoseToasted, markDoseToasted, markDosesSeen } from "@/lib/doseNotifications";

const POLL_INTERVAL_MS = 30_000;
const AUTO_DISMISS_MS = 5_000;

// "/" and "/signup" are the only pages reachable without a session (see
// proxy.ts) — everywhere else, polling for due doses is safe.
const UNAUTHENTICATED_PATHS = new Set(["/", "/signup"]);

// Mounted once in the root layout so it fires no matter which screen is
// open — a Toss-style banner sliding down from the top the moment a dose
// becomes due, independent of the /main bell's read/unread badge.
export function DoseToaster() {
  const router = useRouter();
  const pathname = usePathname();
  const [queue, setQueue] = useState<DoseSlot[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    if (UNAUTHENTICATED_PATHS.has(pathname)) return;

    let cancelled = false;

    function poll() {
      getDueSlots()
        .then((slots) => {
          if (cancelled) return;
          const today = formatDateKey(new Date());
          const fresh = slots.filter(
            (slot) => !isDoseToasted(today, slot.medicationId, slot.time)
          );
          if (fresh.length === 0) return;
          for (const slot of fresh) {
            markDoseToasted(today, slot.medicationId, slot.time);
          }
          setQueue((prev) => [...prev, ...fresh]);
        })
        .catch(() => {});
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [current]);

  if (!current) return null;

  function handleClick() {
    if (!current) return;
    setQueue((prev) => prev.slice(1));
    markDosesSeen(formatDateKey(new Date()), [current]);
    router.push("/medications");
  }

  return (
    <div
      key={`${current.medicationId}-${current.time}`}
      className="toast-slide-down pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-4"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <button
        onClick={handleClick}
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-card bg-surface px-4 py-3.5 text-left shadow-[0_16px_32px_-12px_rgba(22,33,44,0.35)] transition active:scale-[0.98]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint text-accent">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 8a6 6 0 0 1 12 0c0 3.2 1 5 1.8 6.2a1 1 0 0 1-.8 1.6H5a1 1 0 0 1-.8-1.6C5 13 6 11.2 6 8Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M9.5 18.5a2.5 2.5 0 0 0 5 0"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="flex-1 text-sm text-ink">
          <span className="font-semibold">{current.name}</span> 복용/복약 시간이에요
        </span>
        <span className="shrink-0 text-xs text-sub">{current.time}</span>
      </button>
    </div>
  );
}
