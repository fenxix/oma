import { icon, toast, esc, hhmm, money } from './utils.js';
import { getActiveOrders, cycleItem, updateItem, deleteItem, payOrder, LABEL } from './orders.js';

// Окно стола: список позиций → правка позиции → оплата
export function openTable(number, onChange, onAdd) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  let view = 'list', eid = null, qty = 1, delSure = false;
  const close = () => { bg.remove(); onChange(); };
  const xbtn = (a, l) => `<button class="x" ${a} aria-label="${l}">${icon('x')}</button>`;

  async function draw() {
    const o = (await getActiveOrders()).find(x => x.tableNumber === number);
    if (!o) return close();
    bg.dataset.oid = o.id; bg.dataset.total = o.total;
    const left = o.items.filter(i => i.status !== 'served').length;
    let h;
    if (view === 'edit') {
      const i = o.items.find(x => x.id === eid);
      if (!i) { view = 'list'; return draw(); }
      h = `<div class="row"><b>Позиция</b>${xbtn('data-back', 'Назад')}</div>
        <label class="lbl" for="en">Название</label><input id="en" value="${esc(i.nameSnapshot)}">
        <label class="lbl">Количество</label>
        <div class="step"><button class="mini" data-q="-1" aria-label="Меньше">−</button><b id="eq">${qty}</b><button class="mini" data-q="1" aria-label="Больше">+</button></div>
        <label class="lbl" for="ep">Цена за штуку, ₸</label><input id="ep" type="number" inputmode="decimal" min="0" value="${i.priceSnapshot || ''}" placeholder="0">
        <label class="lbl" for="ec">Комментарий</label><input id="ec" value="${esc(i.comment || '')}" placeholder="Например: без лука">
        <div class="btns"><button class="btn ghost ${delSure ? 'danger' : ''}" data-del>${delSure ? 'Точно?' : 'Удалить'}</button><button class="btn" data-save>Сохранить</button></div>`;
    } else if (view === 'pay') {
      h = `<div class="row"><b>Оплата · стол ${esc(number)}</b>${xbtn('data-back', 'Назад')}</div>
        <div class="total">К оплате: ${money(o.total)}</div>
        ${o.total ? '' : '<p class="sub">Цены не указаны. Их можно добавить в позициях.</p>'}
        ${left ? `<p class="sub warn">Не подано позиций: ${left}</p>` : ''}
        <div class="btns eq"><button class="btn" data-pay="cash">Наличные</button><button class="btn" data-pay="card">Карта</button></div>`;
    } else {
      h = `<div class="row"><div><b>Стол ${esc(number)}</b><div class="sub">с ${hhmm(o.createdAt)} · не подано: ${left}${o.total ? ' · ' + money(o.total) : ''}</div></div>${xbtn('data-close', 'Закрыть')}</div>
        <div class="oitems">${o.items.map(i => `<div class="oi"><button class="grow ibtn" data-edit="${i.id}">${esc(i.nameSnapshot)}${i.quantity > 1 ? ` <span class="sub">× ${i.quantity}</span>` : ''}
          ${i.priceSnapshot ? `<div class="sub">${money(i.priceSnapshot * i.quantity)}</div>` : ''}${i.comment ? `<div class="sub">${esc(i.comment)}</div>` : ''}</button>
          <button class="stb s-${i.status}" data-cycle="${i.id}">${LABEL[i.status]}</button></div>`).join('')}</div>
        ${o.comment ? `<p class="sub">${esc(o.comment)}</p>` : ''}
        <div class="btns"><button class="btn ghost" data-add>Добавить</button><button class="btn" data-topay>Рассчитать</button></div>`;
    }
    bg.innerHTML = `<div class="sheet" role="dialog" aria-label="Стол ${esc(number)}">${h}</div>`;
  }

  bg.addEventListener('click', async e => {
    const t = e.target, $ = s => bg.querySelector(s);
    if (t === bg || t.closest('[data-close]')) return close();
    if (t.closest('[data-back]')) { view = 'list'; delSure = false; return draw(); }
    const c = t.closest('[data-cycle]');
    if (c) { await cycleItem(+c.dataset.cycle); return draw(); }
    const ed = t.closest('[data-edit]');
    if (ed) {
      eid = +ed.dataset.edit; view = 'edit'; delSure = false;
      const o = (await getActiveOrders()).find(x => x.tableNumber === number);
      qty = o.items.find(i => i.id === eid)?.quantity || 1;
      return draw();
    }
    const q = t.closest('[data-q]');
    if (q) { qty = Math.max(1, qty + +q.dataset.q); $('#eq').textContent = qty; return; }
    if (t.closest('[data-save]')) {
      const name = $('#en').value.trim();
      if (!name) return toast('Введите название');
      await updateItem(eid, { nameSnapshot: name, quantity: qty, priceSnapshot: Math.max(0, +$('#ep').value || 0), comment: $('#ec').value.trim() });
      view = 'list'; return draw();
    }
    if (t.closest('[data-del]')) {
      if (!delSure) { delSure = true; return draw(); }
      await deleteItem(eid); toast('Позиция удалена'); view = 'list'; delSure = false; return draw();
    }
    if (t.closest('[data-add]')) { bg.remove(); return onAdd(); }
    if (t.closest('[data-topay]')) { view = 'pay'; return draw(); }
    const p = t.closest('[data-pay]');
    if (p) {
      p.disabled = true; // защита от двойного нажатия
      await payOrder(+bg.dataset.oid, p.dataset.pay, +bg.dataset.total);
      toast(`Стол ${number} оплачен: ${p.dataset.pay === 'cash' ? 'наличные' : 'карта'}`); close();
    }
  });
  document.body.appendChild(bg);
  draw();
}
