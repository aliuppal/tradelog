import { supabase } from './config.js';
import { getUser } from './auth.js';
import { toLocalDateStr } from './utils.js';

// ─── Trades ──────────────────────────────────────────────────

export async function fetchTrades({ year, month } = {}) {
  const user = getUser();
  if (!user) return [];

  let query = supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('trade_date', { ascending: false });

  if (year && month !== undefined) {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = toLocalDateStr(new Date(year, month + 1, 0));
    query = query.gte('trade_date', from).lte('trade_date', to);
  } else if (year) {
    query = query.gte('trade_date', `${year}-01-01`).lte('trade_date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function fetchAllTrades() {
  const user = getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('trade_date', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function insertTrade(trade) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('trades')
    .insert([{ ...trade, user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTrade(id, updates) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTrade(id) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

// ─── Journal Notes ───────────────────────────────────────────

export async function fetchNotes() {
  const user = getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('journal_notes')
    .select('*')
    .eq('user_id', user.id)
    .order('note_date', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function upsertNote(note) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('journal_notes')
    .upsert([{ ...note, user_id: user.id }], { onConflict: 'user_id,note_date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(id) {
  const user = getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('journal_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) throw error;
}

// ─── Aggregation helpers ─────────────────────────────────────

export function aggregateByDate(trades) {
  // Returns { 'YYYY-MM-DD': { pnl, count, wins, losses, result } }
  // result is 'win' | 'loss' | 'be'. Trades tagged BE don't decide the day
  // (a break-even that cost fees is still a BE day); only the other trades' P&L does.
  const map = {};
  for (const t of trades) {
    const d = t.trade_date;
    if (!map[d]) map[d] = { pnl: 0, count: 0, wins: 0, losses: 0, decisivePnl: 0, decisiveCount: 0 };
    const pnl = parseFloat(t.pnl) || 0;
    map[d].pnl += pnl;
    map[d].count++;
    if (pnl > 0) map[d].wins++;
    else if (pnl < 0) map[d].losses++;
    if (t.outcome !== 'BE') {
      map[d].decisivePnl += pnl;
      map[d].decisiveCount++;
    }
  }
  for (const day of Object.values(map)) {
    const p = Math.round(day.decisivePnl * 100); // cents, avoids float residue
    day.result = !day.decisiveCount || p === 0 ? 'be' : p > 0 ? 'win' : 'loss';
  }
  return map;
}

export function countOutcomes(trades) {
  // Returns { TP, SL, BE, untagged, total, pnl }
  const c = { TP: 0, SL: 0, BE: 0, untagged: 0, total: trades.length, pnl: 0 };
  for (const t of trades) {
    if (['TP', 'SL', 'BE'].includes(t.outcome)) c[t.outcome]++;
    else c.untagged++;
    c.pnl += parseFloat(t.pnl) || 0;
  }
  return c;
}

export function computeStats(trades) {
  if (!trades.length) return null;
  const pnls = trades.map(t => parseFloat(t.pnl) || 0);
  const totalPnl = pnls.reduce((a, b) => a + b, 0);
  const wins = pnls.filter(p => p > 0);
  const losses = pnls.filter(p => p < 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
  const profitFactor = losses.length ? Math.abs(wins.reduce((a, b) => a + b, 0) / losses.reduce((a, b) => a + b, 0)) : Infinity;

  // Running equity curve
  let running = 0;
  const equity = trades.slice().reverse().map(t => {
    running += parseFloat(t.pnl) || 0;
    return { date: t.trade_date, equity: running };
  });

  // Max drawdown
  let peak = 0, maxDD = 0;
  for (const { equity: eq } of equity) {
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDD) maxDD = dd;
  }

  return { totalPnl, totalTrades: trades.length, wins: wins.length, losses: losses.length, winRate, avgWin, avgLoss, profitFactor, maxDrawdown: maxDD, equity };
}
