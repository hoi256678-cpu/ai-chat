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

export function buildBiometricContext(
  readings: BiometricRecord[]
): string | undefined {
  if (readings.length < 2) return undefined;

  const values = readings.map((r) => r.heartRate);
  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const latest = readings[0];
  const latestTime = new Date(latest.measuredAt).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    `사용자의 최근 심박수 기록 요약이에요: 평균 ${avg}bpm, 최고 ${max}bpm, 최저 ${min}bpm, ` +
    `가장 최근 측정값은 ${latestTime}에 ${latest.heartRate}bpm이었어요. ` +
    `평소와 다른 패턴이 보이면 자연스럽게 물어봐도 좋지만, 의학적 진단은 하지 마세요.`
  );
}
