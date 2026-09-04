import { createClient } from "@/lib/supabase/client";

export type MedicationInput = {
  name: string;
  times: string[];
  startDate: string;
  endDate: string;
  photo?: string | null;
};

export type MedicationRecord = MedicationInput & {
  id: string;
  createdAt: string;
};

export type MedicationLogRecord = {
  id: string;
  medicationId: string;
  dateKey: string;
  time: string;
  takenAt: string;
};

export async function saveMedication(input: MedicationInput): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medications").insert({
    name: input.name,
    times: input.times,
    start_date: input.startDate,
    end_date: input.endDate,
    photo: input.photo ?? null,
  });

  if (error) throw error;
}

export async function getMedications(): Promise<MedicationRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("id,name,times,start_date,end_date,photo,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    times: row.times,
    startDate: row.start_date,
    endDate: row.end_date,
    photo: row.photo ?? null,
    createdAt: row.created_at,
  }));
}

export async function deleteMedication(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medications").delete().eq("id", id);

  if (error) throw error;
}

export async function logDose(
  medicationId: string,
  dateKey: string,
  time: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medication_logs").insert({
    medication_id: medicationId,
    date_key: dateKey,
    time,
  });

  // 23505 = unique_violation — 이미 체크된 슬롯을 다시 누른 것뿐이므로 성공 처리
  if (error && error.code !== "23505") throw error;
}

export async function getDoseLogs(dateKey: string): Promise<MedicationLogRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medication_logs")
    .select("id,medication_id,date_key,time,taken_at")
    .eq("date_key", dateKey);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    medicationId: row.medication_id,
    dateKey: row.date_key,
    time: row.time,
    takenAt: row.taken_at,
  }));
}
