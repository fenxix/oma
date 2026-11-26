import { icon, toast, store, fmtDate, greeting, esc, hhmm } from './utils.js';
import { initRouter } from './router.js';
import { getActiveOrders } from './orders.js';
import { getTables } from './tables.js';
import { renderPlan, bindPlan } from './plan.js';
import { openQuick } from './quick.js';

const NAV = [['hall', 'Зал', 'grid'], ['orders', 'Заказы', 'list'], ['add'], ['shift', 'Смена', 'clock'], ['more', 'Ещё', 'more']];
const view = document.getElementById('view');

const empty = (ic, title, text) => `<div class="empty">${icon(ic)}<b>${title}</b><p>${text}</p></div>`;
const head = (t, s = '') => `<h1 class="h1">${t}</h1>${s ? `<p class="sub">${s}</p>` : ''}`;
const panel = html => `<div class="card" style="margin-top:14px">${html}</div>`;
const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };

const screens = {
  async hall() {
    const mode = store.get('hallMode', 'plan');
    const name = store.get('settings', {}).waiterName || '';
    const orders = await getActiveOrders(), tables = await getTables(), total = tables.length;
    const pos = orders.reduce((s, o) => s + o.items.length, 0);
    const stats = [['Свободно', Math.max(0, total - orders.length)], ['Заняты', orders.length], ['Позиций', pos], ['Готово', 0]];
    let body;
    if (mode === 'plan') body = renderPlan(tables, orders);
    else if (!orders.length) body = empty('list', 'Столов в работе нет', 'Нажмите «+» внизу и запишите первый заказ.');
    else body = `<div class="tables">${orders.map(o => `
      <div class="card tcard" data-open="${esc(o.tableNumber)}"><div class="row"><b>Стол ${esc(o.tableNumber)}</b><span class="st">Принят</span></div>
      <span class="sub">${hhmm(o.createdAt)} · ${o.items.length} ${plural(o.items.length, 'позиция', 'позиции', 'позиций')}</span></div>`).join('')}</div>`;
    return `
      <div class="row"><div>${head(greeting(name), fmtDate(new Date()))}</div>
        <span class="pill"><span class="dot"></span>Смена не начата</span></div>
      <div class="stats">${stats.map(([l, n]) => `<div class="card stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
      <div class="seg" role="group" aria-label="Режим зала">
        <button data-mode="plan" aria-pressed="${mode === 'plan'}">План зала</button>
        <button data-mode="grid" aria-pressed="${mode === 'grid'}">Сетка</button></div>
      ${mode === 'grid' && !orders.length ? `<div class="card">${body}</div>` : body}`;
  },
  async orders() {
    const orders = (await getActiveOrders()).reverse();
    if (!orders.length) return head('Заказы', 'Активные заказы') + panel(empty('list', 'Активных заказов нет', 'Нажмите «+» внизу, чтобы записать заказ.'));
    return head('Заказы', `Активных: ${orders.length}`) + `<div class="list">${orders.map(o => `
      <div class="card ocard"><div class="row"><b>Стол ${esc(o.tableNumber)}</b><span class="sub">${hhmm(o.createdAt)}</span></div>
      <ol>${o.items.map(i => `<li>${esc(i.nameSnapshot)}${i.quantity > 1 ? ` <span class="sub">× ${i.quantity}</span>` : ''}</li>`).join('')}</ol>
      ${o.comment ? `<p class="sub">${esc(o.comment)}</p>` : ''}</div>`).join('')}</div>`;
  },
  shift: () => head('Смена') + panel(empty('clock', 'Смена не начата', 'Начните смену, чтобы считать продажи, чаевые и заработок.')),
  stats: () => head('Статистика') + panel(empty('chart', 'Пока нет данных', 'Статистика строится из ваших заказов и смен.')),
  more() {
    const items = [['chart', 'Статистика', 'stats'], ['menu', 'Моё меню'], ['star', 'Избранное'], ['note', 'Заметки'], ['timer', 'Таймеры'], ['clock', 'История смен'], ['save', 'Резервная копия'], ['gear', 'Настройки']];
    return head('Ещё') + `<div class="list">${items.map(([i, t, go]) =>
      `<button class="card item" ${go ? `data-go="${go}"` : `data-soon="${t}"`}>${icon(i)}<span class="grow">${t}</span>${icon('chev')}</button>`).join('')}</div>`;
  }
};

const nav = document.getElementById('nav');
nav.innerHTML = NAV.map(([id, label, ic]) => id === 'add'
  ? `<button class="add" data-add aria-label="Записать заказ">${icon('plus')}</button>`
  : `<button data-go="${id}">${icon(ic)}<span>${label}</span></button>`).join('');

const router = initRouter(screens, 'hall', async id => {
  view.innerHTML = await screens[id]();
  nav.querySelectorAll('[data-go]').forEach(b => {
    if (b.dataset.go === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
});

document.body.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { location.hash = '#/' + g.dataset.go; return; }
  if (e.target.closest('[data-add]')) { openQuick(() => router.refresh()); return; }
  const op = e.target.closest('[data-open]');
  if (op) { openQuick(() => router.refresh(), +op.dataset.open); return; }
  const m = e.target.closest('[data-mode]');
  if (m) { store.set('hallMode', m.dataset.mode); router.refresh(); return; }
  const s = e.target.closest('[data-soon]');
  if (s) toast(`«${s.dataset.soon}» появится на следующем этапе`);
});

bindPlan(view, () => router.refresh(), n => openQuick(() => router.refresh(), n));

const conn = document.getElementById('conn'), connText = document.getElementById('connText');
const setConn = () => { conn.classList.toggle('off', !navigator.onLine); connText.textContent = navigator.onLine ? 'Онлайн' : 'Офлайн'; };
addEventListener('online', setConn); addEventListener('offline', setConn); setConn();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
