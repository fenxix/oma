import { icon, toast, store, fmtDate, greeting } from './utils.js';
import { initRouter } from './router.js';

const NAV = [['hall', 'Зал', 'grid'], ['orders', 'Заказы', 'list'], ['shift', 'Смена', 'clock'], ['stats', 'Статистика', 'chart'], ['more', 'Ещё', 'more']];
const view = document.getElementById('view');

const empty = (ic, title, text) => `<div class="empty">${icon(ic)}<b>${title}</b><p>${text}</p></div>`;
const head = (t, s = '') => `<h1 class="h1">${t}</h1>${s ? `<p class="sub">${s}</p>` : ''}`;
const panel = html => `<div class="card" style="margin-top:14px">${html}</div>`;

// Данных пока нет (IndexedDB — этап 3), поэтому счётчики честно равны нулю.
const screens = {
  hall() {
    const mode = store.get('hallMode', 'plan');
    const name = store.get('settings', {}).waiterName || '';
    const stats = [['Свободно', 0], ['Заняты', 0], ['Ждут подачи', 0], ['Готово', 0]];
    return `
      <div class="row"><div>${head(greeting(name), fmtDate(new Date()))}</div>
        <span class="pill"><span class="dot"></span>Смена не начата</span></div>
      <div class="stats">${stats.map(([l, n]) => `<div class="card stat"><b>${n}</b><span>${l}</span></div>`).join('')}</div>
      <div class="seg" role="group" aria-label="Режим зала">
        <button data-mode="plan" aria-pressed="${mode === 'plan'}">План зала</button>
        <button data-mode="grid" aria-pressed="${mode === 'grid'}">Сетка</button></div>
      <div class="card">${empty(mode === 'plan' ? 'grid' : 'list', 'Столиков пока нет', mode === 'plan' ? 'Здесь будет схема вашего зала.' : 'Здесь будут карточки столиков.')}</div>`;
  },
  orders: () => head('Заказы', 'Активные заказы') + panel(empty('list', 'Активных заказов нет', 'Заказы появятся здесь, когда вы примете первый.')),
  shift: () => head('Смена') + panel(empty('clock', 'Смена не начата', 'Начните смену, чтобы считать продажи, чаевые и заработок.')),
  stats: () => head('Статистика') + panel(empty('chart', 'Пока нет данных', 'Статистика строится из ваших заказов и смен.')),
  more() {
    const items = [['menu', 'Моё меню'], ['star', 'Избранное'], ['note', 'Заметки'], ['timer', 'Таймеры'], ['clock', 'История смен'], ['save', 'Резервная копия'], ['gear', 'Настройки']];
    return head('Ещё') + `<div class="list">${items.map(([i, t]) =>
      `<button class="card item" data-soon="${t}">${icon(i)}<span class="grow">${t}</span>${icon('chev')}</button>`).join('')}</div>`;
  }
};

const nav = document.getElementById('nav');
nav.innerHTML = NAV.map(([id, label, ic]) => `<button data-go="${id}">${icon(ic)}<span>${label}</span></button>`).join('');
nav.addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) location.hash = '#/' + b.dataset.go;
});

const router = initRouter(screens, 'hall', id => {
  view.innerHTML = screens[id]();
  nav.querySelectorAll('button').forEach(b => {
    if (b.dataset.go === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
});

// Один обработчик на весь экран (делегирование)
view.addEventListener('click', e => {
  const m = e.target.closest('[data-mode]');
  if (m) { store.set('hallMode', m.dataset.mode); router.refresh(); return; }
  const s = e.target.closest('[data-soon]');
  if (s) toast(`«${s.dataset.soon}» появится на следующем этапе`);
});

// Состояние подключения
const conn = document.getElementById('conn'), connText = document.getElementById('connText');
const setConn = () => { conn.classList.toggle('off', !navigator.onLine); connText.textContent = navigator.onLine ? 'Онлайн' : 'Офлайн'; };
addEventListener('online', setConn); addEventListener('offline', setConn); setConn();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
