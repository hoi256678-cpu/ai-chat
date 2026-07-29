import { createClient } from "@/lib/supabase/client";
import type { SymptomInput, SymptomResult } from "@/lib/symptomCheck";

export type SymptomCheckRecord = SymptomInput &
  SymptomResult & {
    id: string;
    createdAt: string;
  };

export async function saveSymptomCheck(
  input: SymptomInput,
  result: SymptomResult
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
  });

  if (error) throw error;
}

export async function getSymptomChecks(): Promise<SymptomCheckRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("symptom_checks")
    .select(
      "id,body_part,symptoms,duration,severity,note,conditions,departments,summary,disclaimer,home_care,foods,created_at"
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
    createdAt: row.created_at,
  }));
}
