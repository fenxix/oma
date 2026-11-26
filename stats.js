import { dbAll } from './database.js';
import { store, icon, esc, money, dur, shortDate } from './utils.js';

// Статистика считается только из сохранённых оплат, смен и чаевых.
// Графики нарисованы без внешних библиотек, поэтому работают офлайн.
const DAY = 864e5;
const PER = [['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Всё время']];
const day = t => new Date(t).toLocaleDateString('sv-SE');
const sod = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const fromOf = p => { const s = sod(Date.now()); return p === 'today' ? s : p === 'week' ? s - 6 * DAY : p === 'month' ? s - 29 * DAY : 0; };
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

function keysFor(p, times) {
  const today = sod(Date.now());
  if (p === 'today') return [...Array(24)].map((_, h) => ({ k: h, label: String(h) }));
  if (p === 'week' || p === 'month') {
    const n = p === 'week' ? 7 : 30;
    return [...Array(n)].map((_, i) => {
      const t = today - (n - 1 - i) * DAY, d = new Date(t);
      return { k: day(t), label: p === 'week' ? d.toLocaleDateString('ru-RU', { weekday: 'short' }) : String(d.getDate()) };
    });
  }
  return [...new Set(times.map(day))].sort().slice(-14).map(k => ({ k, label: k.slice(8) + '.' + k.slice(5, 7) }));
}
const keyOf = (p, t) => p === 'today' ? new Date(t).getHours() : day(t);

function series(p, items, times) {
  const m = new Map();
  items.forEach(i => m.set(keyOf(p, i.t), (m.get(keyOf(p, i.t)) || 0) + i.v));
  return keysFor(p, times).map(k => ({ label: k.label, value: m.get(k.k) || 0 }));
}
function bars(data, fmt) {
  const max = Math.max(0, ...data.map(d => d.value));
  if (!max) return '<p class="sub">Нет данных</p>';
  const step = Math.ceil(data.length / 7);
  return `<div class="bars">${data.map((d, i) => `<div class="bar"><i style="height:${Math.max(d.value ? 4 : 0, d.value / max * 100)}%"></i><span>${i % step === 0 ? esc(d.label) : ''}</span></div>`).join('')}</div>
    <div class="sub">Максимум: ${fmt(max)}</div>`;
}
const chart = (title, html) => `<div class="card pad chart"><b>${title}</b>${html}</div>`;
const top = (title, rows, fmt) => rows.length ? `<div class="card pad"><b>${title}</b><ol class="top">${rows.map(([n, v]) => `<li><span>${esc(n)}</span><b>${fmt(v)}</b></li>`).join('')}</ol></div>` : '';

export async function renderStats() {
  const p = store.get('statPeriod', 'week'), from = fromOf(p), now = Date.now();
  const [allOrders, allItems, allShifts, allTips] = await Promise.all([dbAll('orders'), dbAll('orderItems'), dbAll('shifts'), dbAll('tips')]);
  const paidAll = allOrders.filter(o => o.status === 'paid');
  const orders = paidAll.filter(o => o.paidAt >= from);
  const shifts = allShifts.filter(s => s.startedAt >= from);
  const tips = allTips.filter(t => t.createdAt >= from);
  const seg = `<div class="seg four" role="group" aria-label="Период">${PER.map(([k, l]) => `<button data-period="${k}" aria-pressed="${p === k}">${l}</button>`).join('')}</div>`;
  const head = `<h1 class="h1">Статистика</h1>${seg}`;
  if (!orders.length && !shifts.length && !tips.length)
    return head + `<div class="card"><div class="empty">${icon('chart')}<b>Пока нет данных</b><p>За этот период нет оплаченных заказов и смен.</p></div></div>`;

  const sales = sum(orders, o => o.total || 0), ended = shifts.filter(s => s.endedAt);
  const work = sum(shifts, s => s.endedAt ? s.duration : now - s.startedAt);
  const tiles = [['Продажи', money(sales)], ['Заказов', orders.length], ['Столов обслужено', new Set(orders.map(o => o.tableId)).size],
    ['Средний чек', orders.length ? money(sales / orders.length) : '—'], ['Чаевые', money(sum(tips, t => t.amount))], ['Рабочее время', dur(work)],
    ['Заработок за смену', ended.length ? money(sum(ended, s => s.earnings || 0) / ended.length) : '—']];

  const times = [...orders.map(o => o.paidAt), ...tips.map(t => t.createdAt)];
  const salesS = series(p, orders.map(o => ({ t: o.paidAt, v: o.total || 0 })), times);
  const tipsS = series(p, tips.map(t => ({ t: t.createdAt, v: t.amount })), times);
  const cntS = series(p, orders.map(o => ({ t: o.paidAt, v: 1 })), times);
  const earnS = ended.sort((a, b) => a.startedAt - b.startedAt).slice(-14).map(s => ({ label: shortDate(s.startedAt), value: s.earnings || 0 }));

  const ids = new Set(orders.map(o => o.id)), byName = new Map();
  allItems.filter(i => ids.has(i.orderId)).forEach(i => {
    const k = i.nameSnapshot.trim().toLowerCase(), r = byName.get(k) || { n: i.nameSnapshot, q: 0, s: 0 };
    r.q += i.quantity; r.s += (i.priceSnapshot || 0) * i.quantity; byName.set(k, r);
  });
  const rows = [...byName.values()];
  const popular = rows.sort((a, b) => b.q - a.q).slice(0, 5).map(r => [r.n, r.q]);
  const profit = rows.filter(r => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 5).map(r => [r.n, r.s]);

  const perDay = new Map();
  orders.forEach(o => perDay.set(day(o.paidAt), (perDay.get(day(o.paidAt)) || 0) + (o.total || 0)));
  const best = [...perDay].sort((a, b) => b[1] - a[1])[0];

  const t0 = sod(now), cur = sum(paidAll.filter(o => o.paidAt >= t0 - 6 * DAY), o => o.total || 0);
  const prev = sum(paidAll.filter(o => o.paidAt >= t0 - 13 * DAY && o.paidAt < t0 - 6 * DAY), o => o.total || 0);
  const diff = prev ? Math.round((cur - prev) / prev * 100) : null;

  return head + `<div class="sgrid">${tiles.map(([l, v]) => `<div class="card sc"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    ${chart('Продажи', bars(salesS, money))}${chart('Чаевые', bars(tipsS, money))}${chart('Количество заказов', bars(cntS, String))}
    ${earnS.length ? chart('Заработок по сменам', bars(earnS, money)) : ''}
    ${top('Популярные блюда (штук)', popular, String)}${top('Самые прибыльные позиции', profit, money)}
    ${best ? `<div class="card pad"><b>Самый результативный день</b><p class="sub">${shortDate(best[0] + 'T12:00:00')} — ${money(best[1])}</p></div>` : ''}
    <div class="card pad"><b>Неделя к неделе</b><p class="sub">Последние 7 дней: ${money(cur)}<br>Предыдущие 7 дней: ${money(prev)}${diff === null ? '' : ` (${diff > 0 ? '+' : ''}${diff}%)`}</p></div>`;
}

export function bindStats(view, refresh) {
  view.addEventListener('click', e => {
    const b = e.target.closest('[data-period]');
    if (b) { store.set('statPeriod', b.dataset.period); refresh(); }
  });
}
