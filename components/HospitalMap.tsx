"use client";

import { useEffect, useRef, useState } from "react";
import type { Hospital } from "@/lib/hospitals";

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
        Map: new (container: HTMLElement, options: Record<string, unknown>) => unknown;
        Marker: new (options: Record<string, unknown>) => unknown;
        InfoWindow: new (options: Record<string, unknown>) => {
          open: (map: unknown, marker: unknown) => void;
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

const USER_MARKER_SVG =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="#3b82f6" stroke="white" stroke-width="2"/></svg>'
  );

type Status = "locating" | "loading" | "ready" | "error";

const GEOLOCATION_SUPPORTED =
  typeof navigator !== "undefined" && "geolocation" in navigator;

export function HospitalMap({ department }: { department: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(
    GEOLOCATION_SUPPORTED ? "locating" : "error"
  );
  const [error, setError] = useState(
    GEOLOCATION_SUPPORTED ? "" : "이 브라우저에서는 위치 정보를 사용할 수 없어요."
  );
  const [resultCount, setResultCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!GEOLOCATION_SUPPORTED) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        setStatus("loading");

        try {
          const { latitude, longitude } = position.coords;
          const [, hospitalsRes] = await Promise.all([
            loadKakaoMapsScript(
              process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY ?? ""
            ),
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
          renderMap(latitude, longitude, hospitals);
          setResultCount(hospitals.length);
          setStatus("ready");
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "오류가 발생했어요.");
          setStatus("error");
        }
      },
      () => {
        if (cancelled) return;
        setStatus("error");
        setError("위치 권한이 필요해요. 브라우저 설정에서 위치 접근을 허용해주세요.");
      }
    );

    function renderMap(lat: number, lng: number, hospitals: Hospital[]) {
      const { kakao } = window;
      if (!kakao?.maps || !mapContainerRef.current) return;

      const center = new kakao.maps.LatLng(lat, lng);
      const map = new kakao.maps.Map(mapContainerRef.current, {
        center,
        level: 5,
      });

      new kakao.maps.Marker({
        position: center,
        map,
        image: new kakao.maps.MarkerImage(
          USER_MARKER_SVG,
          new kakao.maps.Size(16, 16)
        ),
      });

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
          infoWindow.open(map, marker);
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [department]);

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
        <p className="p-6 text-center text-sm text-danger" role="alert">
          {error}
        </p>
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
    </div>
  );
}
