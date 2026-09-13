import { createClient } from "@/lib/supabase/client";

export type BiometricReading = {
  measuredAt: string; // ISO 8601
  heartRate: number;
};

export type BiometricRecord = BiometricReading & {
  id: string;
  createdAt: string;
};

export async function saveBiometricReadings(
  readings: BiometricReading[]
): Promise<void> {
  const valid = readings.filter(
    (r) => Number.isFinite(r.heartRate) && r.heartRate > 0 && r.heartRate < 300
  );
  if (valid.length === 0) return;

  const supabase = createClient();
  const { error } = await supabase.from("biometrics").upsert(
    valid.map((r) => ({
      heart_rate: r.heartRate,
      measured_at: r.measuredAt,
    })),
    { onConflict: "user_id,measured_at", ignoreDuplicates: true }
  );

  if (error) throw error;
}

export async function getRecentBiometrics(
  limit = 50
): Promise<BiometricRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("biometrics")
    .select("id,heart_rate,measured_at,created_at")
    .order("measured_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    heartRate: row.heart_rate,
    measuredAt: row.measured_at,
    createdAt: row.created_at,
  }));
}

export async function getLatestMeasuredAt(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("biometrics")
    .select("measured_at")
    .order("measured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? new Date(data.measured_at).toISOString() : null;
}
