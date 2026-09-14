import { createClient } from "@/lib/supabase/client";
import type { SymptomInput, SymptomResult } from "@/lib/symptomCheck";

export type SymptomCheckRecord = SymptomInput &
  SymptomResult & {
    id: string;
    createdAt: string;
    // Only present for a 피부 check where the user attached a photo —
    // same base64 data URL shape as SymptomInput never carries elsewhere.
    photo: string | null;
  };

export async function saveSymptomCheck(
  input: SymptomInput,
  result: SymptomResult,
  photo?: string | null
) {
  const supabase = createClient();
  const { error } = await supabase.from("symptom_checks").insert({
    body_part: input.bodyPart,
    symptoms: input.symptoms,
    duration: input.duration,
    severity: input.severity,
    note: input.note,
    conditions: result.conditions,
    departments: result.departments,
    summary: result.summary,
    disclaimer: result.disclaimer,
    home_care: result.homeCare,
    foods: result.foods,
    photo: photo ?? null,
  });

  if (error) throw error;
}

export async function getSymptomChecks(): Promise<SymptomCheckRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("symptom_checks")
    .select(
      "id,body_part,symptoms,duration,severity,note,conditions,departments,summary,disclaimer,home_care,foods,photo,created_at"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    bodyPart: row.body_part,
    symptoms: row.symptoms,
    duration: row.duration,
    severity: row.severity,
    note: row.note,
    conditions: row.conditions,
    departments: row.departments,
    summary: row.summary,
    disclaimer: row.disclaimer,
    homeCare: row.home_care ?? [],
    foods: row.foods ?? [],
    photo: row.photo ?? null,
    createdAt: row.created_at,
  }));
}

function formatCheckDate(createdAt: string) {
  const d = new Date(createdAt);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function buildSymptomHistoryContext(
  records: SymptomCheckRecord[]
): string | undefined {
  if (records.length === 0) return undefined;

  const lines = records.slice(0, 3).map((r) => {
    const symptoms = r.symptoms.join(", ");
    return `- ${formatCheckDate(r.createdAt)}: ${r.bodyPart} 부위, 증상(${symptoms}). AI 요약: ${r.summary}`;
  });

  return `사용자의 최근 증상체크 기록이에요:\n${lines.join("\n")}\n대화 중 관련 있으면 자연스럽게 후속 질문을 해도 좋아요. 매번 언급할 필요는 없어요.`;
}
