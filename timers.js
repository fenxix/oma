import { getActiveOrders, LABEL } from './orders.js';
import { store, icon, esc, toast } from './utils.js';

// Время считается от сохранённой отметки addedAt, поэтому верно и после сворачивания, и после перезагрузки.
export const limits = () => { const c = store.get('settings', {}); return { warn: +c.timerWarn || 10, long: +c.timerLong || 20 }; };
const level = (m, l) => m >= l.long ? ['long', 'Долго'] : m >= l.warn ? ['warn', 'Внимание'] : ['ok', 'Обычно'];

export async function renderTimers() {
  const l = limits(), now = Date.now();
  const rows = (await getActiveOrders()).flatMap(o => o.items.filter(i => i.status !== 'served').map(i => ({ o, i, m: Math.floor((now - i.addedAt) / 60000) }))).sort((a, b) => b.m - a.m);
  return `<div class="row"><h1 class="h1">Таймеры</h1><button class="mini" data-go="more">Назад</button></div>
    <p class="sub">Время ожидания каждой неподанной позиции. Это ориентир, а не обещание времени приготовления.</p>
    <div class="card pad" style="margin:12px 0"><div class="row"><label class="lbl" for="tw" style="flex:1">Внимание с, мин</label><label class="lbl" for="tl" style="flex:1">Долго с, мин</label></div>
      <div class="row" style="gap:10px"><input id="tw" type="number" inputmode="numeric" min="1" value="${l.warn}"><input id="tl" type="number" inputmode="numeric" min="1" value="${l.long}"></div></div>
    ${rows.length ? rows.map(({ o, i, m }) => { const [k, t] = level(m, l); return `<div class="card trow"><div class="tn">${esc(o.tableNumber)}</div>
      <div class="grow"><b>${esc(i.nameSnapshot)}${i.quantity > 1 ? ` × ${i.quantity}` : ''}</b><div class="sub">Стол ${esc(o.tableNumber)} · ${LABEL[i.status]}</div></div>
      <span class="lv lv-${k}">${m} мин · ${t}</span></div>`; }).join('')
    : `<div class="card"><div class="empty">${icon('timer')}<b>Ждущих позиций нет</b><p>Здесь появятся позиции, которые ещё не поданы.</p></div></div>`}`;
}

export function bindTimers(view, refresh) {
  view.addEventListener('change', e => {
    if (e.target.id !== 'tw' && e.target.id !== 'tl') return;
    const w = Math.floor(+view.querySelector('#tw').value), g = Math.floor(+view.querySelector('#tl').value);
    if (!(w > 0) || !(g > w)) { toast('«Долго» должно быть больше «Внимания»', 3500); return refresh(); }
    store.set('settings', { ...store.get('settings', {}), timerWarn: w, timerLong: g });
    toast('Сохранено'); refresh();
  });
  setInterval(() => { if (location.hash === '#/timers' && !/INPUT/.test(document.activeElement.tagName)) refresh(); }, 30000);
}
