import type { ReactNode } from "react";

/**
 * Samsung Health-style list row: icon chip + title/subtitle + chevron,
 * on a shadowed card surface. Replaces the old identical pill-button
 * stack on the main hub with a scannable, weighted list.
 */
const CHIP_TONE = {
  accent: "bg-tint text-accent",
  blush: "bg-blush/25 text-blush-deep",
} as const;

export default function MenuCard({
  icon,
  tone = "accent",
  label,
  description,
  onClick,
}: {
  icon: ReactNode;
  tone?: "accent" | "blush";
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-card bg-surface p-4 text-left shadow-card transition hover:bg-tint active:scale-[0.98]"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${CHIP_TONE[tone]}`}
        aria-hidden
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{label}</span>
        <span className="block truncate text-xs text-sub">{description}</span>
      </span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="shrink-0 text-sub"
        aria-hidden
      >
        <path
          d="M9 6l6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
