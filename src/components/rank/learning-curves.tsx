"use client";

import { useState } from "react";
import type { DailyPracticeBar, SessionCurvePoint } from "@/lib/music/learning-analytics";

interface LearningCurvesProps {
  sessionCurve: SessionCurvePoint[];
  dailyBars14: DailyPracticeBar[];
  locale: "zh" | "en";
}

export function LearningCurves({ sessionCurve, dailyBars14, locale }: LearningCurvesProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const w = 640;
  const h = 210;
  const padL = 36;
  const padR = 16;
  const padT = 18;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const activePointIndex =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < sessionCurve.length
      ? selectedIdx
      : sessionCurve.length > 0
        ? sessionCurve.length - 1
        : null;
  const activePoint = activePointIndex !== null ? sessionCurve[activePointIndex] : null;

  const accPoints = sessionCurve.map((pt, i) => {
    const x =
      sessionCurve.length === 1
        ? padL + plotW / 2
        : padL + (i / Math.max(1, sessionCurve.length - 1)) * plotW;
    const y = padT + (1 - Math.max(0, Math.min(100, pt.accuracy)) / 100) * plotH;
    const yMa = padT + (1 - Math.max(0, Math.min(100, pt.movingAvgAcc)) / 100) * plotH;
    return { ...pt, x, y, yMa };
  });

  const maxXp = Math.max(100, ...sessionCurve.map((p) => p.cumulativeXp));
  const xpPoints = sessionCurve.map((pt, i) => {
    const x =
      sessionCurve.length === 1
        ? padL + plotW / 2
        : padL + (i / Math.max(1, sessionCurve.length - 1)) * plotW;
    const y = 14 + (1 - Math.max(0, pt.cumulativeXp) / maxXp) * 82;
    return { ...pt, x, y };
  });

  const accLine = accPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const maLine = accPoints.map((p) => `${p.x.toFixed(1)},${p.yMa.toFixed(1)}`).join(" ");
  const accArea =
    accPoints.length >= 2
      ? `M ${accPoints[0].x.toFixed(1)},${(padT + plotH).toFixed(1)} L ${accPoints
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" L ")} L ${accPoints[accPoints.length - 1].x.toFixed(1)},${(padT + plotH).toFixed(1)} Z`
      : "";

  const xpLine = xpPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const xpArea =
    xpPoints.length >= 2
      ? `M ${xpPoints[0].x.toFixed(1)},96 L ${xpPoints
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" L ")} L ${xpPoints[xpPoints.length - 1].x.toFixed(1)},96 Z`
      : "";

  const maxDailyXp = Math.max(80, ...dailyBars14.map((d) => d.xp));
  const selectedDay =
    dailyBars14.find((d) => d.dateKey === selectedDayKey) ??
    [...dailyBars14].reverse().find((d) => d.sessions > 0) ??
    dailyBars14[dailyBars14.length - 1];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Chart 1: Accuracy Trajectory + 3-Run Moving Average */}
      <div className="terminal-box p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1d1d1d] pb-2">
          <div>
            <div className="text-xs font-bold tracking-wider text-[#00ff88]">
              {locale === "zh" ? "01 // 准确率成长曲线与移动平均趋势" : "01 // ACCURACY CURVE & MOVING AVG"}
            </div>
            <div className="text-[10px] text-[#666]">
              {locale === "zh"
                ? "绿线=单局准确率 · 橙虚线=3局滑动均线 (消除曲目难度波动)"
                : "Green = Run Accuracy · Orange Dash = 3-Run Moving Avg"}
            </div>
          </div>
          {activePoint && (
            <span className="border border-[#00ff88]/40 bg-[#081910] px-2 py-0.5 text-[10px] text-[#00ff88]">
              #{activePoint.index} · {activePoint.accuracy}% (MA {activePoint.movingAvgAcc}%)
            </span>
          )}
        </div>

        {sessionCurve.length === 0 ? (
          <div className="flex h-44 items-center justify-center border border-[#181818] bg-[#060606] text-xs text-[#555]">
            {locale === "zh"
              ? "完成任意 1 局街机或道场训练后自动绘制学习曲线"
              : "Finish your 1st run in Arcade or Drills to plot curve"}
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible bg-[#060606] border border-[#191919]">
              <defs>
                <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00ff88" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#00ff88" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {[0, 25, 50, 75, 85, 100].map((pct) => {
                const gy = padT + (1 - pct / 100) * plotH;
                const isTarget = pct === 85;
                return (
                  <g key={pct}>
                    <line
                      x1={padL}
                      x2={w - padR}
                      y1={gy}
                      y2={gy}
                      stroke={isTarget ? "#a855f7" : "#1c1c1c"}
                      strokeDasharray={isTarget ? "4 4" : undefined}
                      strokeWidth={1}
                    />
                    <text
                      x={padL - 5}
                      y={gy + 3}
                      textAnchor="end"
                      fill={isTarget ? "#a855f7" : "#555"}
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {accArea && <path d={accArea} fill="url(#accGrad)" />}

              {accPoints.length >= 2 && (
                <>
                  <polyline
                    fill="none"
                    stroke="#00ff88"
                    strokeWidth="2.2"
                    points={accLine}
                  />
                  <polyline
                    fill="none"
                    stroke="#ff6a00"
                    strokeWidth="1.8"
                    strokeDasharray="5 3"
                    points={maLine}
                  />
                </>
              )}

              {accPoints.map((pt, i) => {
                const isSel = activePointIndex === i;
                return (
                  <g key={pt.id}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSel ? 5.5 : 3.5}
                      fill={isSel ? "#ff6a00" : "#00ff88"}
                      stroke="#0a0a0a"
                      strokeWidth="1.5"
                      className="cursor-pointer"
                      onClick={() => setSelectedIdx(i)}
                      onMouseEnter={() => setSelectedIdx(i)}
                    />
                    {(i === 0 || i === accPoints.length - 1 || accPoints.length <= 8 || i % 3 === 0) && (
                      <text
                        x={pt.x}
                        y={h - 8}
                        textAnchor="middle"
                        fill="#666"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        #{pt.index}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {activePoint && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border border-[#1b1b1b] bg-[#080808] px-2.5 py-1.5 text-[10px]">
                <span className="truncate font-bold text-[#e0e0e0]">
                  #{activePoint.index} [{activePoint.rank}] {activePoint.songTitle}
                </span>
                <span className="text-[#00d4ff]">
                  PERFECT: {activePoint.perfectRate}% · +{activePoint.xpEarned} XP
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Chart 2: Cumulative XP Curve + 14-Day Habit Heatmap */}
      <div className="terminal-box p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-[#1d1d1d] pb-2">
          <div>
            <div className="text-xs font-bold tracking-wider text-[#00d4ff]">
              {locale === "zh" ? "02 // 经验成长曲线 & 14天练琴热力柱" : "02 // XP GROWTH CURVE & 14-DAY STREAK"}
            </div>
            <div className="text-[10px] text-[#666]">
              {locale === "zh"
                ? "蓝线=累计经验爬坡 · 底部柱条=近14日每日练琴强度"
                : "Cyan Line = Cumulative XP · Bottom Bars = 14-Day Intensity"}
            </div>
          </div>
          {selectedDay && (
            <span className="border border-[#00d4ff]/40 bg-[#071820] px-2 py-0.5 text-[10px] text-[#00d4ff]">
              {selectedDay.shortLabel}: {selectedDay.sessions} runs · {selectedDay.xp} XP
            </span>
          )}
        </div>

        {/* Cumulative XP Polyline */}
        {xpPoints.length === 0 ? (
          <div className="flex h-24 items-center justify-center border border-[#181818] bg-[#060606] text-xs text-[#555]">
            {locale === "zh" ? "尚无累计经验轨迹" : "No XP trajectory yet"}
          </div>
        ) : (
          <svg viewBox={`0 0 ${w} 118`} className="w-full border border-[#191919] bg-[#060606]">
            <defs>
              <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#00d4ff" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {xpPoints.map((p, idx) => (
              <circle
                key={`xp-${p.id}`}
                cx={p.x}
                cy={p.y}
                r={activePointIndex === idx ? 4.5 : 2.8}
                fill={activePointIndex === idx ? "#ff6a00" : "#00d4ff"}
              />
            ))}
            {xpPoints.length >= 2 && (
              <>
                <path d={xpArea} fill="url(#xpGrad)" />
                <polyline fill="none" stroke="#00d4ff" strokeWidth="2" points={xpLine} />
              </>
            )}
            <text x={8} y={14} fill="#555" fontSize="9" fontFamily="monospace">
              {maxXp} XP
            </text>
            <text x={8} y={108} fill="#555" fontSize="9" fontFamily="monospace">
              0 XP
            </text>
          </svg>
        )}

        {/* 14-Day Daily Consistency Bar Matrix */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] text-[#666]">
            <span>{locale === "zh" ? "14天每日练琴出勤强度" : "14-DAY CONSISTENCY"}</span>
            <span>{dailyBars14.filter((d) => d.sessions > 0).length} / 14 DAYS ACTIVE</span>
          </div>
          <div
            className="grid gap-1 border border-[#191919] bg-[#060606] p-2"
            style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}
          >
            {dailyBars14.map((bar) => {
              const barPct = bar.xp > 0 ? Math.max(16, Math.round((bar.xp / maxDailyXp) * 100)) : 6;
              const isSelected = selectedDay?.dateKey === bar.dateKey;
              return (
                <button
                  key={bar.dateKey}
                  type="button"
                  onClick={() => setSelectedDayKey(bar.dateKey)}
                  onMouseEnter={() => setSelectedDayKey(bar.dateKey)}
                  className="flex flex-col items-center gap-1 focus:outline-none"
                  title={`${bar.dateKey}: ${bar.sessions} runs, ${bar.xp} XP`}
                >
                  <div className="flex h-14 w-full items-end bg-[#0d0d0d]">
                    <div
                      className={`w-full transition-all ${
                        bar.sessions === 0
                          ? "bg-[#1d1d1d]"
                          : isSelected
                            ? "bg-[#ff6a00]"
                            : "bg-[#00ff88]"
                      }`}
                      style={{ height: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-[#666]">{bar.shortLabel.split("/")[1]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
