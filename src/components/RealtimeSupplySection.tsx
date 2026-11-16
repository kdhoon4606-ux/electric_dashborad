import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, TableProperties } from 'lucide-react';

interface SupplyRow {
  date: string;
  hour: number;
  areaName: string;
  smp: number;
  mlfd: number;
}

interface SupplyApiSuccess {
  ok: true;
  date: string;
  resultCode: string;
  resultMsg: string;
  items: SupplyRow[];
}

interface SupplyApiError {
  ok: false;
  date?: string;
  httpStatus?: number;
  resultCode?: string;
  resultMsg?: string;
}

type SupplyApiResponse = SupplyApiSuccess | SupplyApiError;

function formatYYYYMMDD(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

export default function RealtimeSupplySection() {
  const [rows, setRows] = useState<SupplyRow[]>([]);
  const [targetDate, setTargetDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorInfo, setErrorInfo] = useState<{
    httpStatus?: number;
    resultCode?: string;
    resultMsg: string;
  } | null>(null);

  const fetchSupply = useCallback(async () => {
    setLoading(true);
    setErrorInfo(null);

    try {
      const res = await fetch('/api/realtime-supply');
      const contentType = res.headers.get('content-type') ?? '';

      if (!contentType.includes('application/json')) {
        setRows([]);
        setErrorInfo({
          httpStatus: res.status,
          resultCode: `HTTP_${res.status}`,
          resultMsg: '서버에서 JSON 응답을 반환하지 않았습니다.',
        });
        setLoading(false);
        return;
      }

      const data = (await res.json()) as SupplyApiResponse;
      if (data.date) {
        setTargetDate(data.date);
      }

      if (!res.ok || !data.ok) {
        const errData = data as SupplyApiError;
        setRows([]);
        setErrorInfo({
          httpStatus: errData.httpStatus ?? res.status,
          resultCode: errData.resultCode ?? `HTTP_${res.status}`,
          resultMsg: errData.resultMsg ?? '실시간 전력 수급 데이터를 불러오지 못했습니다.',
        });
        setLoading(false);
        return;
      }

      setRows(data.items);
      setLoading(false);
    } catch (err) {
      setRows([]);
      setErrorInfo({
        resultCode: 'FETCH_ERROR',
        resultMsg: err instanceof Error ? err.message : '요청 중 네트워크 오류가 발생했습니다.',
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSupply();
  }, [fetchSupply]);

  return (
    <section
      aria-labelledby="realtime-supply-heading"
      className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-3"
    >
      {/* Section Header with Source & Units */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <TableProperties className="w-4 h-4 text-primary shrink-0" />
              <h2
                id="realtime-supply-heading"
                className="text-[16px] font-bold text-on-surface leading-tight"
              >
                실시간 전력 수급
              </h2>
            </div>
            <p className="text-[11px] font-medium text-secondary leading-snug">
              출처: 한국전력거래소 · 공공데이터포털 | 단위: 원/kWh · MW
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSupply}
            disabled={loading}
            aria-label="실시간 전력 수급 새로고침"
            className="h-9 px-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
            <span>새로고침</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-secondary bg-surface-container-low/70 rounded-lg px-2.5 py-1.5 tabular-nums">
          <span>기준: 오늘 육지 ({targetDate ? formatYYYYMMDD(targetDate) : 'Asia/Seoul'})</span>
          <span>{rows.length > 0 ? `${rows.length}시간 수신` : '실시간 API 연동'}</span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-6 text-center text-[13px] text-secondary bg-surface-container-low/40 rounded-xl">
          공공데이터포털에서 오늘의 육지 SMP 및 수요예측을 조회 중입니다...
        </div>
      )}

      {/* Error State showing exact resultCode, resultMsg, or HTTP status */}
      {!loading && errorInfo && (
        <div className="rounded-xl bg-error-container/70 border border-error/20 p-3.5 flex flex-col gap-1.5 text-on-error-container">
          <div className="flex items-center gap-1.5 text-[13px] font-bold text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>실시간 전력 수급 조회 실패</span>
          </div>
          <div className="text-[12px] leading-relaxed flex flex-col gap-0.5 tabular-nums">
            {errorInfo.httpStatus !== undefined && (
              <div>
                <span className="font-semibold">HTTP 상태:</span> {errorInfo.httpStatus}
              </div>
            )}
            {errorInfo.resultCode && (
              <div>
                <span className="font-semibold">resultCode:</span> {errorInfo.resultCode}
              </div>
            )}
            <div>
              <span className="font-semibold">resultMsg:</span> {errorInfo.resultMsg}
            </div>
          </div>
        </div>
      )}

      {/* Hourly Mainland SMP & Forecast Demand Table */}
      {!loading && !errorInfo && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-surface-container">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low text-[11px] font-semibold text-secondary border-b border-surface-container">
                <th className="py-2 px-3">시간</th>
                <th className="py-2 px-3 text-right">육지 SMP (원/kWh)</th>
                <th className="py-2 px-3 text-right">수요예측 (MW)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/70 text-[12px] tabular-nums">
              {rows.map((row, idx) => (
                <tr
                  key={`${row.date}-${row.hour}`}
                  className={idx % 2 === 1 ? 'bg-surface-container-low/30' : 'bg-surface-container-lowest'}
                >
                  <td className="py-2 px-3 font-semibold text-on-surface">
                    {String(row.hour).padStart(2, '0')}시
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-primary">
                    {row.smp.toLocaleString('ko-KR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-on-surface">
                    {row.mlfd.toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
