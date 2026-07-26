import { createClient } from "@/lib/supabase/client";

export const MOOD_OPTIONS = [
  { key: "happy", emoji: "😊", label: "기쁨" },
  { key: "calm", emoji: "😌", label: "평온" },
  { key: "tired", emoji: "😴", label: "피곤" },
  { key: "sad", emoji: "😢", label: "우울" },
  { key: "angry", emoji: "😠", label: "짜증" },
  { key: "sick", emoji: "🤒", label: "아픔" },
] as const;

export type MoodKey = (typeof MOOD_OPTIONS)[number]["key"];

export function moodEmoji(mood: MoodKey) {
  return MOOD_OPTIONS.find((option) => option.key === mood)?.emoji ?? "";
}

export async function setDayMood(dateKey: string, mood: MoodKey): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("moods")
    .upsert({ date_key: dateKey, mood }, { onConflict: "user_id,date_key" });

  if (error) throw error;
}

export async function getMoods(): Promise<Map<string, MoodKey>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("moods").select("date_key,mood");

  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.date_key as string, row.mood as MoodKey]));
}
