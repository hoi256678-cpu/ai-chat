import { createClient } from "@/lib/supabase/client";
import { formatDateKey } from "@/lib/chatHistory";

export type MedicationInput = {
  name: string;
  times: string[];
  startDate: string;
  endDate: string;
  photo?: string | null;
  precautions?: string | null;
};

export type MedicationRecord = Omit<MedicationInput, "photo"> & {
  id: string;
  createdAt: string;
  precautions: string | null;
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
    precautions: input.precautions ?? null,
  });

  if (error) throw error;
}

export async function getMedications(): Promise<MedicationRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("medications")
    .select("id,name,times,start_date,end_date,created_at,precautions")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    times: row.times,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    precautions: row.precautions ?? null,
  }));
}

export async function deleteMedication(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("medications").delete().eq("id", id);

  if (error) throw error;
}

export async function updateMedicationTimes(id: string, times: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medications")
    .update({ times })
    .eq("id", id);

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

export async function unlogDose(
  medicationId: string,
  dateKey: string,
  time: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("medication_logs")
    .delete()
    .eq("medication_id", medicationId)
    .eq("date_key", dateKey)
    .eq("time", time);

  if (error) throw error;
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

// 시작시간부터 24시간을 간격(시간 단위)으로 나눠 하루치 복용 시간을 생성한다.
// 예: ("08:00", 4) -> ["00:00","04:00","08:00","12:00","16:00","20:00"] (자정 넘어가는 시간 포함)
export function generateIntervalTimes(
  startTime: string,
  intervalHours: number
): string[] {
  if (!intervalHours || intervalHours <= 0 || intervalHours > 24) return [];
  const [hours, minutes] = startTime.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return [];

  const startMinutes = hours * 60 + minutes;
  const stepMinutes = Math.round(intervalHours * 60);
  const dayMinutes = 24 * 60;
  const times = new Set<string>();

  for (let t = startMinutes; t < startMinutes + dayMinutes; t += stepMinutes) {
    const mins = ((t % dayMinutes) + dayMinutes) % dayMinutes;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    times.add(`${hh}:${mm}`);
  }

  return Array.from(times).sort();
}

export type DoseSlot = {
  medicationId: string;
  name: string;
  time: string;
  taken: boolean;
};

export function computeDoseSlots(
  medications: MedicationRecord[],
  logs: MedicationLogRecord[],
  today: string
): DoseSlot[] {
  const active = medications.filter(
    (m) => m.startDate <= today && today <= m.endDate
  );

  return active
    .flatMap((m) =>
      m.times.map((time) => ({
        medicationId: m.id,
        name: m.name,
        time,
        taken: logs.some(
          (l) => l.medicationId === m.id && l.time === time && l.dateKey === today
        ),
      }))
    )
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function getDueSlots(): Promise<DoseSlot[]> {
  const today = formatDateKey(new Date());
  const [medications, logs] = await Promise.all([
    getMedications(),
    getDoseLogs(today),
  ]);
  const nowHHMM = new Date().toTimeString().slice(0, 5);

  return computeDoseSlots(medications, logs, today).filter(
    (slot) => !slot.taken && slot.time <= nowHHMM
  );
}

export async function getDueCount(): Promise<number> {
  return (await getDueSlots()).length;
}

export function buildMedicationContext(
  medications: MedicationRecord[],
  todaySlots: DoseSlot[],
  today: string
): string | undefined {
  const active = medications.filter(
    (m) => m.startDate <= today && today <= m.endDate
  );
  if (active.length === 0) return undefined;

  const names = active.map((m) => m.name).join(", ");
  if (todaySlots.length === 0) {
    return `사용자가 복용 중인 약: ${names}. 오늘은 예정된 복용 시간이 없어요.`;
  }

  const taken = todaySlots.filter((s) => s.taken).length;
  const total = todaySlots.length;
  const missed = todaySlots
    .filter((s) => !s.taken)
    .map((s) => `${s.name}(${s.time})`)
    .join(", ");

  const status =
    taken === total
      ? "오늘 예정된 약은 모두 챙겨 드셨어요."
      : `오늘 ${total}회 중 ${taken}회 복용했고, 아직 안 드신 건: ${missed}.`;

  return `사용자가 복용 중인 약: ${names}. ${status} 대화 흐름이 자연스러울 때만 부담스럽지 않게 언급해주세요.`;
}
