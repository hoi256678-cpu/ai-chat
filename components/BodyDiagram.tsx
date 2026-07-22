"use client";

type View = "front" | "back";

const TORSO_LABELS: Record<View, { upper: string; lower: string; pelvis: string }> = {
  front: { upper: "가슴", lower: "배(복부)", pelvis: "골반" },
  back: { upper: "등 위쪽", lower: "허리", pelvis: "엉덩이" },
};

export function BodyDiagram({
  view,
  onViewChange,
  selected,
  onSelect,
}: {
  view: View;
  onViewChange: (view: View) => void;
  selected: string | null;
  onSelect: (part: string) => void;
}) {
  const labels = TORSO_LABELS[view];

  function regionClass(part: string) {
    return selected === part
      ? "fill-accent transition-colors cursor-pointer"
      : "fill-tint transition-colors cursor-pointer hover:fill-accent/40";
  }

  function jointClass(part: string) {
    return selected === part
      ? "fill-accent-deep transition-colors cursor-pointer"
      : "fill-surface transition-colors cursor-pointer hover:fill-accent/50";
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 inline-flex rounded-full border border-line bg-surface p-1">
        <button
          type="button"
          onClick={() => onViewChange("front")}
          className={
            view === "front"
              ? "rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white transition"
              : "rounded-full px-4 py-1.5 text-xs font-medium text-sub transition"
          }
        >
          앞면
        </button>
        <button
          type="button"
          onClick={() => onViewChange("back")}
          className={
            view === "back"
              ? "rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-white transition"
              : "rounded-full px-4 py-1.5 text-xs font-medium text-sub transition"
          }
        >
          뒷면
        </button>
      </div>

      <svg
        viewBox="0 0 200 420"
        width="180"
        height="378"
        role="group"
        aria-label={`신체 부위 선택 그림 (${view === "front" ? "앞면" : "뒷면"})`}
      >
        {/* torso */}
        <rect x="65" y="88" width="70" height="60" rx="14" className={regionClass(labels.upper)} onClick={() => onSelect(labels.upper)} stroke="var(--bg)" strokeWidth="3" />
        <rect x="65" y="148" width="70" height="50" rx="14" className={regionClass(labels.lower)} onClick={() => onSelect(labels.lower)} stroke="var(--bg)" strokeWidth="3" />
        <rect x="68" y="198" width="64" height="30" rx="14" className={regionClass(labels.pelvis)} onClick={() => onSelect(labels.pelvis)} stroke="var(--bg)" strokeWidth="3" />

        {/* neck + shoulder */}
        <rect x="88" y="56" width="24" height="14" rx="7" className={regionClass("목")} onClick={() => onSelect("목")} stroke="var(--bg)" strokeWidth="3" />
        <rect x="55" y="70" width="90" height="18" rx="9" className={regionClass("어깨")} onClick={() => onSelect("어깨")} stroke="var(--bg)" strokeWidth="3" />

        {/* head */}
        <circle cx="100" cy="32" r="24" className={regionClass("머리")} onClick={() => onSelect("머리")} stroke="var(--bg)" strokeWidth="3" />
        {view === "front" && (
          <>
            <circle cx="91" cy="28" r="2.5" className="fill-sub" aria-hidden />
            <circle cx="109" cy="28" r="2.5" className="fill-sub" aria-hidden />
          </>
        )}

        {/* arms */}
        <rect x="28" y="88" width="26" height="140" rx="13" className={regionClass("팔")} onClick={() => onSelect("팔")} stroke="var(--bg)" strokeWidth="3" />
        <rect x="146" y="88" width="26" height="140" rx="13" className={regionClass("팔")} onClick={() => onSelect("팔")} stroke="var(--bg)" strokeWidth="3" />

        {/* legs */}
        <rect x="66" y="228" width="28" height="150" rx="14" className={regionClass("다리")} onClick={() => onSelect("다리")} stroke="var(--bg)" strokeWidth="3" />
        <rect x="106" y="228" width="28" height="150" rx="14" className={regionClass("다리")} onClick={() => onSelect("다리")} stroke="var(--bg)" strokeWidth="3" />

        {/* joints — layered on top so they're independently clickable */}
        <circle cx="41" cy="170" r="10" className={jointClass("팔꿈치")} onClick={() => onSelect("팔꿈치")} stroke="var(--bg)" strokeWidth="2" />
        <circle cx="159" cy="170" r="10" className={jointClass("팔꿈치")} onClick={() => onSelect("팔꿈치")} stroke="var(--bg)" strokeWidth="2" />

        <circle cx="41" cy="224" r="11" className={jointClass("손목/손")} onClick={() => onSelect("손목/손")} stroke="var(--bg)" strokeWidth="2" />
        <circle cx="159" cy="224" r="11" className={jointClass("손목/손")} onClick={() => onSelect("손목/손")} stroke="var(--bg)" strokeWidth="2" />

        <circle cx="80" cy="293" r="11" className={jointClass("무릎")} onClick={() => onSelect("무릎")} stroke="var(--bg)" strokeWidth="2" />
        <circle cx="120" cy="293" r="11" className={jointClass("무릎")} onClick={() => onSelect("무릎")} stroke="var(--bg)" strokeWidth="2" />

        <circle cx="80" cy="384" r="12" className={jointClass("발목/발")} onClick={() => onSelect("발목/발")} stroke="var(--bg)" strokeWidth="2" />
        <circle cx="120" cy="384" r="12" className={jointClass("발목/발")} onClick={() => onSelect("발목/발")} stroke="var(--bg)" strokeWidth="2" />
      </svg>
    </div>
  );
}
