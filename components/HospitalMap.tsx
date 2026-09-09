"use client";

import { useEffect, useRef, useState } from "react";
import type { Hospital } from "@/lib/hospitals";

type KakaoMap = {
  setCenter: (position: unknown) => void;
  panTo: (position: unknown) => void;
};

declare global {
  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void;
        LatLng: new (lat: number, lng: number) => unknown;
        Size: new (width: number, height: number) => unknown;
        MarkerImage: new (
          src: string,
          size: unknown,
          options?: Record<string, unknown>
        ) => unknown;
        Map: new (container: HTMLElement, options: Record<string, unknown>) => KakaoMap;
        Marker: new (options: Record<string, unknown>) => unknown;
        InfoWindow: new (options: Record<string, unknown>) => {
          open: (map: unknown, marker: unknown) => void;
          close: () => void;
        };
        CustomOverlay: new (options: Record<string, unknown>) => {
          setMap: (map: unknown) => void;
        };
        event: { addListener: (target: unknown, name: string, handler: () => void) => void };
      };
    };
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadKakaoMapsScript(appKey: string) {
  if (window.kakao?.maps) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao!.maps.load(() => resolve());
    script.onerror = () => reject(new Error("지도를 불러오지 못했어요."));
    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

function formatDistance(meters: number) {
  return meters < 1000
    ? `${meters}m`
    : `${(meters / 1000).toFixed(1)}km`;
}

const USER_MARKER_SVG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#3b82f6" stroke="white" stroke-width="2"/></svg>'
  );

type Status = "locating" | "loading" | "ready" | "error";

const GEOLOCATION_SUPPORTED =
  typeof navigator !== "undefined" && "geolocation" in navigator;

function hospitalKey(hospital: Hospital) {
  return `${hospital.name}-${hospital.address}`;
}

export function HospitalMap({ department }: { department: string }) {
  const [retryCount, setRetryCount] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMap | null>(null);
  const markerEntriesRef = useRef<
    Map<
      string,
      {
        position: unknown;
        marker: unknown;
        infoWindow: { open: (map: unknown, marker: unknown) => void; close: () => void };
      }
    >
  >(new Map());
  const openInfoWindowRef = useRef<{ close: () => void } | null>(null);
  const [status, setStatus] = useState<Status>(
    GEOLOCATION_SUPPORTED ? "locating" : "error"
  );
  const [error, setError] = useState(
    GEOLOCATION_SUPPORTED ? "" : "이 브라우저에서는 위치 정보를 사용할 수 없어요."
  );
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [mapData, setMapData] = useState<{
    lat: number;
    lng: number;
    hospitals: Hospital[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!GEOLOCATION_SUPPORTED) {
      return;
    }

    // Kick the SDK download off immediately instead of waiting on
    // geolocation first — the script doesn't need the user's coordinates,
    // only the map-rendering effect below does, so this overlaps two slow
    // operations instead of paying for them back-to-back.
    const scriptPromise = loadKakaoMapsScript(
      process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? ""
    );

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        setStatus("loading");

        try {
          const { latitude, longitude } = position.coords;
          const [, hospitalsRes] = await Promise.all([
            scriptPromise,
            fetch("/api/hospitals", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lat: latitude, lng: longitude, department }),
            }),
          ]);

          const data = await hospitalsRes.json();
          if (!hospitalsRes.ok) {
            throw new Error(data.error ?? "병원 정보를 가져오지 못했어요.");
          }
          if (cancelled) return;

          const hospitals: Hospital[] = data.hospitals ?? [];
          setResultCount(hospitals.length);
          // Defer map creation to the effect below, which only runs once
          // this "ready" status has actually reached the DOM and the
          // container div has swapped out of `hidden`. Kakao's Map()
          // reads the container's layout size at construction time, so
          // building it one tick early (while the div is still
          // display:none) leaves the map visually broken until the user
          // interacts with it.
          setMapData({ lat: latitude, lng: longitude, hospitals });
          setStatus("ready");
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "오류가 발생했어요.");
          setStatus("error");
        }
      },
      (positionError) => {
        if (cancelled) return;
        setStatus("error");
        setError(
          positionError.code === positionError.TIMEOUT
            ? "위치를 확인하는 데 시간이 너무 오래 걸려요. 다시 시도해주세요."
            : "위치 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해주세요."
        );
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10000 }
    );

    return () => {
      cancelled = true;
    };
  }, [department, retryCount]);

  function handleRetry() {
    setStatus(GEOLOCATION_SUPPORTED ? "locating" : "error");
    setError(GEOLOCATION_SUPPORTED ? "" : "이 브라우저에서는 위치 정보를 사용할 수 없어요.");
    setRetryCount((count) => count + 1);
  }

  useEffect(() => {
    if (!mapData || !mapContainerRef.current) return;

    const { kakao } = window;
    if (!kakao?.maps) return;

    const { lat, lng, hospitals } = mapData;
    const center = new kakao.maps.LatLng(lat, lng);
    const map = new kakao.maps.Map(mapContainerRef.current, {
      center,
      level: 5,
    });
    mapInstanceRef.current = map;

    new kakao.maps.Marker({
      position: center,
      map,
      image: new kakao.maps.MarkerImage(
        USER_MARKER_SVG,
        new kakao.maps.Size(16, 16)
      ),
    });

    new kakao.maps.CustomOverlay({
      position: center,
      map,
      yAnchor: 2.2,
      content:
        '<div style="padding:2px 8px;border-radius:9999px;background:#3b82f6;color:white;font-size:11px;font-weight:600;white-space:nowrap;">내 위치</div>',
    });

    const entries = new Map<
      string,
      {
        position: unknown;
        marker: unknown;
        infoWindow: { open: (map: unknown, marker: unknown) => void; close: () => void };
      }
    >();

    hospitals.forEach((hospital) => {
      const position = new kakao.maps.LatLng(hospital.lat, hospital.lng);
      const marker = new kakao.maps.Marker({ position, map });
      const infoWindow = new kakao.maps.InfoWindow({
        content: `
          <div style="padding:10px 12px;min-width:160px;font-size:13px;line-height:1.5;">
            <strong>${hospital.name}</strong><br/>
            <span style="color:#666;">${hospital.roadAddress || hospital.address}</span>
            ${hospital.phone ? `<br/><span style="color:#666;">${hospital.phone}</span>` : ""}
          </div>
        `,
      });
      kakao.maps.event.addListener(marker, "click", () => {
        openInfoWindowRef.current?.close();
        infoWindow.open(map, marker);
        openInfoWindowRef.current = infoWindow;
      });
      entries.set(hospitalKey(hospital), { position, marker, infoWindow });
    });

    markerEntriesRef.current = entries;
  }, [mapData]);

  function focusHospital(hospital: Hospital) {
    const map = mapInstanceRef.current;
    const entry = markerEntriesRef.current.get(hospitalKey(hospital));
    if (!map || !entry) return;

    map.panTo(entry.position);
    openInfoWindowRef.current?.close();
    entry.infoWindow.open(map, entry.marker);
    openInfoWindowRef.current = entry.infoWindow;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
      {(status === "locating" || status === "loading") && (
        <div className="flex flex-col items-center gap-2 p-6 text-sm text-sub">
          <div className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-tint">
            <div className="loading-bar-fill h-full w-1/3 rounded-full bg-accent" />
          </div>
          {status === "locating" ? "현재 위치를 확인하고 있어요…" : "주변 병원을 찾고 있어요…"}
        </div>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          <button
            onClick={handleRetry}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-deep"
          >
            다시 시도
          </button>
        </div>
      )}

      <div
        ref={mapContainerRef}
        className={status === "ready" ? "h-72 w-full" : "hidden"}
      />

      {status === "ready" && (
        <p className="border-t border-line px-4 py-2 text-xs text-sub">
          {resultCount && resultCount > 0
            ? `반경 5km 이내 ${resultCount}곳을 찾았어요.`
            : "반경 5km 이내에서 결과를 찾지 못했어요."}
        </p>
      )}

      {status === "ready" && mapData && mapData.hospitals.length > 0 && (
        <ul className="max-h-64 divide-y divide-line overflow-y-auto border-t border-line">
          {[...mapData.hospitals]
            .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
            .map((hospital) => (
              <li key={hospitalKey(hospital)}>
                <button
                  onClick={() => focusHospital(hospital)}
                  className="w-full px-4 py-3 text-left transition hover:bg-tint"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {hospital.name}
                    </span>
                    {hospital.distanceMeters != null && (
                      <span className="shrink-0 text-xs text-sub">
                        {formatDistance(hospital.distanceMeters)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-sub">
                    {hospital.roadAddress || hospital.address}
                  </p>
                  {hospital.phone && (
                    <p className="mt-0.5 text-xs text-sub">{hospital.phone}</p>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
