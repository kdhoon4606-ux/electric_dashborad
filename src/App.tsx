import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Info,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  computeDailyStats,
  formatMwh,
  loadDemandCsv,
  type DailyDemandRecord,
} from './utils/demandCsv';
import RealtimeSupplySection from './components/RealtimeSupplySection';

const DEFAULT_DATE = '2025-02-24';

export default function App() {
  const [records, setRecords] = useState<DailyDemandRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(DEFAULT_DATE);
  const [activeHour, setActiveHour] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDemandCsv()
      .then((data) => {
        if (cancelled) return;
        setRecords(data);
        const hasDefault = data.some((item) => item.date === DEFAULT_DATE);
        setSelectedDate(hasDefault ? DEFAULT_DATE : data[0].date);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '데이터를 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIndex = useMemo(() => {
    if (records.length === 0) return -1;
    const idx = records.findIndex((item) => item.date === selectedDate);
    return idx >= 0 ? idx : 0;
  }, [records, selectedDate]);

  const stats = useMemo(() => {
    if (selectedIndex < 0 || records.length === 0) return null;
    return computeDailyStats(records, selectedIndex);
  }, [records, selectedIndex]);

  useEffect(() => {
    setActiveHour(null);
  }, [selectedDate]);

  const inspectedPoint = useMemo(() => {
    if (!stats) return null;
    if (activeHour !== null) {
      return stats.record.hours.find((h) => h.hour === activeHour) ?? stats.max;
    }
    return stats.max;
  }, [stats, activeHour]);

  const handleStepDate = (delta: number) => {
    if (records.length === 0 || selectedIndex < 0) return;
    const nextIndex = selectedIndex + delta;
    if (nextIndex >= 0 && nextIndex < records.length) {
      setSelectedDate(records[nextIndex].date);
    }
  };

  // Compute proportional reference guide values strictly from current day's min/max MWh
  const referenceTicks = useMemo(() => {
    if (!stats) return { high: 0, mid: 0, low: 0, baseMin: 0 };
    const minVal = stats.min.value;
    const maxVal = stats.max.value;
    const baseMin = Math.max(0, Math.floor(minVal * 0.65));
    const mid = Math.round((maxVal + minVal) / 2);
    return { high: maxVal, mid, low: minVal, baseMin };
  }, [stats]);

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col">
      {/* Sticky Top Header matching Stitch design, constrained to 390px smartphone column */}
      <header className="sticky top-0 z-50 w-full bg-surface-container-lowest/90 backdrop-blur-xl border-b border-surface-container">
        <div className="w-full max-w-[390px] mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0">
              <Zap className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[16px] font-semibold text-on-surface leading-tight truncate">
                실시간 전기 시세
              </span>
              <span className="text-[11px] font-semibold text-secondary leading-tight truncate">
                GridPulse Energy · 2025 MWh
              </span>
            </div>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-surface-container-low border border-surface-container text-[11px] font-semibold text-secondary shrink-0">
            단위: MWh
          </div>
        </div>
      </header>

      {/* Main 390px Single-Column Container */}
      <main className="flex-1 w-full max-w-[390px] mx-auto px-4 py-5 flex flex-col gap-4">
        {/* Top Title & Subtitle */}
        <section className="flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
            KOREA POWER DEMAND DASHBOARD
          </div>
          <h1 className="text-[26px] font-bold text-on-surface tracking-tight leading-tight">
            실시간 전기 시세
          </h1>
          <p className="text-[14px] text-secondary leading-relaxed">
            한국전력거래소 시간별 전국 전력수요량(MWh)을 날짜별로 확인하세요.
          </p>
        </section>

        {/* Date Selector Dropdown + Stepper Controls */}
        <section className="flex flex-col gap-2" aria-label="날짜 선택">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-secondary">
              조회 기준 · 전국 전력수요량 (2025년)
            </span>
            <span className="text-[11px] font-medium text-outline tabular-nums">
              {records.length > 0 ? `총 ${records.length}일 데이터` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleStepDate(-1)}
              disabled={selectedIndex <= 0 || loading}
              aria-label="이전 날짜"
              className="w-11 h-11 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-center text-on-surface hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="relative flex-1 min-w-0">
              <div className="w-full h-11 px-3.5 bg-surface-container-lowest rounded-xl shadow-sm flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[13px] font-semibold text-on-surface truncate tabular-nums">
                    {stats ? stats.record.displayDate : '날짜 불러오는 중...'}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-secondary shrink-0" />
              </div>

              <select
                aria-label="날짜 선택 드롭다운"
                value={selectedDate}
                disabled={loading || records.length === 0}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                {records.map((item) => (
                  <option key={item.date} value={item.date}>
                    {item.displayDate}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleStepDate(1)}
              disabled={selectedIndex < 0 || selectedIndex >= records.length - 1 || loading}
              aria-label="다음 날짜"
              className="w-11 h-11 rounded-xl bg-surface-container-lowest shadow-sm flex items-center justify-center text-on-surface hover:bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </section>

        {/* Loading & Error States */}
        {loading && (
          <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm text-center text-[14px] text-secondary">
            전력수요량 CSV 데이터를 불러오는 중입니다...
          </div>
        )}

        {error && (
          <div className="bg-error-container rounded-2xl p-4 text-error text-[13px] font-medium">
            {error}
          </div>
        )}

        {/* Main Single-Column Dashboard Cards */}
        {stats && !loading && !error && (
          <>
            {/* Card 1: Primary Metric Card (Avg Daily Demand + Min/Max + Explainer) */}
            <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3.5 relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-primary-fixed/25 rounded-full blur-2xl pointer-events-none" />

              <div className="relative">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-primary-fixed/60 text-primary text-[11px] font-semibold">
                      일일 핵심 지표
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-surface-container text-secondary text-[11px] font-semibold">
                      24시간 평균
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-secondary tabular-nums">
                    {stats.record.date}
                  </span>
                </div>

                <span className="text-[13px] text-secondary block">하루 평균 전력수요량</span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-[34px] leading-tight font-extrabold text-primary tracking-tight tabular-nums">
                    {formatMwh(Math.round(stats.average))}
                  </span>
                  <span className="text-[16px] font-semibold text-secondary">MWh</span>
                </div>

                {/* Strict CSV Previous Day Comparison */}
                {stats.prevAverageDiff !== null && stats.prevAveragePct !== null ? (
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold mt-2.5 tabular-nums ${
                      stats.prevAverageDiff > 0
                        ? 'bg-error-container text-error'
                        : stats.prevAverageDiff < 0
                          ? 'bg-surface-container text-on-surface'
                          : 'bg-surface-container-low text-secondary'
                    }`}
                  >
                    {stats.prevAverageDiff > 0 ? (
                      <TrendingUp className="w-4 h-4 shrink-0" />
                    ) : stats.prevAverageDiff < 0 ? (
                      <TrendingDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <Minus className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      전일 대비{' '}
                      {stats.prevAverageDiff > 0
                        ? `▲ ${formatMwh(Math.round(stats.prevAverageDiff))} MWh (+${stats.prevAveragePct.toFixed(1)}%) 증가`
                        : stats.prevAverageDiff < 0
                          ? `▼ ${formatMwh(Math.abs(Math.round(stats.prevAverageDiff)))} MWh (${stats.prevAveragePct.toFixed(1)}%) 감소`
                          : '변동 없음 (0 MWh)'}
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low text-secondary text-[12px] font-semibold mt-2.5">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>2025년 첫날 데이터 (전일 비교 없음)</span>
                  </div>
                )}
              </div>

              {/* Secondary Min / Max Chips */}
              <div className="grid grid-cols-2 gap-2.5 bg-surface-container-low rounded-xl p-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-secondary text-[12px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span>최저 ({stats.min.label}시)</span>
                  </div>
                  <div className="text-[17px] font-bold text-on-surface mt-0.5 tabular-nums">
                    {formatMwh(stats.min.value)}{' '}
                    <span className="text-secondary text-[12px] font-normal">MWh</span>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-secondary text-[12px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <span>최대 ({stats.max.label}시)</span>
                  </div>
                  <div className="text-[17px] font-bold text-primary mt-0.5 tabular-nums">
                    {formatMwh(stats.max.value)}{' '}
                    <span className="text-secondary text-[12px] font-normal">MWh</span>
                  </div>
                </div>
              </div>

              {/* Beginner Tooltip Note */}
              <div className="p-3 rounded-xl bg-surface-container/60 flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col">
                  <span className="text-[12px] font-semibold text-on-surface">
                    전력수요량(MWh)이란?
                  </span>
                  <p className="text-[12px] text-secondary leading-snug mt-0.5">
                    전국에서 1시간 동안 사용된 전력의 총량을 메가와트시(MWh) 단위로 나타낸
                    지표입니다. 수요가 높은 피크 시간대에는 발전 비용과 시장 가격 변동이 커집니다.
                  </p>
                </div>
              </div>
            </section>

            {/* Card 2: Daily Total Snapshot Card */}
            <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-semibold text-secondary">
                    일일 총 전력수요량 (1~24시 합계)
                  </span>
                  <span className="text-[17px] font-bold text-on-surface tabular-nums">
                    {formatMwh(stats.total)}{' '}
                    <span className="text-[12px] font-normal text-secondary">MWh</span>
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-secondary shrink-0 tabular-nums">
                격차 {formatMwh(stats.spread)}
              </span>
            </section>

            {/* Card 3: 24-Hour Bar Chart Card */}
            <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              {/* Chart Header & Legends */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[16px] font-bold text-on-surface">
                    시간대별 전력수요량 추이
                  </h2>
                  <span className="px-2 py-0.5 bg-surface-container-low text-secondary text-[11px] font-semibold rounded shrink-0">
                    01시 ~ 24시
                  </span>
                </div>
                <p className="text-[12px] text-secondary leading-snug">
                  막대를 탭하거나 커서를 올리면 해당 시간의 정확한 MWh 값을 확인할 수 있습니다.
                </p>

                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-surface-container-highest" />
                    <span className="text-secondary">일반 시간</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-300" />
                    <span className="text-blue-700">최저</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary" />
                    <span className="text-primary">상위 피크 (Top 3)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Hover / Tap Detail Banner */}
              <div
                id="chartDetailBanner"
                className="min-h-9 px-3 py-1.5 bg-surface-container-low rounded-lg flex items-center justify-between gap-2 text-[12px]"
              >
                {inspectedPoint && (
                  <>
                    <span className="text-on-surface font-semibold flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          inspectedPoint.hour === stats.min.hour ? 'bg-blue-500' : 'bg-primary'
                        }`}
                      />
                      <span className="truncate tabular-nums">
                        {inspectedPoint.label}시 수요:{' '}
                        <strong className="text-primary">
                          {formatMwh(inspectedPoint.value)} MWh
                        </strong>
                        {inspectedPoint.hour === stats.max.hour
                          ? ' [최대]'
                          : inspectedPoint.hour === stats.min.hour
                            ? ' [최저]'
                            : stats.topPeakHours.has(inspectedPoint.hour)
                              ? ' [피크]'
                              : ''}
                      </span>
                    </span>
                    <span className="text-[11px] text-secondary shrink-0 tabular-nums">
                      {activeHour !== null ? '선택됨' : '일일 최댓값'}
                    </span>
                  </>
                )}
              </div>

              {/* 24-Hour Pure CSS Bar Chart adapted cleanly for 390px */}
              <div className="relative w-full h-56 pt-6 pb-5 flex items-end justify-between gap-[2px]">
                {/* Reference Threshold Lines (Derived from CSV min/max) */}
                <div className="absolute inset-x-0 top-6 bottom-5 flex flex-col justify-between pointer-events-none">
                  <div className="w-full flex items-center">
                    <span className="text-[9px] font-semibold text-secondary/70 bg-surface-container-lowest/80 pr-1 tabular-nums">
                      {formatMwh(referenceTicks.high)}
                    </span>
                    <div className="flex-1 h-px bg-surface-container" />
                  </div>
                  <div className="w-full flex items-center">
                    <span className="text-[9px] font-semibold text-secondary/70 bg-surface-container-lowest/80 pr-1 tabular-nums">
                      {formatMwh(referenceTicks.mid)}
                    </span>
                    <div className="flex-1 h-px bg-surface-container" />
                  </div>
                  <div className="w-full flex items-center">
                    <span className="text-[9px] font-semibold text-secondary/70 bg-surface-container-lowest/80 pr-1 tabular-nums">
                      {formatMwh(referenceTicks.low)}
                    </span>
                    <div className="flex-1 h-px bg-surface-container" />
                  </div>
                </div>

                {/* 24 Bars (01시 ~ 24시) */}
                {stats.record.hours.map((point) => {
                  const isMax = point.hour === stats.max.hour;
                  const isMin = point.hour === stats.min.hour;
                  const isTopPeak = stats.topPeakHours.has(point.hour);
                  const isSelected = activeHour === point.hour;

                  const range = Math.max(1, stats.max.value - referenceTicks.baseMin);
                  const heightPct = Math.min(
                    100,
                    Math.max(18, 22 + ((point.value - referenceTicks.baseMin) / range) * 74),
                  );

                  const showAxisTick =
                    point.hour === 1 ||
                    point.hour === 4 ||
                    point.hour === 8 ||
                    point.hour === 12 ||
                    point.hour === 16 ||
                    point.hour === 20 ||
                    point.hour === 24 ||
                    isSelected;

                  let barColor =
                    'bg-surface-container-highest hover:bg-primary-fixed-dim';
                  if (isMax) {
                    barColor = 'bg-primary shadow-sm';
                  } else if (isTopPeak) {
                    barColor = 'bg-primary-container hover:bg-primary';
                  } else if (isMin) {
                    barColor = 'bg-blue-300 hover:bg-blue-400';
                  }

                  if (isSelected && !isMax && !isMin) {
                    barColor = 'bg-primary-container ring-2 ring-primary/30';
                  }

                  return (
                    <button
                      key={point.hour}
                      type="button"
                      onClick={() =>
                        setActiveHour((prev) => (prev === point.hour ? null : point.hour))
                      }
                      onMouseEnter={() => setActiveHour(point.hour)}
                      aria-label={`${point.label}시 ${formatMwh(point.value)} MWh`}
                      className="relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer focus:outline-none group"
                    >
                      {isMax && (
                        <span className="absolute -top-5 px-1 py-0.5 rounded bg-primary-fixed text-primary text-[9px] font-bold leading-none whitespace-nowrap z-10">
                          최대
                        </span>
                      )}
                      {isMin && !isMax && (
                        <span className="absolute -top-5 px-1 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold leading-none whitespace-nowrap z-10">
                          최저
                        </span>
                      )}

                      <div
                        className={`w-full rounded-t transition-all duration-200 ${barColor} ${
                          isSelected ? 'brightness-110' : ''
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />

                      <span
                        className={`absolute -bottom-5 text-[9px] tabular-nums leading-none ${
                          isSelected || isMax
                            ? 'text-primary font-bold'
                            : isMin
                              ? 'text-blue-600 font-bold'
                              : showAxisTick
                                ? 'text-secondary font-medium'
                                : 'text-transparent'
                        }`}
                      >
                        {point.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Time Zone Highlights Footnote (Computed from CSV) */}
              <div className="flex flex-col gap-1.5 bg-surface-container-low/60 px-3 py-2.5 rounded-xl text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[11px] font-semibold shrink-0">
                    최저 구간 · {stats.min.label}시
                  </span>
                  <span className="font-semibold text-on-surface tabular-nums">
                    {formatMwh(stats.min.value)} MWh
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-[11px] font-semibold shrink-0">
                    최대 구간 · {stats.max.label}시
                  </span>
                  <span className="font-bold text-primary tabular-nums">
                    {formatMwh(stats.max.value)} MWh
                  </span>
                </div>
              </div>
            </section>

            {/* Card 4: Complete 24 Hourly Values Grid (1시 ~ 24시, all 24 values) */}
            <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="text-[16px] font-bold text-on-surface">
                    시간별 24개 전력수요량 전체
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-secondary">단위: MWh</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {stats.record.hours.map((point) => {
                  const isMax = point.hour === stats.max.hour;
                  const isMin = point.hour === stats.min.hour;
                  const isTopPeak = stats.topPeakHours.has(point.hour);
                  const isSelected = activeHour === point.hour;

                  let cellStyle =
                    'bg-surface-container-low/70 text-on-surface border border-transparent hover:border-surface-container-highest';
                  if (isMax) {
                    cellStyle =
                      'bg-primary-fixed/50 text-primary border border-primary-fixed-dim font-bold';
                  } else if (isMin) {
                    cellStyle = 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold';
                  } else if (isTopPeak) {
                    cellStyle =
                      'bg-primary-fixed/25 text-on-primary-fixed-variant border border-primary-fixed';
                  }

                  if (isSelected) {
                    cellStyle += ' ring-2 ring-primary/40';
                  }

                  return (
                    <button
                      key={point.hour}
                      type="button"
                      onClick={() =>
                        setActiveHour((prev) => (prev === point.hour ? null : point.hour))
                      }
                      className={`px-3 py-2.5 rounded-xl flex items-center justify-between gap-1.5 text-left transition-all min-h-[42px] ${cellStyle}`}
                    >
                      <span className="text-[12px] font-semibold tabular-nums">
                        {point.label}시
                        {isMax ? ' · 최대' : isMin ? ' · 최저' : ''}
                      </span>
                      <span className="text-[13px] font-bold tabular-nums">
                        {formatMwh(point.value)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Card 5: Data-Driven Daily Summary Card (Zero fabricated numbers) */}
            <section className="bg-gradient-to-br from-primary-fixed/20 via-surface-container-lowest to-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-[15px] font-bold text-on-surface">
                    선택 날짜 전력수요 요약
                  </h3>
                  <span className="text-[11px] text-secondary truncate">
                    {stats.record.displayDate} 실측 데이터 기준
                  </span>
                </div>
              </div>

              <div className="bg-surface-container-lowest/90 rounded-xl p-3.5 shadow-sm flex flex-col gap-2">
                <p className="text-[13.5px] text-on-surface leading-relaxed">
                  <strong className="text-primary">{stats.record.displayDate}</strong>의 하루
                  평균 전국 전력수요량은{' '}
                  <strong className="text-primary tabular-nums">
                    {formatMwh(Math.round(stats.average))} MWh
                  </strong>
                  이며, 24시간 누적 수요량은{' '}
                  <strong className="tabular-nums">{formatMwh(stats.total)} MWh</strong>입니다.
                  가장 수요가 적었던 시간은{' '}
                  <strong className="tabular-nums">
                    {stats.min.label}시({formatMwh(stats.min.value)} MWh)
                  </strong>
                  , 가장 높았던 피크 시간은{' '}
                  <strong className="text-primary tabular-nums">
                    {stats.max.label}시({formatMwh(stats.max.value)} MWh)
                  </strong>
                  로 일중 변동 폭은{' '}
                  <strong className="tabular-nums">{formatMwh(stats.spread)} MWh</strong>입니다.
                </p>
              </div>
            </section>
          </>
        )}

        {/* Realtime Power Supply API Section */}
        <RealtimeSupplySection />

        {/* Source & Unit Transparency Banner */}
        <section className="p-3.5 rounded-xl bg-surface-container-low text-secondary flex flex-col gap-1.5">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-[12px] leading-snug">
              <div className="font-semibold text-on-surface">
                출처: 한국전력거래소(KPX) · 공공데이터포털
              </div>
              <div className="text-secondary mt-0.5">
                데이터: 시간별 전국 전력수요량 (2025-01-01 ~ 2025-12-31) · 단위: MWh
              </div>
            </div>
          </div>
          <p className="text-[11px] text-outline leading-snug">
            * 표시된 모든 수치는 첨부된 한국전력거래소 공식 CSV 원자료 값만 사용합니다.
          </p>
        </section>
      </main>

      {/* Footer matching Stitch style inside 390px single-column alignment */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container py-5 mt-2">
        <div className="w-full max-w-[390px] mx-auto px-4 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-on-surface">
              실시간 전기 시세 (GridPulse Energy)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-semibold">
              KPX · MWh
            </span>
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            출처: 한국전력거래소(KPX), 공공데이터포털 · 시간별 전국 전력수요량 (단위: MWh)
          </p>
        </div>
      </footer>
    </div>
  );
}
