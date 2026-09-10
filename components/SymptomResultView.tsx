"use client";

import { useState } from "react";
import type { SymptomResult } from "@/lib/symptomCheck";
import { HospitalMap } from "@/components/HospitalMap";

// Shared between the live result screen (app/symptom-check/page.tsx, right
// after generateReply returns) and the history detail view
// (app/symptom-check/history/page.tsx, replaying a saved record) so both
// look and behave identically — including the department buttons, which
// re-run a live hospital search near the viewer's current location
// regardless of when the original check happened.
export function SymptomResultView({ result }: { result: SymptomResult }) {
  const [activeDepartment, setActiveDepartment] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-3 rounded-card bg-blush/15 px-4 py-3.5">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-blush-deep" />
        <p className="text-xs leading-relaxed text-ink/80">{result.disclaimer}</p>
      </div>

      {result.photoClassification && (
        <div className="flex items-center gap-2 rounded-full bg-tint px-4 py-2.5 text-xs font-medium text-ink/80">
          <CameraIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span>AI 사진 분석: {result.photoClassification}</span>
        </div>
      )}

      <SectionCard
        icon={<PulseIcon className="h-4 w-4" />}
        title="의심되는 증상/질환"
        emphasis
      >
        {result.conditions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {result.conditions.map((condition) => (
              <li
                key={condition}
                className="text-base font-semibold leading-snug text-ink"
              >
                {condition}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-sub">{result.summary}</p>
        )}

        {result.conditions.length > 0 && result.summary && (
          <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-sub">
            {result.summary}
          </p>
        )}
      </SectionCard>

      {result.homeCare.length > 0 && (
        <SectionCard
          icon={<HomeIcon className="h-4 w-4" />}
          title="집에서 할 수 있는 응급처치·관리법"
        >
          <BulletList items={result.homeCare} />
        </SectionCard>
      )}

      {result.foods.length > 0 && (
        <SectionCard
          icon={<UtensilsIcon className="h-4 w-4" />}
          title="이럴 때 먹으면 좋은 음식"
        >
          <BulletList items={result.foods} />
        </SectionCard>
      )}

      {result.departments.length > 0 && (
        <SectionCard
          icon={<PinIcon className="h-4 w-4" />}
          title="가보면 좋을 진료과"
          subtitle="눌러서 반경 5km 내 병원을 지도로 볼 수 있어요."
        >
          <div className="flex flex-wrap gap-2">
            {result.departments.map((department) => (
              <button
                key={department}
                onClick={() =>
                  setActiveDepartment((prev) =>
                    prev === department ? null : department
                  )
                }
                className={
                  activeDepartment === department
                    ? "rounded-full border-2 border-accent bg-tint px-3 py-1.5 text-sm font-semibold text-ink transition"
                    : "rounded-full border-2 border-transparent bg-tint px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent/40"
                }
              >
                주변 {department} 병원
              </button>
            ))}
          </div>

          {activeDepartment && (
            <HospitalMap key={activeDepartment} department={activeDepartment} />
          )}
        </SectionCard>
      )}
    </>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  emphasis,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card bg-surface p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={
            emphasis
              ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-white"
              : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-accent"
          }
        >
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {subtitle && <p className="mb-3 text-xs text-sub">{subtitle}</p>}
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-ink">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent/50" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 11v5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.75" r="1" fill="currentColor" />
    </svg>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 12h4l2-7 4 14 2-7h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 11.5 12 4l8 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v9h12v-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UtensilsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 3v7a2 2 0 0 0 2 2v9M7 3v7M9 3v7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 3c-1.5 0-2.5 2-2.5 5s1 5 2.5 5v8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
