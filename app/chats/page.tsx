"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDateKey, getDatesWithHistory, todayKey } from "@/lib/chatHistory";
import { MOOD_OPTIONS, getMoods, moodEmoji, setDayMood, type MoodKey } from "@/lib/moods";
import { addEvent, deleteEvent, getAllEvents, type CalendarEvent } from "@/lib/events";
import {
  getMedications,
  getDoseLogs,
  deleteMedication,
  updateMedicationTimes,
  logDose,
  unlogDose,
  computeDoseSlots,
  type MedicationRecord,
  type MedicationLogRecord,
} from "@/lib/medications";
import { MedicationDetailSheet } from "@/components/MedicationDetailSheet";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const LANE_HEIGHT = 26; // px — vertical slot per bar/pill row inside a week
const LANE_ITEM_HEIGHT = 18; // px — visual pill height (leaves a gap within LANE_HEIGHT)

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatPanelTitle(date: Date) {
  return date.toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function formatShortDate(dateKey: string) {
  return dateKey.slice(5).replace("-", "/");
}

function monthCells(month: Date) {
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstWeekday = month.getDay();

  const result: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) result.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    result.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  return result;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

type PeriodEvent = CalendarEvent & { endDateKey: string };
type BarSegment = { event: PeriodEvent; startCol: number; endCol: number };

// A period event's bar within one week row: find which columns (0-6) of
// this week it covers, clipped to the week's boundaries.
function weekSegments(week: (Date | null)[], periodEvents: PeriodEvent[]): BarSegment[] {
  const segments: BarSegment[] = [];
  for (const event of periodEvents) {
    let startCol = -1;
    let endCol = -1;
    week.forEach((date, col) => {
      if (!date) return;
      const key = formatDateKey(date);
      if (key >= event.dateKey && key <= event.endDateKey) {
        if (startCol === -1) startCol = col;
        endCol = col;
      }
    });
    if (startCol !== -1) segments.push({ event, startCol, endCol });
  }
  return segments;
}

// Greedily assign overlapping bars to separate stacked rows (lanes) so two
// period events in the same week don't render on top of each other.
function assignLanes(segments: BarSegment[]): BarSegment[][] {
  const sorted = [...segments].sort((a, b) => a.startCol - b.startCol);
  const lanes: BarSegment[][] = [];
  for (const seg of sorted) {
    const lane = lanes.find((existing) => existing[existing.length - 1].endCol < seg.startCol);
    if (lane) lane.push(seg);
    else lanes.push([seg]);
  }
  return lanes;
}

function RangeCalendar({
  month,
  onMonthChange,
  rangeStart,
  rangeEnd,
  onSelect,
}: {
  month: Date;
  onMonthChange: (next: Date) => void;
  rangeStart: string;
  rangeEnd: string | null;
  onSelect: (dateKey: string) => void;
}) {
  const cells = useMemo(() => monthCells(month), [month]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="이전 달"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-tint"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-ink">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </span>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          aria-label="다음 달"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink transition hover:bg-tint"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-[11px] text-sub">
            {day}
          </span>
        ))}

        {cells.map((date, index) => {
          if (!date) return <div key={index} />;

          const key = formatDateKey(date);
          const isStart = key === rangeStart;
          const isEnd = key === rangeEnd;
          const isEdge = isStart || isEnd;
          const inRange = rangeEnd ? key > rangeStart && key < rangeEnd : false;
          // Only draw the connecting band once a real range exists (two
          // different dates) — a lone start date has nothing to connect to.
          const showBand = rangeEnd !== null && (isEdge || inRange);

          return (
            <div key={index} className="relative flex items-center justify-center py-0.5">
              {showBand && (
                <div
                  className="absolute top-0.5 bottom-0.5 bg-accent/20"
                  style={{ left: isStart ? "50%" : 0, right: isEnd ? "50%" : 0 }}
                  aria-hidden
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(key)}
                className={
                  isEdge
                    ? "relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white"
                    : inRange
                      ? "relative z-10 flex h-8 w-8 items-center justify-center text-xs text-ink"
                      : "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs text-ink transition hover:bg-tint"
                }
              >
                {date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [viewedMonth, setViewedMonth] = useState(() => startOfMonth(new Date()));
  const [historyDates, setHistoryDates] = useState<Set<string>>(new Set());
  const [moods, setMoods] = useState<Map<string, MoodKey>>(new Map());
  const [events, setEvents] = useState<Map<string, CalendarEvent[]>>(new Map());
  // 캘린더에 들어오면 오늘 날짜가 바로 선택된 채로 시작 — 날짜를 눌러야만
  // 당일 기분/복용/일정 패널이 보이던 걸, 열자마자 보이게.
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());
  const [newEventTitle, setNewEventTitle] = useState("");
  const [eventKind, setEventKind] = useState<"single" | "period" | null>(null);
  const [rangeStart, setRangeStart] = useState(() => formatDateKey(new Date()));
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [rangeViewMonth, setRangeViewMonth] = useState(() => startOfMonth(new Date()));
  const [showRangePopup, setShowRangePopup] = useState(false);
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelError, setPanelError] = useState("");
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [selectedDoseLogs, setSelectedDoseLogs] = useState<MedicationLogRecord[]>([]);
  const [selectedMedication, setSelectedMedication] = useState<MedicationRecord | null>(
    null
  );

  useEffect(() => {
    const todayKeyForLogs = formatDateKey(new Date());
    Promise.all([
      getDatesWithHistory(),
      getMoods(),
      getAllEvents(),
      getMedications(),
      getDoseLogs(todayKeyForLogs),
    ]).then(([dates, moodMap, eventMap, meds, doseLogs]) => {
      setHistoryDates(new Set(dates));
      setMoods(moodMap);
      setEvents(eventMap);
      setMedications(meds);
      setSelectedDoseLogs(doseLogs);
      setReady(true);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
  }

  const today = useMemo(() => new Date(), []);
  // realTodayKey drives the calendar's visual "today" marker (the actual
  // calendar date). chatTodayKey drives which day's chat button shows —
  // before the 4am day-start cutoff (see lib/chatHistory.ts), that's still
  // yesterday, so a late-night conversation stays reachable past midnight.
  const realTodayKey = useMemo(() => formatDateKey(today), [today]);
  const chatTodayKey = useMemo(() => todayKey(), []);
  const isCurrentMonth = isSameMonth(viewedMonth, today);

  const cells = useMemo(() => monthCells(viewedMonth), [viewedMonth]);
  const weeks = useMemo(() => chunk(cells, 7), [cells]);

  const periodEvents = useMemo(
    () =>
      Array.from(events.values())
        .flat()
        .filter(
          (event): event is PeriodEvent =>
            Boolean(event.endDateKey) && event.endDateKey !== event.dateKey
        ),
    [events]
  );

  function handleDayClick(date: Date) {
    const key = formatDateKey(date);
    setSelectedDate(date);
    setEventKind(null);
    setRangeStart(key);
    setRangeEnd(null);
    setRangeViewMonth(startOfMonth(date));
    setShowRangePopup(false);
    setPanelError("");
    setSelectedDoseLogs([]);
    getDoseLogs(key)
      .then(setSelectedDoseLogs)
      .catch(() => setPanelError("복용 기록을 불러오지 못했어요."));
  }

  async function handleDoseToggle(
    dateKey: string,
    medicationId: string,
    time: string,
    taken: boolean
  ) {
    setPanelError("");
    if (taken) {
      const previous = selectedDoseLogs.find(
        (l) => l.medicationId === medicationId && l.time === time
      );
      setSelectedDoseLogs((prev) =>
        prev.filter((l) => !(l.medicationId === medicationId && l.time === time))
      );
      try {
        await unlogDose(medicationId, dateKey, time);
      } catch {
        if (previous) setSelectedDoseLogs((prev) => [...prev, previous]);
        setPanelError("체크 해제에 실패했어요. 다시 시도해주세요.");
      }
      return;
    }

    const optimisticId = `optimistic-${medicationId}-${time}`;
    setSelectedDoseLogs((prev) => [
      ...prev,
      {
        id: optimisticId,
        medicationId,
        dateKey,
        time,
        takenAt: new Date().toISOString(),
      },
    ]);
    try {
      await logDose(medicationId, dateKey, time);
    } catch {
      setSelectedDoseLogs((prev) => prev.filter((l) => l.id !== optimisticId));
      setPanelError("체크에 실패했어요. 다시 시도해주세요.");
    }
  }

  async function handleDeleteMedication(id: string) {
    setPanelError("");
    setSelectedMedication(null);
    setMedications((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteMedication(id);
    } catch {
      setPanelError("삭제에 실패했어요. 새로고침 후 다시 시도해주세요.");
    }
  }

  async function handleSaveMedicationTimes(id: string, times: string[]) {
    await updateMedicationTimes(id, times);
    setMedications((prev) => prev.map((m) => (m.id === id ? { ...m, times } : m)));
    setSelectedMedication((prev) => (prev && prev.id === id ? { ...prev, times } : prev));
  }

  async function handleMoodSelect(dateKey: string, mood: MoodKey) {
    setPanelError("");
    const previous = moods.get(dateKey);
    setMoods((prev) => new Map(prev).set(dateKey, mood));
    try {
      await setDayMood(dateKey, mood);
    } catch {
      setMoods((prev) => {
        const next = new Map(prev);
        if (previous) next.set(dateKey, previous);
        else next.delete(dateKey);
        return next;
      });
      setPanelError("기분을 저장하지 못했어요. 다시 시도해주세요.");
    }
  }

  function handleRangeSelect(dateKey: string) {
    if (rangeEnd !== null || dateKey < rangeStart) {
      setRangeStart(dateKey);
      setRangeEnd(null);
    } else if (dateKey !== rangeStart) {
      setRangeEnd(dateKey);
    }
  }

  async function handleAddEvent(formEvent: FormEvent, dayKey: string) {
    formEvent.preventDefault();
    const title = newEventTitle.trim();
    if (!title || panelBusy || !eventKind) return;
    if (eventKind === "period" && !rangeEnd) {
      setPanelError("종료일을 선택해주세요.");
      return;
    }

    const startKey = eventKind === "period" ? rangeStart : dayKey;
    const endDateKey = eventKind === "period" ? (rangeEnd ?? undefined) : undefined;

    setPanelBusy(true);
    setPanelError("");
    try {
      const created = await addEvent(startKey, title, endDateKey);
      setEvents((prev) => {
        const next = new Map(prev);
        next.set(startKey, [...(next.get(startKey) ?? []), created]);
        return next;
      });
      setNewEventTitle("");
      setEventKind(null);
      setRangeEnd(null);
    } catch {
      setPanelError("일정을 추가하지 못했어요. 다시 시도해주세요.");
    } finally {
      setPanelBusy(false);
    }
  }

  async function handleDeleteEvent(dateKey: string, id: string) {
    setPanelError("");
    const previous = events.get(dateKey) ?? [];
    setEvents((prev) => {
      const next = new Map(prev);
      next.set(dateKey, previous.filter((event) => event.id !== id));
      return next;
    });
    try {
      await deleteEvent(id);
    } catch {
      setEvents((prev) => new Map(prev).set(dateKey, previous));
      setPanelError("일정을 삭제하지 못했어요. 다시 시도해주세요.");
    }
  }

  if (!ready) return null;

  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;
  // A period event is stored under its start date, but should still show up
  // in the panel for every day it spans — not just the day it started on.
  const selectedDayEvents = selectedKey
    ? Array.from(events.values())
        .flat()
        .filter((event) => {
          const end = event.endDateKey ?? event.dateKey;
          return event.dateKey <= selectedKey && selectedKey <= end;
        })
    : [];

  const selectedActiveMedications = selectedKey
    ? medications.filter((m) => m.startDate <= selectedKey && selectedKey <= m.endDate)
    : [];
  const selectedDoseSlots = selectedKey
    ? computeDoseSlots(selectedActiveMedications, selectedDoseLogs, selectedKey)
    : [];
  const nowHHMM = new Date().toTimeString().slice(0, 5);

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center justify-between px-3 pb-4 pr-3"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push("/main")}
            aria-label="메인으로 돌아가기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-xl font-bold tracking-tight text-ink">대화 일기</h1>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-full px-3 py-2.5 text-xs font-medium text-sub transition hover:bg-tint hover:text-ink active:bg-tint"
        >
          로그아웃
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            aria-label="이전 달"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <span className="font-semibold text-ink">
            {viewedMonth.getFullYear()}년 {viewedMonth.getMonth() + 1}월
          </span>

          <button
            onClick={() => setViewedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            aria-label="다음 달"
            disabled={isCurrentMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint disabled:pointer-events-none disabled:opacity-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-2 text-xs font-medium text-sub">
              {day}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {weeks.map((week, weekIndex) => {
            const lanes = assignLanes(weekSegments(week, periodEvents));

            // Per-day vertical offset: a day's single-event pill sits right
            // below the date, dropping only past the lanes that actually
            // touch that specific day — not the week's overall tallest stack.
            const dayInfo = week.map((date, col) => {
              if (!date) return null;
              const key = formatDateKey(date);
              const dayEvents = (events.get(key) ?? []).filter(
                (event) => !event.endDateKey || event.endDateKey === event.dateKey
              );
              const label =
                dayEvents.length === 0
                  ? null
                  : dayEvents.length === 1
                    ? dayEvents[0].title
                    : `${dayEvents[0].title} 외 ${dayEvents.length - 1}`;
              const touchingLanes = lanes
                .map((lane, laneIndex) =>
                  lane.some((seg) => seg.startCol <= col && col <= seg.endCol) ? laneIndex : -1
                )
                .filter((i) => i !== -1);
              const top = (touchingLanes.length ? Math.max(...touchingLanes) + 1 : 0) * LANE_HEIGHT;
              return { label, top, dayEvents };
            });

            const hasAnyPill = dayInfo.some((info) => info?.label);
            const areaHeight = lanes.length * LANE_HEIGHT + (hasAnyPill ? LANE_HEIGHT : 0);

            return (
              <div key={weekIndex}>
                <div className="grid grid-cols-7 gap-y-1 text-center">
                  {week.map((date, dayIndex) => {
                    if (!date) return <div key={dayIndex} />;

                    const key = formatDateKey(date);
                    const isToday = key === realTodayKey;
                    const hasHistory = historyDates.has(key);
                    const isSelected = key === selectedKey;
                    const mood = moods.get(key);

                    const baseClass = isToday
                      ? "relative flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white transition active:scale-95"
                      : hasHistory
                        ? "relative flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 text-sm font-medium text-ink transition hover:bg-tint active:bg-tint"
                        : "relative flex h-10 w-10 items-center justify-center rounded-full text-sm text-sub/50 transition hover:bg-tint active:bg-tint";

                    return (
                      <div key={dayIndex} className="flex items-center justify-center py-0.5">
                        <button
                          onClick={() => handleDayClick(date)}
                          className={
                            isSelected
                              ? `${baseClass} ring-2 ring-accent ring-offset-2 ring-offset-bg`
                              : baseClass
                          }
                        >
                          {date.getDate()}
                          {hasHistory && !isToday && (
                            <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden />
                          )}
                          {mood && (
                            <span
                              className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface text-[10px] shadow-sm"
                              aria-hidden
                            >
                              {moodEmoji(mood)}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {areaHeight > 0 && (
                  <div className="relative mt-1" style={{ height: areaHeight }}>
                    {lanes.map((lane, laneIndex) =>
                      lane.map((seg) => (
                        <div
                          key={seg.event.id}
                          className="absolute truncate rounded-md border-l-2 border-blush-deep bg-blush/40 text-center text-[9px] font-medium leading-[18px] text-ink shadow-[0_1px_2px_rgba(22,33,44,0.08)]"
                          style={{
                            top: laneIndex * LANE_HEIGHT,
                            height: LANE_ITEM_HEIGHT,
                            left: `calc(${(seg.startCol / 7) * 100}% + 2px)`,
                            width: `calc(${((seg.endCol - seg.startCol + 1) / 7) * 100}% - 4px)`,
                          }}
                          title={`${seg.event.title} (${formatShortDate(seg.event.dateKey)}~${formatShortDate(seg.event.endDateKey)})`}
                        >
                          {seg.event.title}
                        </div>
                      ))
                    )}

                    {dayInfo.map((info, col) =>
                      info?.label ? (
                        <div
                          key={col}
                          className="absolute truncate rounded-md border-l-2 border-accent/60 bg-tint text-center text-[9px] font-medium leading-[18px] text-ink shadow-[0_1px_2px_rgba(22,33,44,0.08)]"
                          style={{
                            top: info.top,
                            height: LANE_ITEM_HEIGHT,
                            left: `calc(${(col / 7) * 100}% + 2px)`,
                            width: `calc(${(1 / 7) * 100}% - 4px)`,
                          }}
                          title={info.dayEvents.map((event) => event.title).join(", ")}
                        >
                          {info.label}
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-sub">
          날짜를 누르면 일정을 남길 수 있어요. 기분은 오늘 날짜에서만 남길 수 있어요. 테두리와 점이 있는 날은 대화가 남아있는 날이에요.
        </p>

        {selectedDate && selectedKey && (
          <div className="mt-4 rounded-2xl bg-surface p-5 shadow-[0_2px_10px_-4px_rgba(22,33,44,0.15)]">
            <p className="mb-4 font-semibold text-ink">{formatPanelTitle(selectedDate)}</p>

            {selectedKey === chatTodayKey && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-sub">오늘 기분이 어떠세요?</p>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((option) => {
                    const active = moods.get(selectedKey) === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => handleMoodSelect(selectedKey, option.key)}
                        className={
                          active
                            ? "flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-sm text-white transition"
                            : "flex items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-sm text-ink transition hover:bg-tint/70"
                        }
                      >
                        <span>{option.emoji}</span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedDoseSlots.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-medium text-sub">복용/복약</p>
                <div className="flex flex-col gap-1.5">
                  {selectedDoseSlots.map((slot) => {
                    const due =
                      selectedKey === chatTodayKey &&
                      !slot.taken &&
                      slot.time <= nowHHMM;
                    return (
                      <div
                        key={`${slot.medicationId}-${slot.time}`}
                        className={
                          slot.taken
                            ? "flex items-center justify-between rounded-md border-l-2 border-line bg-tint px-3 py-2 text-sm text-ink transition"
                            : due
                              ? "flex items-center justify-between rounded-md border-l-2 border-danger bg-danger-tint px-3 py-2 text-sm text-ink transition"
                              : "flex items-center justify-between rounded-md border-l-2 border-accent/60 bg-surface px-3 py-2 text-sm text-ink transition hover:bg-tint/70"
                        }
                      >
                        <button
                          onClick={() => {
                            const med = medications.find((m) => m.id === slot.medicationId);
                            if (med) setSelectedMedication(med);
                          }}
                          className="flex-1 text-left"
                        >
                          <span className={slot.taken ? "opacity-60" : ""}>
                            {slot.name}
                            <span className="ml-1.5 text-xs text-sub">{slot.time}</span>
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            handleDoseToggle(
                              selectedKey,
                              slot.medicationId,
                              slot.time,
                              slot.taken
                            )
                          }
                          aria-pressed={slot.taken}
                          aria-label={`${slot.name} ${slot.time} 복용 체크`}
                          className={
                            slot.taken
                              ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent text-white"
                              : "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-line"
                          }
                        >
                          {slot.taken && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M5 13l4 4L19 7"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-5">
              <p className="mb-2 text-xs font-medium text-sub">일정</p>
              {selectedDayEvents.length > 0 && (
                <div className="mb-2 flex flex-col gap-1.5">
                  {selectedDayEvents.map((event) => {
                    const isPeriod = Boolean(event.endDateKey) && event.endDateKey !== event.dateKey;
                    return (
                      <div
                        key={event.id}
                        className={
                          isPeriod
                            ? "flex items-center justify-between rounded-md border-l-2 border-blush-deep bg-blush/40 px-3 py-2 text-sm text-ink"
                            : "flex items-center justify-between rounded-md border-l-2 border-accent/60 bg-tint px-3 py-2 text-sm text-ink"
                        }
                      >
                        <span>
                          {event.title}
                          {isPeriod && (
                            <span className="ml-1 text-xs text-sub">
                              ({formatShortDate(event.dateKey)}~{formatShortDate(event.endDateKey!)})
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleDeleteEvent(event.dateKey, event.id)}
                          aria-label="일정 삭제"
                          className="text-sub transition hover:text-danger"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEventKind("single")}
                  className={
                    eventKind === "single"
                      ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition"
                      : "rounded-full bg-tint px-3 py-1 text-xs font-medium text-ink transition hover:bg-tint/70"
                  }
                >
                  일반
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEventKind("period");
                    setShowRangePopup(true);
                  }}
                  className={
                    eventKind === "period"
                      ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-white transition"
                      : "rounded-full bg-tint px-3 py-1 text-xs font-medium text-ink transition hover:bg-tint/70"
                  }
                >
                  기간
                </button>
                {eventKind === "period" && (
                  <button
                    type="button"
                    onClick={() => setShowRangePopup(true)}
                    className="rounded-full bg-tint px-3 py-1 text-xs text-ink transition hover:bg-tint/70"
                  >
                    {rangeEnd
                      ? `${formatShortDate(rangeStart)} ~ ${formatShortDate(rangeEnd)}`
                      : "기간 선택하기"}
                  </button>
                )}
              </div>

              {eventKind && (
                <form
                  onSubmit={(event) => handleAddEvent(event, selectedKey)}
                  className="mt-2 flex flex-col gap-2"
                >
                  <input
                    value={newEventTitle}
                    onChange={(event) => setNewEventTitle(event.target.value)}
                    placeholder="일정을 입력하세요"
                    className="rounded-full bg-tint px-3 py-2 text-sm text-ink outline-none placeholder:text-sub/70"
                  />
                  <button
                    type="submit"
                    disabled={panelBusy || !newEventTitle.trim() || (eventKind === "period" && !rangeEnd)}
                    className="self-end rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-deep disabled:opacity-40"
                  >
                    추가
                  </button>
                </form>
              )}
            </div>

            {panelError && (
              <p className="mb-3 text-center text-sm text-danger" role="alert">
                {panelError}
              </p>
            )}

            {selectedKey === chatTodayKey && (
              <button
                onClick={() => router.push("/chat")}
                className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent-deep"
              >
                대화하기
              </button>
            )}
            {selectedKey < chatTodayKey && (
              <button
                onClick={() => router.push(`/chats/${selectedKey}`)}
                className="w-full rounded-full bg-tint py-3 text-sm font-semibold text-ink transition hover:bg-tint/70"
              >
                이전 대화 보기
              </button>
            )}
          </div>
        )}
      </div>

      {showRangePopup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            aria-label="닫기"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setShowRangePopup(false)}
          />
          <div
            className="relative z-10 w-full max-w-md rounded-t-3xl bg-surface p-5"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />

            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEventKind(null);
                  setRangeEnd(null);
                  setShowRangePopup(false);
                }}
                aria-label="기간 일정 취소"
                className="flex h-9 w-9 items-center justify-center rounded-full text-sub transition hover:bg-tint"
              >
                ✕
              </button>
              <span className="text-sm font-semibold text-ink">기간 선택</span>
              <button
                type="button"
                onClick={() => setShowRangePopup(false)}
                aria-label="선택 완료"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-tint text-accent transition hover:bg-tint/70"
              >
                ✓
              </button>
            </div>

            <p className="mb-3 text-center text-sm text-sub">
              {rangeEnd
                ? `${formatShortDate(rangeStart)} ~ ${formatShortDate(rangeEnd)}`
                : `시작일 ${formatShortDate(rangeStart)} · 종료일을 눌러주세요`}
            </p>

            <RangeCalendar
              month={rangeViewMonth}
              onMonthChange={setRangeViewMonth}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onSelect={handleRangeSelect}
            />
          </div>
        </div>
      )}

      {selectedMedication && (
        <MedicationDetailSheet
          key={selectedMedication.id}
          medication={selectedMedication}
          today={realTodayKey}
          onClose={() => setSelectedMedication(null)}
          onDelete={handleDeleteMedication}
          onSaveTimes={handleSaveMedicationTimes}
        />
      )}
    </main>
  );
}
