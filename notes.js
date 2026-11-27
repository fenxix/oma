import { tx, wrap, dbAll } from './database.js';
import { icon, toast, esc, shortDate, hhmm, store } from './utils.js';

const list = async () => (await dbAll('notes')).sort((a, b) => b.updatedAt - a.updatedAt);
const save = n => tx(['notes'], async N => {
  const now = Date.now();
  if (n.id) return wrap(N.put({ ...(await wrap(N.get(n.id))), ...n, updatedAt: now }));
  return wrap(N.add({ tableId: null, ...n, createdAt: now, updatedAt: now }));
});
const del = id => tx(['notes'], N => wrap(N.delete(id)));

export async function renderNotes() {
  const ns = await list();
  const head = `<div class="row"><h1 class="h1">Заметки</h1><button class="mini" data-go="more">Назад</button></div><button class="btn" style="margin:12px 0" data-anote>+ Заметка</button>`;
  if (!ns.length) return head + `<div class="card"><div class="empty">${icon('note')}<b>Заметок нет</b><p>Например: «Не забыть проверить стол 3».</p></div></div>`;
  return head + ns.map(n => `<button class="card ocard nbtn" data-enote="${n.id}"><div class="row"><b>${esc(n.title || 'Без заголовка')}</b><span class="sub">${shortDate(n.updatedAt)}, ${hhmm(n.updatedAt)}</span></div>
    ${n.text ? `<p class="sub">${esc(n.text)}</p>` : ''}${n.tableNumber ? `<span class="pill" style="margin-top:6px">Стол ${esc(n.tableNumber)}</span>` : ''}</button>`).join('');
}

function noteSheet(n, refresh) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet"><div class="row"><b>${n ? 'Заметка' : 'Новая заметка'}</b><button class="x" data-c aria-label="Закрыть">${icon('x')}</button></div>
    <input id="nt" value="${esc(n?.title || '')}" placeholder="Заголовок">
    <textarea id="nx" rows="4" placeholder="Текст">${esc(n?.text || '')}</textarea>
    <input id="nn" type="number" inputmode="numeric" min="1" value="${n?.tableNumber || ''}" placeholder="Номер стола (необязательно)">
    <div class="btns">${n ? '<button class="btn ghost" data-del>Удалить</button>' : '<span></span>'}<button class="btn" data-save>Сохранить</button></div></div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-c]')) bg.remove(); });
  document.body.appendChild(bg);
  const $ = s => bg.querySelector(s);
  $('[data-save]').onclick = async e => {
    const title = $('#nt').value.trim(), text = $('#nx').value.trim();
    if (!title && !text) return toast('Напишите заголовок или текст');
    e.currentTarget.disabled = true;
    await save({ id: n?.id, title, text, tableNumber: +$('#nn').value || null });
    bg.remove(); refresh();
  };
  const d = $('[data-del]');
  if (d) { let sure = false; d.onclick = async () => {
    if (!sure) { sure = true; d.textContent = 'Точно удалить?'; d.classList.add('danger'); return; }
    d.disabled = true; await del(n.id); bg.remove(); toast('Заметка удалена'); refresh();
  }; }
}

export function bindNotes(view, refresh) {
  view.addEventListener('click', async e => {
    if (e.target.closest('[data-anote]')) return noteSheet(null, refresh);
    const b = e.target.closest('[data-enote]');
    if (b) noteSheet((await list()).find(n => n.id === +b.dataset.enote), refresh);
  });
}

// --- Настройки ---
export async function renderSettings() {
  const c = store.get('settings', {});
  return `<div class="row"><h1 class="h1">Настройки</h1><button class="mini" data-go="more">Назад</button></div>
    <div class="card pad" style="margin-top:14px"><label class="lbl" for="sw">Ваше имя</label><input id="sw" value="${esc(c.waiterName || '')}" placeholder="Например: Айгерим">
    <label class="lbl" for="sr">Название ресторана</label><input id="sr" value="${esc(c.restaurantName || '')}">
    <p class="sub">Валюта: тенге (₸). Оплата заработка выбирается на экране смены, пороги таймеров на экране таймеров.</p></div>`;
}
export function bindSettings(view) {
  view.addEventListener('change', e => {
    const k = { sw: 'waiterName', sr: 'restaurantName' }[e.target.id];
    if (!k) return;
    store.set('settings', { ...store.get('settings', {}), [k]: e.target.value.trim() });
    toast('Сохранено');
  });
}
