"use client";

import { useState } from "react";
import { CRISIS_NOTICE, type CrisisLine } from "@/lib/crisisNotice";

// "112 · 119"처럼 번호가 둘이면 각각 전화 링크로 만든다.
function PhoneLinks({ number }: { number: string }) {
  const parts = number.split("·").map((part) => part.trim());
  return (
    <span className="flex shrink-0 gap-2">
      {parts.map((part) => (
        <a
          key={part}
          href={`tel:${part.replace(/-/g, "")}`}
          className="font-semibold text-accent underline-offset-2 hover:underline"
        >
          {part}
        </a>
      ))}
    </span>
  );
}

function LineRow({ line }: { line: CrisisLine }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="min-w-0 text-ink">
        {line.name} <span className="text-sub">· {line.note}</span>
      </span>
      <PhoneLinks number={line.number} />
    </li>
  );
}

// 위기 표현이 있었던 대화 밑에 붙는 고정 안내 띠. 말풍선이 아니라 화면 폭 상자로 대화와 구분한다.
// 대표 기관(109)만 보이고, 펼침 버튼을 누르면 다른 기관 번호가 나온다.
export function CrisisNotice() {
  const [open, setOpen] = useState(false);
  const { title, primary, more } = CRISIS_NOTICE;

  return (
    <div role="note" className="my-2 rounded-xl border border-line bg-tint px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="flex items-baseline gap-2 text-[13px] text-sub">
            <span>
              {primary.name} · {primary.note}
            </span>
            <PhoneLinks number={primary.number} />
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "다른 상담 기관 접기" : "다른 상담 기관 더 보기"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sub transition hover:bg-surface"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className={open ? "rotate-180 transition-transform" : "transition-transform"}
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
      </div>

      {open && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {more.map((line) => (
            <LineRow key={line.name} line={line} />
          ))}
        </ul>
      )}
    </div>
  );
}
