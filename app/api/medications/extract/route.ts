import { extractMedicineNames } from "@/lib/gemini";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const photo: string | undefined =
    typeof body?.photo === "string" && body.photo.startsWith("data:image/")
      ? body.photo
      : undefined;

  if (!photo) {
    return Response.json({ error: "사진이 필요해요." }, { status: 400 });
  }

  try {
    const names = await extractMedicineNames(photo);
    return Response.json({ names });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
