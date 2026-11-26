import { db, tx, wrap, dbAll } from './database.js';
import { store, toast, icon } from './utils.js';

export const STORES = ['settings', 'tables', 'categories', 'menuItems', 'orders', 'orderItems', 'shifts', 'tips', 'notes'];
const when = t => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

async function snapshot() {
  const data = {};
  for (const s of STORES) data[s] = await dbAll(s);
  return { app: 'oma', format: 1, dbVersion: (await db()).version, exportedAt: Date.now(), settings: store.get('settings', {}), data };
}

// Локальная автокопия (одна, перезаписывается). Раз в сутки и перед каждым восстановлением.
export async function autoBackup(force = false) {
  const last = store.get('localBackup', null);
  if (!force && last && Date.now() - last.at < 864e5) return;
  const snap = await snapshot();
  if (!snap.data.tables.length && !snap.data.orders.length && !snap.data.shifts.length) return;
  store.set('localBackup', { at: snap.exportedAt, snap });
}

// Проверка файла до любых изменений базы
function validate(o, curVersion) {
  if (!o || o.app !== 'oma' || typeof o.data !== 'object' || !o.data) return 'Это не файл резервной копии OMA';
  if (!(o.dbVersion <= curVersion)) return 'Копия сделана в более новой версии приложения';
  for (const s of STORES) {
    const a = o.data[s];
    if (!Array.isArray(a)) return `В файле нет раздела «${s}»`;
    if (a.some(r => !r || typeof r !== 'object' || !Number.isFinite(r.id))) return `Повреждены данные в разделе «${s}»`;
  }
  return null;
}

async function restore(snap) {
  await autoBackup(true); // сначала сохраняем текущую базу
  await tx(STORES, async (...S) => {
    for (let i = 0; i < S.length; i++) {
      await wrap(S[i].clear());
      for (const rec of snap.data[STORES[i]]) await wrap(S[i].put(rec));
    }
  });
  store.set('settings', snap.settings || {});
}

async function downloadBackup() {
  const blob = new Blob([JSON.stringify(await snapshot())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `oma-backup-${new Date().toLocaleDateString('sv-SE')}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  store.set('lastBackup', Date.now());
}

export async function renderBackup() {
  const last = store.get('lastBackup', null), loc = store.get('localBackup', null);
  return `<div class="row"><h1 class="h1">Резервная копия</h1><button class="mini" data-go="more">Назад</button></div>
    <div class="card pad" style="margin-top:14px"><b>Скачанная копия</b>
      <p class="sub" style="margin:4px 0 10px">${last ? 'Последняя: ' + when(last) : 'Вы ещё не скачивали копию'}</p>
      <p class="sub warn" style="margin-bottom:12px">Автокопия на телефоне не спасёт при его потере. Скачивайте файл и храните отдельно: в почте, облаке или на компьютере.</p>
      <button class="btn" data-bdl>Скачать копию (JSON)</button></div>
    <div class="card pad" style="margin-top:10px"><b>Восстановление</b>
      <p class="sub" style="margin:4px 0 12px">Перед восстановлением текущие данные сохраняются автоматически.</p>
      <label class="btn ghost filebtn">Восстановить из файла<input id="bf" type="file" accept=".json,application/json" hidden></label>
      ${loc ? `<button class="btn ghost" data-bloc style="margin-top:8px">Из локальной копии · ${when(loc.at)}</button>` : ''}</div>`;
}

function confirmRestore(snap, refresh) {
  const d = snap.data, bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet"><div class="row"><b>Восстановить данные?</b><button class="x" data-c aria-label="Закрыть">${icon('x')}</button></div>
    <p class="sub" style="margin:10px 0">Копия от ${when(snap.exportedAt)}: столов ${d.tables.length}, заказов ${d.orders.length}, смен ${d.shifts.length}.</p>
    <p class="sub warn">Текущие данные будут заменены. Их копия сохранится на телефоне.</p>
    <div class="btns eq"><button class="btn ghost" data-c>Отмена</button><button class="btn" data-go-restore>Восстановить</button></div></div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-c]')) bg.remove(); });
  bg.querySelector('[data-go-restore]').onclick = async e => {
    e.currentTarget.disabled = true;
    try { await restore(snap); bg.remove(); toast('Данные восстановлены'); refresh(); }
    catch { bg.remove(); toast('Не удалось восстановить. Данные не изменены', 4000); }
  };
  document.body.appendChild(bg);
}

export function bindBackup(view, refresh) {
  view.addEventListener('click', async e => {
    if (e.target.closest('[data-bdl]')) { await downloadBackup(); toast('Файл копии сохранён'); return refresh(); }
    if (e.target.closest('[data-bloc]')) { const l = store.get('localBackup', null); if (l) confirmRestore(l.snap, refresh); }
  });
  view.addEventListener('change', async e => {
    if (e.target.id !== 'bf') return;
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    let o;
    try { o = JSON.parse(await f.text()); } catch { return toast('Файл повреждён: не удалось прочитать', 4000); }
    const err = validate(o, (await db()).version);
    if (err) return toast(err, 4000);
    confirmRestore(o, refresh);
  });
}
