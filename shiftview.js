import { icon, toast, store, esc, hhmm, money, dur, shortDate } from './utils.js';
import { activeShift, startShift, shiftStats, addTip, endShift, pastShifts } from './shifts.js';
import { getActiveOrders } from './orders.js';

const head = (t, s = '') => `<h1 class="h1">${t}</h1>${s ? `<p class="sub">${s}</p>` : ''}`;
const cfg = () => store.get('settings', {});
const typeText = (t, v) => t === 'percent' ? `${v}% от продаж` : `${money(v)} за смену`;

export async function renderShift() {
  const sh = await activeShift();
  if (!sh) {
    const c = cfg(), type = c.salaryType || 'fixed';
    return head('Смена', 'Смена не начата') + `<div class="card pad" style="margin-top:14px">
      <p class="lbl">Как считать заработок</p>
      <div class="seg" role="group"><button data-stype="fixed" aria-pressed="${type === 'fixed'}">Фикс за смену</button><button data-stype="percent" aria-pressed="${type === 'percent'}">% от продаж</button></div>
      <label class="lbl" for="sv">${type === 'fixed' ? 'Сумма за смену, ₸' : 'Процент от продаж, %'}</label>
      <input id="sv" type="number" inputmode="decimal" min="0" value="${c.salaryValue ?? ''}">
      <button class="btn" data-sstart>Начать смену</button></div>
      <p class="sub" style="margin-top:10px">Оплаты засчитываются в продажи только во время смены.</p>`;
  }
  const s = await shiftStats(sh);
  const cells = [['Время', `<span data-since="${sh.startedAt}">${dur(Date.now() - sh.startedAt)}</span>`], ['Заказов', s.orders], ['Столов', s.tables], ['Продажи', money(s.sales)], ['Чаевые', money(s.tips)], ['Заработок', money(s.earn)]];
  return head('Смена', `Начало в ${hhmm(sh.startedAt)} · ${typeText(sh.salaryType, sh.salaryValue)}`) +
    `<div class="sgrid">${cells.map(([l, v]) => `<div class="card sc"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <p class="sub">Заработок без чаевых, чаевые считаются отдельно.</p>
    <div class="btns eq" style="margin-top:14px"><button class="btn ghost" data-stip>Чаевые</button><button class="btn" data-send>Завершить</button></div>`;
}

export async function renderHistory() {
  const list = await pastShifts();
  const back = `<button class="mini" data-go="more">Назад</button>`;
  if (!list.length) return `<div class="row">${head('История смен')}${back}</div><div class="card" style="margin-top:14px"><div class="empty">${icon('clock')}<b>Завершённых смен нет</b><p>Здесь появятся смены после их завершения.</p></div></div>`;
  return `<div class="row">${head('История смен')}${back}</div><div class="list">${list.map(s => `
    <div class="card ocard"><div class="row"><b>${shortDate(s.startedAt)}</b><span class="sub">${dur(s.duration)} · заказов: ${s.orderCount}</span></div>
    <div class="hrow"><span>Продажи <b>${money(s.totalSales)}</b></span><span>Чаевые <b>${money(s.tips)}</b></span><span>Заработок <b>${money(s.earnings)}</b></span></div></div>`).join('')}</div>`;
}

function sheet(html) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-c]')) bg.remove(); });
  document.body.appendChild(bg);
  return bg;
}
const xb = `<button class="x" data-c aria-label="Закрыть">${icon('x')}</button>`;

async function tipSheet(refresh) {
  const bg = sheet(`<div class="row"><b>Чаевые</b>${xb}</div>
    <input id="ta" type="number" inputmode="decimal" min="1" placeholder="Сумма, ₸">
    <div class="btns eq"><button class="btn" data-m="cash">Наличные</button><button class="btn" data-m="card">Карта</button></div>`);
  bg.querySelector('#ta').focus();
  bg.addEventListener('click', async e => {
    const m = e.target.closest('[data-m]');
    if (!m) return;
    const amount = +bg.querySelector('#ta').value, sh = await activeShift();
    if (!(amount > 0) || !sh) return toast('Введите сумму чаевых');
    m.disabled = true;
    await addTip(sh.id, amount, m.dataset.m);
    bg.remove(); toast('Чаевые добавлены'); refresh();
  });
}

async function endSheet(refresh) {
  const sh = await activeShift(); if (!sh) return;
  const s = await shiftStats(sh), open = (await getActiveOrders()).length, now = Date.now();
  const rows = [['Начало', hhmm(sh.startedAt)], ['Окончание', hhmm(now)], ['Длительность', dur(now - sh.startedAt)], ['Заказов', s.orders], ['Продажи', money(s.sales)], ['Чаевые', money(s.tips)], ['Заработок', money(s.earn)]];
  const bg = sheet(`<div class="row"><b>Итоги смены</b>${xb}</div>
    <div class="sumr">${rows.map(([l, v]) => `<div class="row"><span class="sub">${l}</span><b>${v}</b></div>`).join('')}</div>
    ${open ? `<p class="sub warn">Открытых столов: ${open}. Они не попадут в продажи, пока не оплачены.</p>` : ''}
    <div class="btns eq"><button class="btn ghost" data-c>Отмена</button><button class="btn" data-fin>Завершить смену</button></div>`);
  bg.querySelector('[data-fin]').onclick = async e => {
    e.currentTarget.disabled = true;
    await endShift(sh); bg.remove(); toast('Смена завершена'); refresh();
  };
}

export function bindShift(view, refresh) {
  view.addEventListener('click', async e => {
    const t = e.target, ty = t.closest('[data-stype]');
    if (ty) { store.set('settings', { ...cfg(), salaryType: ty.dataset.stype }); return refresh(); }
    if (t.closest('[data-sstart]')) {
      const c = cfg(), v = +c.salaryValue;
      if (!(v > 0)) return toast('Укажите оплату: сумму или процент');
      toast((await startShift(c.salaryType || 'fixed', v)) ? 'Смена началась' : 'Смена уже идёт');
      return refresh();
    }
    if (t.closest('[data-stip]')) return tipSheet(refresh);
    if (t.closest('[data-send]')) return endSheet(refresh);
  });
  view.addEventListener('input', e => {
    if (e.target.id === 'sv') store.set('settings', { ...cfg(), salaryValue: e.target.value === '' ? '' : +e.target.value });
  });
  // Время смены считается от сохранённой отметки, таймер лишь обновляет текст
  setInterval(() => document.querySelectorAll('[data-since]').forEach(el => { el.textContent = dur(Date.now() - el.dataset.since); }), 30000);
}
