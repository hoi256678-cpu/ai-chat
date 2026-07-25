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

export function todayKey() {
  return formatDateKey(new Date());
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
