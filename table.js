import { icon, toast, esc, hhmm } from './utils.js';
import { getActiveOrders, cycleItem, closeOrder, LABEL } from './orders.js';

// Окно стола: позиции заказа, статусы, добавить, закрыть стол
export function openTable(number, onChange, onAdd) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  let sure = false;
  const close = () => { bg.remove(); onChange(); };

  async function draw() {
    const o = (await getActiveOrders()).find(x => x.tableNumber === number);
    if (!o) return close();
    const left = o.items.filter(i => i.status !== 'served').length;
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="Стол ${esc(number)}">
      <div class="row"><div><b>Стол ${esc(number)}</b><div class="sub">с ${hhmm(o.createdAt)} · не подано: ${left}</div></div>
        <button class="x" data-close aria-label="Закрыть">${icon('x')}</button></div>
      <div class="oitems">${o.items.map(i => `<div class="oi"><div class="grow">${esc(i.nameSnapshot)}${i.quantity > 1 ? ` <span class="sub">× ${i.quantity}</span>` : ''}
        ${i.comment ? `<div class="sub">${esc(i.comment)}</div>` : ''}</div>
        <button class="stb s-${i.status}" data-cycle="${i.id}">${LABEL[i.status]}</button></div>`).join('')}</div>
      ${o.comment ? `<p class="sub">${esc(o.comment)}</p>` : ''}
      <div class="btns"><button class="btn ghost" data-add>Добавить</button>
        <button class="btn ${sure ? 'danger' : ''}" data-done>${sure ? (left ? `Не подано: ${left}. Закрыть?` : 'Точно закрыть?') : 'Закрыть стол'}</button></div></div>`;
    bg.dataset.oid = o.id;
  }

  bg.addEventListener('click', async e => {
    if (e.target === bg || e.target.closest('[data-close]')) return close();
    const c = e.target.closest('[data-cycle]');
    if (c) { await cycleItem(+c.dataset.cycle); sure = false; return draw(); }
    if (e.target.closest('[data-add]')) { bg.remove(); return onAdd(); }
    if (e.target.closest('[data-done]')) {
      if (!sure) { sure = true; return draw(); }
      await closeOrder(+bg.dataset.oid); toast(`Стол ${number} закрыт`); close();
    }
  });
  document.body.appendChild(bg);
  draw();
}
