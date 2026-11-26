import { icon, toast, esc, money } from './utils.js';
import { getCategories, getAllDishes, saveCategory, deleteCategory, saveDish, deleteDish, toggleFav } from './menu.js';

const xb = `<button class="x" data-c aria-label="Закрыть">${icon('x')}</button>`;
function sheet(html) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-c]')) bg.remove(); });
  document.body.appendChild(bg);
  return bg;
}
// Удаление в два нажатия: первое меняет подпись кнопки
function twoTap(btn, text, action) {
  let sure = false;
  btn.onclick = async () => {
    if (!sure) { sure = true; btn.textContent = text; btn.classList.add('danger'); return; }
    btn.disabled = true; await action();
  };
}

export async function renderMenu() {
  const cats = await getCategories(), dishes = await getAllDishes();
  const head = `<div class="row"><h1 class="h1">Моё меню</h1><button class="mini" data-go="more">Назад</button></div>
    <p class="sub">Блюда из меню подсказываются при записи заказа, цена подставляется сама. ★ — избранное, оно показывается первым.</p>
    <button class="btn" style="margin:12px 0" data-acat>+ Категория</button>`;
  if (!cats.length) return head + `<div class="card"><div class="empty">${icon('menu')}<b>Меню пусто</b><p>Создайте первую категорию, например «Напитки», и добавьте в неё блюда.</p></div></div>`;
  return head + cats.map(c => {
    const ds = dishes.filter(d => d.categoryId === c.id);
    return `<div class="card pad" style="margin-bottom:10px"><div class="row"><b>${esc(c.name)}</b><button class="mini" data-ecat="${c.id}">Изменить</button></div>
      ${ds.map(d => `<div class="dish"><button class="grow ibtn" data-edish="${d.id}">${esc(d.name)}${d.isAvailable === false ? ' <span class="sub">· скрыто</span>' : ''}
        <div class="sub">${d.price ? money(d.price) : 'цена не указана'}</div></button>
        <button class="star" data-fav="${d.id}" aria-pressed="${!!d.isFavorite}" aria-label="Избранное">${icon('star')}</button></div>`).join('')}
      <button class="mini" style="margin-top:8px" data-adish="${c.id}">+ Блюдо</button></div>`;
  }).join('');
}

async function catSheet(cat, refresh) {
  const bg = sheet(`<div class="row"><b>${cat ? 'Категория' : 'Новая категория'}</b>${xb}</div>
    <input id="cn" value="${esc(cat?.name || '')}" placeholder="Например: Напитки">
    <div class="btns">${cat ? '<button class="btn ghost" data-del>Удалить</button>' : '<span></span>'}<button class="btn" data-save>Сохранить</button></div>`);
  bg.querySelector('[data-save]').onclick = async e => {
    const name = bg.querySelector('#cn').value.trim();
    if (!name) return toast('Введите название');
    e.currentTarget.disabled = true;
    await saveCategory({ id: cat?.id, name }); bg.remove(); refresh();
  };
  const del = bg.querySelector('[data-del]');
  if (del) twoTap(del, 'Удалить с блюдами?', async () => { await deleteCategory(cat.id); bg.remove(); toast('Категория удалена'); refresh(); });
}

async function dishSheet(dish, catId, refresh) {
  const cats = await getCategories();
  const bg = sheet(`<div class="row"><b>${dish ? 'Блюдо' : 'Новое блюдо'}</b>${xb}</div>
    <label class="lbl" for="dn">Название</label><input id="dn" value="${esc(dish?.name || '')}">
    <label class="lbl" for="dp">Цена, ₸</label><input id="dp" type="number" inputmode="decimal" min="0" value="${dish?.price || ''}" placeholder="0">
    <label class="lbl" for="dc">Категория</label><select id="dc">${cats.map(c => `<option value="${c.id}" ${c.id === (dish?.categoryId ?? catId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
    <label class="lbl" for="dd">Описание</label><input id="dd" value="${esc(dish?.description || '')}">
    <label class="lbl" for="dt">Время приготовления, мин</label><input id="dt" type="number" inputmode="numeric" min="0" value="${dish?.preparationTime || ''}">
    <label class="chk"><input type="checkbox" id="da" ${dish?.isAvailable === false ? '' : 'checked'}> Доступно (снимите, чтобы скрыть)</label>
    <div class="btns">${dish ? '<button class="btn ghost" data-del>Удалить</button>' : '<span></span>'}<button class="btn" data-save>Сохранить</button></div>`);
  const $ = s => bg.querySelector(s);
  $('[data-save]').onclick = async e => {
    const name = $('#dn').value.trim();
    if (!name) return toast('Введите название');
    e.currentTarget.disabled = true;
    await saveDish({ id: dish?.id, name, price: Math.max(0, +$('#dp').value || 0), categoryId: +$('#dc').value, description: $('#dd').value.trim(),
      preparationTime: +$('#dt').value || null, isAvailable: $('#da').checked });
    bg.remove(); refresh();
  };
  const del = $('[data-del]');
  if (del) twoTap(del, 'Точно удалить?', async () => { await deleteDish(dish.id); bg.remove(); toast('Блюдо удалено'); refresh(); });
}

export function bindMenu(view, refresh) {
  view.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-acat]')) return catSheet(null, refresh);
    const ec = t.closest('[data-ecat]');
    if (ec) return catSheet((await getCategories()).find(c => c.id === +ec.dataset.ecat), refresh);
    const ad = t.closest('[data-adish]');
    if (ad) return dishSheet(null, +ad.dataset.adish, refresh);
    const ed = t.closest('[data-edish]');
    if (ed) return dishSheet((await getAllDishes()).find(d => d.id === +ed.dataset.edish), null, refresh);
    const f = t.closest('[data-fav]');
    if (f) { await toggleFav(+f.dataset.fav); refresh(); }
  });
}
