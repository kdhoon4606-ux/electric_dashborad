import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

interface RawApiItem {
  date?: string | number;
  hour?: string | number;
  areaName?: string;
  smp?: string | number;
  mlfd?: string | number;
  jlfd?: string | number;
  slfd?: string | number;
}

interface NormalizedSupplyRow {
  date: string;
  hour: number;
  areaName: string;
  smp: number;
  mlfd: number;
  jlfd: number | null;
  slfd: number | null;
}

interface DataGoKrResponse {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?:
        | {
            item?: RawApiItem | RawApiItem[];
          }
        | RawApiItem[]
        | '';
      totalCount?: number;
    };
  };
}

function getSeoulDateYYYYMMDD(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}${month}${day}`;
}

function readServiceKey(): string {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
      const fileKey = parsed.DATA_GO_KR_SERVICE_KEY?.trim();
      if (fileKey) return fileKey;
    } catch {
      // Fall back to process.env if .env cannot be read
    }
  }
  return process.env.DATA_GO_KR_SERVICE_KEY?.trim() ?? '';
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function toFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const num = Number(val.trim());
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

const app = express();
const PORT = 3000;

app.get('/api/realtime-supply', async (_req, res) => {
  const dateYYYYMMDD = getSeoulDateYYYYMMDD();
  const serviceKey = readServiceKey();

  if (!serviceKey) {
    res.status(400).json({
      ok: false,
      date: dateYYYYMMDD,
      httpStatus: 400,
      resultCode: 'MISSING_SERVICE_KEY',
      resultMsg: '.env 파일의 DATA_GO_KR_SERVICE_KEY 값이 비어 있습니다. 공공데이터포털 인증키를 입력해 주세요.',
    });
    return;
  }

  const encodedKey = serviceKey.includes('%') ? serviceKey : encodeURIComponent(serviceKey);
  const targetUrl =
    `https://apis.data.go.kr/B552115/SmpWithForecastDemand/getSmpWithForecastDemand` +
    `?serviceKey=${encodedKey}&pageNo=1&numOfRows=100&dataType=json&date=${dateYYYYMMDD}`;

  try {
    const apiRes = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });

    const rawText = await apiRes.text();

    if (!apiRes.ok) {
      const xmlCode = extractXmlTag(rawText, 'returnReasonCode') ?? extractXmlTag(rawText, 'resultCode');
      const xmlMsg =
        extractXmlTag(rawText, 'returnAuthMsg') ??
        extractXmlTag(rawText, 'errMsg') ??
        extractXmlTag(rawText, 'resultMsg');

      res.status(apiRes.status).json({
        ok: false,
        date: dateYYYYMMDD,
        httpStatus: apiRes.status,
        resultCode: xmlCode ?? `HTTP_${apiRes.status}`,
        resultMsg: xmlMsg ?? (apiRes.statusText || '공공데이터포털 API 요청에 실패했습니다.'),
      });
      return;
    }

    let parsed: DataGoKrResponse | null = null;
    try {
      parsed = JSON.parse(rawText) as DataGoKrResponse;
    } catch {
      const xmlCode = extractXmlTag(rawText, 'returnReasonCode') ?? extractXmlTag(rawText, 'resultCode');
      const xmlMsg =
        extractXmlTag(rawText, 'returnAuthMsg') ??
        extractXmlTag(rawText, 'errMsg') ??
        extractXmlTag(rawText, 'resultMsg');

      res.status(502).json({
        ok: false,
        date: dateYYYYMMDD,
        httpStatus: apiRes.status,
        resultCode: xmlCode ?? 'INVALID_RESPONSE',
        resultMsg: xmlMsg ?? 'JSON이 아닌 응답을 받았습니다.',
      });
      return;
    }

    const resultCode = parsed.response?.header?.resultCode ?? '';
    const resultMsg = parsed.response?.header?.resultMsg ?? '';

    if (resultCode && resultCode !== '00') {
      res.status(502).json({
        ok: false,
        date: dateYYYYMMDD,
        httpStatus: apiRes.status,
        resultCode,
        resultMsg: resultMsg || '공공데이터포털 API 오류 응답이 반환되었습니다.',
      });
      return;
    }

    const rawItemsContainer = parsed.response?.body?.items;
    let rawList: RawApiItem[] = [];
    if (Array.isArray(rawItemsContainer)) {
      rawList = rawItemsContainer;
    } else if (rawItemsContainer && typeof rawItemsContainer === 'object' && 'item' in rawItemsContainer) {
      const itemField = rawItemsContainer.item;
      if (Array.isArray(itemField)) {
        rawList = itemField;
      } else if (itemField && typeof itemField === 'object') {
        rawList = [itemField];
      }
    }

    const mainlandRows: NormalizedSupplyRow[] = [];
    for (const item of rawList) {
      if (item.areaName !== '육지') continue;
      const hour = toFiniteNumber(item.hour);
      const smp = toFiniteNumber(item.smp);
      const mlfd = toFiniteNumber(item.mlfd);
      if (hour === null || smp === null || mlfd === null) continue;

      mainlandRows.push({
        date: String(item.date ?? dateYYYYMMDD),
        hour,
        areaName: '육지',
        smp,
        mlfd,
        jlfd: toFiniteNumber(item.jlfd),
        slfd: toFiniteNumber(item.slfd),
      });
    }

    mainlandRows.sort((a, b) => a.hour - b.hour);

    if (mainlandRows.length === 0) {
      res.status(404).json({
        ok: false,
        date: dateYYYYMMDD,
        httpStatus: apiRes.status,
        resultCode: resultCode || 'NO_DATA',
        resultMsg: resultMsg || `${dateYYYYMMDD} 날짜의 육지 실시간 전력 수급 데이터가 아직 없습니다.`,
      });
      return;
    }

    res.json({
      ok: true,
      date: dateYYYYMMDD,
      resultCode: resultCode || '00',
      resultMsg: resultMsg || 'NORMAL SERVICE.',
      items: mainlandRows,
    });
  } catch (err) {
    res.status(502).json({
      ok: false,
      date: dateYYYYMMDD,
      httpStatus: 502,
      resultCode: 'NETWORK_ERROR',
      resultMsg: err instanceof Error ? err.message : '외부 API 연결 중 오류가 발생했습니다.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
