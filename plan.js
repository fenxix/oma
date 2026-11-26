import { toast, esc } from './utils.js';
import { getTables, addTable, updateTable, deleteTable } from './tables.js';
import { getActiveOrders } from './orders.js';

export const st = { edit: false, sel: null, del: false };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const SHAPES = [['square', 'Квадрат'], ['round', 'Круг'], ['wide', 'Длинный']];
const dims = (shape, base) => ({ height: base, width: shape === 'wide' ? Math.round(base * 1.6) : base });

export function renderPlan(tables, orders) {
  const busy = new Map(orders.map(o => [o.tableId, o]));
  const sel = tables.find(t => t.id === st.sel);
  const cells = tables.map(t => {
    const o = busy.get(t.id);
    return `<div class="tbl ${t.shape} ${o ? 'busy' : ''} ${t.id === st.sel && st.edit ? 'sel' : ''}" data-id="${t.id}" data-num="${t.number}"
      style="left:${t.positionX}%;top:${t.positionY}%;width:${t.width}px;height:${t.height}px"><b>${esc(t.number)}</b><small>${o ? o.items.length + ' поз.' : 'свободен'}</small></div>`;
  }).join('');
  const hint = tables.length ? '' : `<div class="plan-empty"><b>Зал пуст</b><p>Нажмите «Расставить», затем «+ Стол», и двигайте столы пальцем.</p></div>`;
  const tool = st.edit && sel ? `
    <div class="card tool">
      <label class="tnum">№ <input id="tnum" type="number" inputmode="numeric" min="1" value="${sel.number}"></label>
      <div class="tgroup">${SHAPES.map(([k, l]) => `<button class="mini ${sel.shape === k ? 'on' : ''}" data-shape="${k}">${l}</button>`).join('')}</div>
      <div class="tgroup"><button class="mini" data-size="-1" aria-label="Меньше">−</button><button class="mini" data-size="1" aria-label="Больше">+</button>
      <button class="mini del ${st.del ? 'on' : ''}" data-pdel>${st.del ? 'Точно удалить?' : 'Удалить'}</button></div>
    </div>` : (st.edit && tables.length ? '<p class="sub" style="margin-top:10px">Нажмите на стол, чтобы изменить его, и перетащите, чтобы передвинуть.</p>' : '');
  return `<div class="row phead"><span class="sub">${tables.length ? `Столов: ${tables.length}` : ''}</span>
    <div class="tgroup">${st.edit ? '<button class="mini" data-padd>+ Стол</button>' : ''}<button class="mini ${st.edit ? 'on' : ''}" data-pedit>${st.edit ? 'Готово' : 'Расставить'}</button></div></div>
    <div class="plan ${st.edit ? 'edit' : ''}" id="plan">${cells}${hint}</div>${tool}`;
}

// Один набор обработчиков на экран (делегирование). refresh — перерисовать зал, openTable — записать заказ на стол.
export function bindPlan(view, refresh, openTable) {
  let drag = null;
  const cur = async () => (await getTables()).find(t => t.id === st.sel);

  view.addEventListener('click', async e => {
    if (e.target.closest('[data-pedit]')) { st.edit = !st.edit; st.sel = null; st.del = false; return refresh(); }
    if (e.target.closest('[data-padd]')) { st.sel = (await addTable()).id; st.del = false; return refresh(); }
    const tbl = e.target.closest('.tbl');
    if (tbl && !st.edit) return openTable(+tbl.dataset.num);
    const t = st.sel && await cur();
    if (!t) return;
    const sh = e.target.closest('[data-shape]');
    if (sh) { await updateTable(t.id, { shape: sh.dataset.shape, ...dims(sh.dataset.shape, t.height) }); return refresh(); }
    const sz = e.target.closest('[data-size]');
    if (sz) { await updateTable(t.id, dims(t.shape, clamp(t.height + 8 * +sz.dataset.size, 44, 120))); return refresh(); }
    if (e.target.closest('[data-pdel]')) {
      if (!st.del) { st.del = true; return refresh(); }
      if ((await getActiveOrders()).some(o => o.tableId === t.id)) { st.del = false; toast('Сначала закройте заказ этого стола'); return refresh(); }
      await deleteTable(t.id); st.sel = null; st.del = false; toast('Стол удалён'); refresh();
    }
  });

  view.addEventListener('change', async e => {
    if (e.target.id !== 'tnum') return;
    const n = Math.floor(+e.target.value), t = await cur();
    if (!t) return;
    if (!(n > 0) || (await getTables()).some(x => x.id !== t.id && x.number === n)) toast('Такой номер уже занят');
    else await updateTable(t.id, { number: n });
    refresh();
  });

  view.addEventListener('pointerdown', e => {
    const el = e.target.closest('.tbl');
    if (!st.edit || !el) return;
    drag = { el, id: +el.dataset.id, r: el.parentElement.getBoundingClientRect(), moved: false };
    el.setPointerCapture(e.pointerId);
    if (st.sel !== drag.id) { st.sel = drag.id; st.del = false; }
  });
  view.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.x = clamp((e.clientX - drag.r.left) / drag.r.width * 100, 5, 95);
    drag.y = clamp((e.clientY - drag.r.top) / drag.r.height * 100, 5, 95);
    drag.moved = true;
    drag.el.style.left = drag.x + '%'; drag.el.style.top = drag.y + '%';
  });
  const end = async () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.moved) await updateTable(d.id, { positionX: d.x, positionY: d.y });
    refresh();
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);
}
