type Row = Record<string, unknown>;
type Quote = { price: number; date: string | null; name: string; source: string; tradedAt?: string };
type Position = { market: string; symbol: string; shares: number };
type Feed = { loaded: number; quotes: Record<string, Quote> };
const feeds = {
  TWSE: { url: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', code: 'Code', name: 'Name', price: 'ClosingPrice' },
  TPEX: { url: 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', code: 'SecuritiesCompanyCode', name: 'CompanyName', price: 'Close' },
};
type Market = keyof typeof feeds;
const closeCache = new Map<Market, Promise<Feed>>();
const liveCache = new Map<string, { until: number; result: Promise<Quote | null> }>();
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
}
function dateOnly(value: unknown) {
  const raw = String(value ?? '').trim().replace(/[-/]/g, '');
  if (/^\d{7}$/.test(raw)) return `${Number(raw.slice(0, 3)) + 1911}-${raw.slice(3, 5)}-${raw.slice(5)}`;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
  return null;
}
async function closeRows(market: Market): Promise<Row[]> {
  if (market === 'TWSE') {
    try {
      const response = await fetch('https://www.twse.com.tw/exchangeReport/STOCK_DAY_ALL?response=open_data',
        { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('TWSE CSV');
      const csv = await response.text();
      const rows = csv.split(/\r?\n/).flatMap(line => {
        const cells = line.match(/"(?:[^"]|"")*"/g)?.map(cell => cell.slice(1, -1).replaceAll('""', '"'));
        if (!cells || cells.length !== 11) return [];
        return [{ Date: cells[0], Code: cells[1], Name: cells[2], ClosingPrice: cells[8] }];
      });
      if (!rows.length) throw new Error('TWSE CSV');
      return rows;
    } catch {
      // Use the official JSON feed if the newer CSV snapshot is unavailable.
    }
  }
  const response = await fetch(feeds[market].url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(market);
  return response.json() as Promise<Row[]>;
}
async function closes(market: Market): Promise<Feed> {
  const previous = await closeCache.get(market)?.catch(() => undefined);
  if (previous && Date.now() - previous.loaded < 300_000) return previous;
  const pending = (async () => {
    const feed = feeds[market];
    const rows = await closeRows(market);
    const quotes: Record<string, Quote> = {};
    for (const row of rows) {
      const symbol = String(row[feed.code] ?? '').trim();
      const price = Number(String(row[feed.price] ?? '').replaceAll(',', ''));
      if (!/^[0-9][0-9A-Z]{3,7}$/.test(symbol) || !Number.isFinite(price) || price <= 0) continue;
      quotes[symbol] = { price, date: dateOnly(row.Date), name: String(row[feed.name] ?? '').trim(), source: market };
    }
    if (!Object.keys(quotes).length) throw new Error(market);
    return { loaded: Date.now(), quotes };
  })().catch((error) => {
    if (previous) return { ...previous, loaded: Date.now() - 270_000 };
    throw error;
  });
  closeCache.set(market, pending);
  return pending;
}
function live(position: Position, key: string): Promise<Quote | null> {
  const id = position.market + ':' + position.symbol;
  const previous = liveCache.get(id);
  const now = Date.now();
  if (previous && previous.until > now) return previous.result;
  for (const [symbol, cached] of liveCache) {
    if (cached.until <= now) liveCache.delete(symbol);
  }
  if (liveCache.size >= 30) return Promise.resolve(null);
  const result = (async () => {
    const res = await fetch('https://api.fugle.tw/marketdata/v1.0/stock/intraday/quote/' + position.symbol,
      { headers: { 'X-API-KEY': key }, signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const data = await res.json();
    const price = Number(data.lastTrade?.price);
    const rawTime = Number(data.lastTrade?.time);
    const date = dateOnly(data.date);
    const markets = position.market === 'TPEX' ? ['OTC', 'TPEX'] : ['TWSE'];
    if (data.symbol !== position.symbol || !markets.includes(String(data.exchange).toUpperCase())
      || !Number.isFinite(price) || price <= 0 || !Number.isFinite(rawTime) || rawTime < 1e15 || rawTime > 9e15
      || !date) return null;
    const tradedAt = new Date(rawTime / 1000);
    if (new Date(tradedAt.getTime() + 8 * 3600_000).toISOString().slice(0, 10) !== date) return null;
    return { price, date, name: String(data.name ?? ''), source: 'Fugle', tradedAt: tradedAt.toISOString() };
  })().catch(() => null);
  liveCache.set(id, { until: now + 60_000, result });
  return result;
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json({ message: 'POST only' }, 405);
  const token = request.headers.get('Authorization');
  if (!token?.startsWith('Bearer ')) return json({ message: '請先登入' }, 401);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const apikey = Deno.env.get('SUPABASE_ANON_KEY') ?? request.headers.get('apikey') ?? '';
    const headers = { Authorization: token, apikey, 'Content-Type': 'application/json' };
    const verified = await fetch(url + '/auth/v1/user', { headers, signal: AbortSignal.timeout(5000) });
    if (!verified.ok) return json({ message: '登入已失效' }, 401);
    const response = await fetch(url + '/rest/v1/rpc/ledger_summary',
      { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(8000) });
    if (!response.ok) return json({ message: '無法讀取家庭帳簿' }, response.status >= 500 ? 502 : 403);
    const summary = await response.json() as { positions: Record<string, Position> };
    const unique = new Map<string, Position>();
    for (const position of Object.values(summary.positions)) {
      if (position.shares > 0 && ['TWSE', 'TPEX'].includes(position.market) &&
          /^[0-9][0-9A-Z]{3,7}$/.test(position.symbol)) {
        unique.set(position.market + ':' + position.symbol, position);
      }
    }
    const positions = [...unique.values()];
    const markets = [...new Set(positions.map(p => p.market as Market))];
    const taipei = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });
    const clock = Object.fromEntries(taipei.formatToParts(new Date()).map(p => [p.type, p.value]));
    const minute = Number(clock.hour) * 60 + Number(clock.minute);
    const today = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const weekday = new Date(today + 'T00:00:00Z').getUTCDay();
    const key = weekday >= 1 && weekday <= 5 && minute >= 540 && minute < 810
      ? Deno.env.get('FUGLE_API_KEY') : undefined;
    const [official, intraday] = await Promise.all([
      Promise.all(markets.map(async market => [market, await closes(market).catch(() => null)] as const)),
      Promise.all(key ? positions.slice(0, 20).map(async p => [p.market + ':' + p.symbol, await live(p, key)] as const) : []),
    ]);
    const byMarket = new Map(official);
    const bySymbol = new Map(intraday);
    const quotes: Record<string, Quote> = {};
    for (const [id, position] of unique) {
      const recent = bySymbol.get(id);
      const close = byMarket.get(position.market as Market)?.quotes[position.symbol];
      const quote = recent?.date === today ? recent : close;
      if (quote) quotes[id] = quote;
    }
    return json({ quotes });
  } catch {
    return json({ message: '行情服務暫時無法查詢' }, 502);
  }
});
