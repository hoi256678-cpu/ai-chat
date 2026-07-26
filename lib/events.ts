import { createClient } from "@/lib/supabase/client";
import { todayKey, tomorrowKey } from "@/lib/chatHistory";

export type CalendarEvent = {
  id: string;
  dateKey: string;
  endDateKey?: string;
  title: string;
};

export async function addEvent(
  dateKey: string,
  title: string,
  endDateKey?: string
): Promise<CalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ date_key: dateKey, end_date_key: endDateKey ?? null, title })
    .select("id,date_key,end_date_key,title")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    dateKey: data.date_key,
    endDateKey: data.end_date_key ?? undefined,
    title: data.title,
  };
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) throw error;
}

export async function getAllEvents(): Promise<Map<string, CalendarEvent[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,date_key,end_date_key,title")
    .order("created_at");

  if (error) throw error;

  const map = new Map<string, CalendarEvent[]>();
  for (const row of data ?? []) {
    const event: CalendarEvent = {
      id: row.id,
      dateKey: row.date_key,
      endDateKey: row.end_date_key ?? undefined,
      title: row.title,
    };
    const existing = map.get(event.dateKey);
    if (existing) existing.push(event);
    else map.set(event.dateKey, [event]);
  }
  return map;
}

export async function getUpcomingEvents(): Promise<CalendarEvent[]> {
  const allByDate = await getAllEvents();
  const today = todayKey();
  const tomorrow = tomorrowKey();

  return Array.from(allByDate.values())
    .flat()
    .filter((event) => {
      const end = event.endDateKey ?? event.dateKey;
      return event.dateKey <= tomorrow && end >= today;
    });
}

function formatMonthDay(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

export function buildEventContext(events: CalendarEvent[]): string | undefined {
  if (events.length === 0) return undefined;

  const today = todayKey();
  const lines = events.map((event) => {
    if (event.endDateKey && event.endDateKey !== event.dateKey) {
      const range = `${formatMonthDay(event.dateKey)}~${formatMonthDay(event.endDateKey)}`;
      const ongoing = event.dateKey <= today && event.endDateKey >= today;
      return ongoing
        ? `- ${event.title} (${range}, 오늘도 포함된 기간 일정이에요)`
        : `- ${event.title} (${range}, 내일부터 시작하는 기간 일정이에요)`;
    }
    const when = event.dateKey === today ? "오늘" : "내일";
    return `- ${when}: ${event.title}`;
  });

  return `사용자의 예정된 일정이에요:\n${lines.join("\n")}\n대화 흐름이 자연스러울 때 이 일정을 부담스럽지 않게 한 번 언급하거나 물어봐 주세요. 매번 언급할 필요는 없어요.`;
}
