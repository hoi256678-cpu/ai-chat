import { createClient } from "@/lib/supabase/client";

export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  time: string;
};

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The "day" doesn't roll over at midnight — late-night chats before this
// hour still belong to the previous calendar date, so a 1am conversation
// continues yesterday's thread instead of starting a new empty one.
const DAY_START_HOUR = 4;

function effectiveToday() {
  const now = new Date();
  if (now.getHours() < DAY_START_HOUR) {
    now.setDate(now.getDate() - 1);
  }
  return now;
}

export function todayKey() {
  return formatDateKey(effectiveToday());
}

export function tomorrowKey() {
  const tomorrow = effectiveToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDateKey(tomorrow);
}

export async function getDayMessages(dateKey: string): Promise<StoredMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role,content,time")
    .eq("date_key", dateKey)
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as StoredMessage[];
}

export async function appendDayMessage(dateKey: string, message: StoredMessage) {
  const supabase = createClient();
  const { error } = await supabase.from("messages").insert({
    date_key: dateKey,
    role: message.role,
    content: message.content,
    time: message.time,
  });

  if (error) throw error;
}

export async function getDatesWithHistory(): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("messages").select("date_key");

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.date_key as string))];
}
