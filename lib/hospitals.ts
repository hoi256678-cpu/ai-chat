export type Hospital = {
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  phone: string;
  lat: number;
  lng: number;
  distanceMeters: number | null;
};

const SEARCH_RADIUS_METERS = 5000;

// Kakao Local keyword search natively supports x/y/radius/sort=distance, so
// unlike the old Naver setup this needs no separate reverse-geocoding step.
export async function searchNearbyHospitals(
  department: string,
  lat: number,
  lng: number
) {
  const restApiKey = process.env.KAKAO_REST_API_KEY;
  if (!restApiKey) {
    throw new Error(
      "카카오 API 키가 설정되지 않았어요. .env.local 파일을 확인해주세요."
    );
  }

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", department);
  url.searchParams.set("x", String(lng));
  url.searchParams.set("y", String(lat));
  url.searchParams.set("radius", String(SEARCH_RADIUS_METERS));
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", "15");

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${restApiKey}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`카카오 로컬 API 오류 (${res.status}):`, errorBody);
    throw new Error("병원 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.");
  }

  const data = await res.json();
  const documents: unknown[] = Array.isArray(data.documents) ? data.documents : [];

  return documents.map((doc) => {
    const raw = doc as Record<string, string>;
    return {
      name: raw.place_name ?? "",
      category: raw.category_name ?? "",
      address: raw.address_name ?? "",
      roadAddress: raw.road_address_name ?? "",
      phone: raw.phone ?? "",
      lat: Number(raw.y),
      lng: Number(raw.x),
      distanceMeters: raw.distance ? Number(raw.distance) : null,
    } satisfies Hospital;
  });
}
