export interface HourlyPoint {
  hour: number;
  label: string;
  value: number;
}

export interface DailyDemandRecord {
  date: string;
  displayDate: string;
  shortDate: string;
  weekday: string;
  hours: HourlyPoint[];
}

export interface DailyDemandStats {
  record: DailyDemandRecord;
  average: number;
  total: number;
  min: HourlyPoint;
  max: HourlyPoint;
  spread: number;
  topPeakHours: Set<number>;
  prevDate: string | null;
  prevAverageDiff: number | null;
  prevAveragePct: number | null;
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const CSV_ASSET_PATH = '/assets/aistudio/_____________________20251231_03fa147b.csv';

function formatKoreanDate(dateStr: string): { displayDate: string; shortDate: string; weekday: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = WEEKDAYS_KO[dt.getUTCDay()];
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return {
    displayDate: `${y}년 ${mm}월 ${dd}일 (${weekday})`,
    shortDate: `${mm}/${dd} (${weekday})`,
    weekday,
  };
}

export async function loadDemandCsv(): Promise<DailyDemandRecord[]> {
  const response = await fetch(CSV_ASSET_PATH);
  if (!response.ok) {
    throw new Error(`CSV 데이터를 불러오지 못했습니다. (HTTP ${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  let text = '';
  try {
    text = new TextDecoder('euc-kr').decode(buffer);
  } catch {
    text = new TextDecoder('utf-8').decode(buffer);
  }

  const lines = text.split(/\r?\n/);
  const records: DailyDemandRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    const dateStr = cols[0]?.trim();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    if (cols.length < 25) continue;

    const hours: HourlyPoint[] = [];
    let valid = true;

    for (let h = 1; h <= 24; h++) {
      const raw = cols[h]?.trim();
      const value = Number(raw);
      if (raw === '' || !Number.isFinite(value)) {
        valid = false;
        break;
      }
      hours.push({
        hour: h,
        label: String(h).padStart(2, '0'),
        value,
      });
    }

    if (!valid || hours.length !== 24) continue;

    const { displayDate, shortDate, weekday } = formatKoreanDate(dateStr);
    records.push({
      date: dateStr,
      displayDate,
      shortDate,
      weekday,
      hours,
    });
  }

  if (records.length === 0) {
    throw new Error('CSV 파일에서 유효한 전력수요량 데이터를 찾지 못했습니다.');
  }

  return records;
}

export function computeDailyStats(
  records: DailyDemandRecord[],
  selectedIndex: number,
): DailyDemandStats {
  const record = records[selectedIndex];
  const values = record.hours;

  let total = 0;
  let min = values[0];
  let max = values[0];

  for (const item of values) {
    total += item.value;
    if (item.value < min.value) min = item;
    if (item.value > max.value) max = item;
  }

  const average = total / values.length;
  const spread = max.value - min.value;

  const sortedByValue = [...values].sort((a, b) => b.value - a.value);
  const topPeakHours = new Set(sortedByValue.slice(0, 3).map((item) => item.hour));

  let prevDate: string | null = null;
  let prevAverageDiff: number | null = null;
  let prevAveragePct: number | null = null;

  if (selectedIndex > 0) {
    const prevRecord = records[selectedIndex - 1];
    const prevTotal = prevRecord.hours.reduce((acc, item) => acc + item.value, 0);
    const prevAvg = prevTotal / prevRecord.hours.length;
    prevDate = prevRecord.date;
    prevAverageDiff = average - prevAvg;
    prevAveragePct = prevAvg !== 0 ? (prevAverageDiff / prevAvg) * 100 : null;
  }

  return {
    record,
    average,
    total,
    min,
    max,
    spread,
    topPeakHours,
    prevDate,
    prevAverageDiff,
    prevAveragePct,
  };
}

export function formatMwh(value: number, fractionDigits = 0): string {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
