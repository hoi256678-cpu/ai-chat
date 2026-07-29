import { searchNearbyHospitals } from "@/lib/hospitals";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const department = typeof body?.department === "string" ? body.department : "";

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !department) {
    return Response.json(
      { error: "위치 정보와 진료과를 확인해주세요." },
      { status: 400 }
    );
  }

  try {
    const hospitals = await searchNearbyHospitals(department, lat, lng);
    return Response.json({ hospitals });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    return Response.json({ error: message }, { status: 500 });
  }
}
