"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import type { BiometricRecord } from "@/lib/biometrics";

/**
 * ViewBox is a fixed coordinate space; preserveAspectRatio="none" lets the
 * rendered element stretch to any container width without letterboxing —
 * x (time) and y (bpm) are independent units anyway, so non-uniform scaling
 * doesn't distort what the chart means.
 */
const WIDTH = 320;
const HEIGHT = 140;
const PADDING = { top: 16, right: 12, bottom: 10, left: 30 };
const INNER_WIDTH = WIDTH - PADDING.left - PADDING.right;
const INNER_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

export default function HeartRateChart({
  readings,
}: {
  readings: BiometricRecord[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const sorted = [...readings].sort(
      (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime()
    );
    const times = sorted.map((r) => new Date(r.measuredAt).getTime());
    const values = sorted.map((r) => r.heartRate);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const valuePadding = Math.max(4, (maxV - minV) * 0.15);
    const yMin = minV - valuePadding;
    const yMax = maxV + valuePadding;

    const points = sorted.map((r, i) => {
      const x =
        PADDING.left +
        (maxT === minT ? INNER_WIDTH / 2 : ((times[i] - minT) / (maxT - minT)) * INNER_WIDTH);
      const y =
        PADDING.top + INNER_HEIGHT - ((r.heartRate - yMin) / (yMax - yMin)) * INNER_HEIGHT;
      return { x, y, reading: r };
    });

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");
    const baseline = PADDING.top + INNER_HEIGHT;
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;

    return { points, linePath, areaPath, yMin, yMax };
  }, [readings]);

  if (readings.length < 2) return null;

  const { points, linePath, areaPath, yMin, yMax } = chart;
  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDistance = Infinity;
    points.forEach((p, i) => {
      const distance = Math.abs(p.x - x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div className="relative mb-4 rounded-card bg-surface p-3 shadow-card">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        aria-hidden
      >
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top}
          y2={PADDING.top}
          className="stroke-line"
          strokeWidth={1}
        />
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={PADDING.top + INNER_HEIGHT}
          y2={PADDING.top + INNER_HEIGHT}
          className="stroke-line"
          strokeWidth={1}
        />
        <text x={2} y={PADDING.top + 3} className="fill-sub text-[9px]">
          {Math.round(yMax)}
        </text>
        <text x={2} y={PADDING.top + INNER_HEIGHT + 3} className="fill-sub text-[9px]">
          {Math.round(yMin)}
        </text>

        <path d={areaPath} className="fill-accent/10" stroke="none" />
        <path
          d={linePath}
          fill="none"
          className="stroke-accent"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx={last.x} cy={last.y} r={4} className="fill-accent stroke-surface" strokeWidth={2} />
        <text
          x={Math.min(last.x + 6, WIDTH - PADDING.right - 20)}
          y={Math.max(last.y - 6, PADDING.top + 8)}
          className="fill-ink text-[10px] font-semibold"
        >
          {last.reading.heartRate}
        </text>

        {hovered && (
          <>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={PADDING.top}
              y2={PADDING.top + INNER_HEIGHT}
              className="stroke-line"
              strokeWidth={1}
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={4}
              className="fill-accent stroke-surface"
              strokeWidth={2}
            />
          </>
        )}

        <rect
          x={PADDING.left}
          y={0}
          width={INNER_WIDTH}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white shadow-card"
          style={{ left: `${(hovered.x / WIDTH) * 100}%` }}
        >
          <span className="font-semibold">{hovered.reading.heartRate} bpm</span>{" "}
          <span className="opacity-80">
            {new Date(hovered.reading.measuredAt).toLocaleString("ko-KR", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}
    </div>
  );
}
