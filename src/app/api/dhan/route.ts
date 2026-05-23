import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import * as https from 'https';

const ENC_KEY = process.env.ENCRYPTION_KEY!;

function decrypt(text: string): string {
  const [ivHex, encHex] = text.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENC_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final()
  ]).toString();
}

function dhanReq(path: string, method: string, body: object | null, token: string, clientId: string): Promise<unknown> {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.dhan.co',
      path: `/v2${path}`,
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': token,
        'dhanClientId': clientId,
      },
    }, (res) => {
      let d = '';
      res.on('data', (c) => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    });
    req.on('error', () => resolve([]));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseTime(str: string | undefined | null): Date | null {
  if (!str) return null;
  const d = new Date(str.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function fmtHold(mins: number): string {
  if (!mins || mins <= 0) return '';
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

async function getUserBroker(authHeader: string | null) {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  const jwt = (authHeader || '').replace('Bearer ', '');
  const { data: { user }, error } = await sb.auth.getUser(jwt);
  if (error || !user) throw new Error('Unauthorized');
  const { data: conn, error: connErr } = await sb
    .from('broker_connections')
    .select('access_token, client_id')
    .eq('user_id', user.id)
    .eq('broker', 'dhan')
    .eq('is_active', true)
    .single();
  if (connErr || !conn) throw new Error('Broker not connected');
  return { token: decrypt(conn.access_token), clientId: conn.client_id, userId: user.id };
}

interface DhanTrade {
  orderId: string;
  exchangeTradeId?: string;
  transactionType: 'BUY' | 'SELL';
  exchangeSegment: string;
  productType: string;
  tradingSymbol: string;
  securityId: string;
  tradedQuantity: number;
  tradedPrice: number;
  createTime?: string;
  updateTime?: string;
  exchangeTime?: string;
}

interface DhanPosition {
  tradingSymbol: string;
  securityId: string;
  positionType: 'LONG' | 'SHORT' | 'CLOSED';
  exchangeSegment: string;
  productType: string;
  buyAvg: number;
  buyQty: number;
  sellAvg: number;
  sellQty: number;
  netQty: number;
  realizedProfit: number;
  unrealizedProfit: number;
  multiplier?: number;
}

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get('endpoint') || '/fundlimit';
  try {
    const { token, clientId } = await getUserBroker(request.headers.get('authorization'));

    if (endpoint === '/allpositions') {
      // Use Dhan's authoritative data:
      // /positions provides realizedProfit + unrealizedProfit calculated by Dhan
      // /trades provides the actual fills for entry/exit times
      const [rawPos, rawTrades] = await Promise.all([
        dhanReq('/positions', 'GET', null, token, clientId),
        dhanReq('/trades', 'GET', null, token, clientId),
      ]);

      const positions = Array.isArray(rawPos) ? rawPos as DhanPosition[] : [];
      const trades = Array.isArray(rawTrades) ? rawTrades as DhanTrade[] : [];
      const today = new Date().toISOString().split('T')[0];

      const tradeMap: Record<string, DhanTrade[]> = {};
      trades.forEach(t => {
        const k = `${t.tradingSymbol}_${t.productType}`;
        if (!tradeMap[k]) tradeMap[k] = [];
        tradeMap[k].push(t);
      });

      const result: Record<string, unknown>[] = [];

      positions.forEach((p) => {
        const sym = p.tradingSymbol || p.securityId || '';
        const prod = p.productType || '';
        const k = `${sym}_${prod}`;
        const symbolTrades = tradeMap[k] || [];

        const sortedTrades = symbolTrades
          .filter(t => t.exchangeTime || t.createTime)
          .sort((a, b) => {
            const ta = parseTime(a.exchangeTime || a.createTime)?.getTime() || 0;
            const tb = parseTime(b.exchangeTime || b.createTime)?.getTime() || 0;
            return ta - tb;
          });

        const firstTrade = sortedTrades[0];
        const lastTrade = sortedTrades[sortedTrades.length - 1];
        const firstTime = parseTime(firstTrade?.exchangeTime || firstTrade?.createTime);
        const lastTime = parseTime(lastTrade?.exchangeTime || lastTrade?.createTime);

        const realizedPnl = Number(p.realizedProfit) || 0;
        const unrealizedPnl = Number(p.unrealizedProfit) || 0;
        const netQty = Number(p.netQty) || 0;
        const isClosed = netQty === 0;
        const totalPnl = isClosed ? realizedPnl : realizedPnl + unrealizedPnl;

        const firstWasBuy = firstTrade?.transactionType === 'BUY';
        const side = firstWasBuy ? 'BUY' : 'SELL';

        const displayQty = isClosed
          ? Math.max(Number(p.buyQty) || 0, Number(p.sellQty) || 0)
          : Math.abs(netQty);

        const endTime = isClosed ? lastTime : new Date();
        const holdMins = firstTime && endTime
          ? Math.max(0, Math.round((endTime.getTime() - firstTime.getTime()) / 60000))
          : 0;

        const entry = firstWasBuy ? (Number(p.buyAvg) || 0) : (Number(p.sellAvg) || 0);
        const exit = isClosed
          ? (firstWasBuy ? (Number(p.sellAvg) || 0) : (Number(p.buyAvg) || 0))
          : 0;
        const pnlPct = entry > 0 && exit > 0
          ? parseFloat((((exit - entry) / entry) * 100 * (firstWasBuy ? 1 : -1)).toFixed(2))
          : 0;
        // R:R as R-multiple: % move relative to assumed 1% risk
        // e.g. +3% gain on a 1% risk trade = 3R = "3.00" R:R
        // Negative = loss expressed as fraction of R
        const rrNum = pnlPct !== 0 ? parseFloat(Math.abs(pnlPct).toFixed(2)) : 0;
        const rr = rrNum > 0 ? (totalPnl >= 0 ? `${rrNum}R` : `-${rrNum}R`) : "";

        result.push({
          id: `${sym}_${prod}_${firstTrade?.orderId || today}`,
          symbol: sym,
          date: firstTime ? firstTime.toISOString().split('T')[0] : today,
          type: side,
          qty: displayQty,
          buyAvg: Number(p.buyAvg) || 0,
          sellAvg: Number(p.sellAvg) || 0,
          entry,
          exit,
          pnl: parseFloat(totalPnl.toFixed(2)),
          pnlPct,
          realizedPnl: parseFloat(realizedPnl.toFixed(2)),
          unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
          isClosed,
          status: isClosed ? 'closed' : 'open',
          product: prod,
          holdTime: holdMins,
          holdDisplay: fmtHold(holdMins),
          time: firstTime ? firstTime.toTimeString().slice(0, 5) : '',
          side: firstWasBuy ? 'long' : 'short',
          rr,
          sl: 0, target: 0, grade: '', setup: '', emotion: '', lesson: '', confidence: 5, exitType: '',
          mistakes: [],
        });
      });

      result.sort((a, b) => {
        if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
        const da = String(a.date) + ' ' + String(a.time);
        const db = String(b.date) + ' ' + String(b.time);
        return db.localeCompare(da);
      });

      return NextResponse.json(result);
    }

    const data = await dhanReq(endpoint, 'GET', null, token, clientId);
    return NextResponse.json(data);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get('endpoint') || '/fundlimit';
  try {
    const { token, clientId } = await getUserBroker(request.headers.get('authorization'));
    const body = await request.json();
    const data = await dhanReq(endpoint, 'POST', body, token, clientId);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
