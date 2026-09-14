"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  saveBiometricReadings,
  getRecentBiometrics,
  getLatestMeasuredAt,
  type BiometricRecord,
} from "@/lib/biometrics";
import HealthConnect from "@/lib/nativeHealthConnect";
import HeartRateChart from "@/components/HeartRateChart";

const HEALTH_CONNECT_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata";

export default function BiometricsPage() {
  const router = useRouter();
  const [isAndroid, setIsAndroid] = useState(false);
  const [readings, setReadings] = useState<BiometricRecord[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAndroid(Capacitor.getPlatform() === "android");
  }, []);

  useEffect(() => {
    getRecentBiometrics()
      .then(setReadings)
      .catch(() => setMessage("불러오지 못했어요."));
  }, []);

  async function handleSync() {
    setMessage("");
    setAnalysis("");
    setSyncing(true);
    try {
      const { available } = await HealthConnect.isAvailable();
      if (!available) {
        setMessage("Health Connect 설치가 필요해요.");
        return;
      }

      const { granted } = await HealthConnect.requestPermissions();
      if (!granted) {
        setMessage("Health Connect 권한이 필요해요.");
        return;
      }

      const since = await getLatestMeasuredAt();
      const { samples } = await HealthConnect.readRecentHeartRate({ since });
      await saveBiometricReadings(
        samples.map((s) => ({ measuredAt: s.measuredAt, heartRate: s.heartRate }))
      );

      const updated = await getRecentBiometrics();
      setReadings(updated);
      if (samples.length === 0) {
        setMessage("아직 Samsung Health에 새로 동기화된 측정값이 없어요.");
      }
    } catch {
      setMessage("동기화에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAnalyze() {
    if (!readings || readings.length === 0) return;
    setAnalyzing(true);
    setAnalysis("");
    setMessage("");
    try {
      const res = await fetch("/api/biometrics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readings: readings.map((r) => ({
            measuredAt: r.measuredAt,
            heartRate: r.heartRate,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석 실패");
      setAnalysis(data.analysis);
    } catch {
      setMessage("분석에 실패했어요. 다시 시도해주세요.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header
        className="flex shrink-0 items-center gap-1 px-3 pb-4"
        style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => router.push("/main")}
          aria-label="메인으로 돌아가기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:bg-tint active:bg-tint"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h1 className="text-xl font-bold tracking-tight text-ink">워치 데이터</h1>
      </header>

      <div
        className="flex flex-1 flex-col overflow-y-auto px-5 pb-6"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleSync}
          disabled={syncing || !isAndroid}
          className="mb-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-deep active:scale-[0.98] disabled:opacity-60"
        >
          {syncing ? "동기화 중…" : "Samsung Health에서 동기화"}
        </button>

        {!isAndroid && (
          <p className="mb-4 text-sm text-sub">
            📱 실시간 동기화는 안드로이드 앱에서만 가능해요 — 여기선 지난 기록만 볼 수 있어요.
          </p>
        )}

        {message && (
          <p className="mb-4 text-sm text-sub" role="status">
            {message}{" "}
            {message.includes("설치") && (
              <a
                href={HEALTH_CONNECT_PLAY_STORE_URL}
                className="font-medium text-accent underline"
              >
                Play 스토어에서 설치
              </a>
            )}
          </p>
        )}

        {readings === null && (
          <p className="pt-10 text-center text-sm text-sub">불러오는 중…</p>
        )}

        {readings !== null && readings.length === 0 && (
          <div className="mt-6 rounded-card border border-dashed border-line px-4 py-8 text-center">
            <p className="text-sm text-sub">
              아직 측정된 심박수가 없어요. Samsung Health에서 측정해보세요.
            </p>
          </div>
        )}

        {readings !== null && readings.length > 0 && (
          <>
            <HeartRateChart readings={readings} />

            <ul className="flex flex-col gap-2">
              {readings.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-card border border-line bg-surface px-4 py-3"
                >
                  <span className="text-sm text-ink">
                    {new Date(r.measuredAt).toLocaleString("ko-KR")}
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    {r.heartRate} bpm
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="mt-5 rounded-full border border-accent px-4 py-2.5 text-sm font-semibold text-accent transition hover:bg-tint active:scale-[0.98] disabled:opacity-60"
            >
              {analyzing ? "분석 중…" : "AI 분석하기"}
            </button>

            {analysis && (
              <div className="mt-4 rounded-card bg-surface p-4 shadow-card">
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink">
                  {analysis}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
