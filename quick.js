import { icon, toast, store, esc } from './utils.js';
import { saveQuickOrder, recentTables } from './orders.js';
import { getMenu } from './menu.js';

const strip = l => l.replace(/^\d+\.\s?/, '');
// Автонумерация: каждая строка получает "N. "
function renum(ta) {
  ta.value = ta.value.split('\n').map((l, i) => `${i + 1}. ${strip(l)}`).join('\n');
}
const itemsOf = ta => ta.value.split('\n').map(l => strip(l).trim()).filter(Boolean);

export function openQuick(onSaved, table = null) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-label="Запись заказа">
    <div class="row"><b>Запись заказа</b><button class="x" data-close aria-label="Закрыть">${icon('x')}</button></div>
    <div id="s1">
      <textarea id="qt" rows="6" autocomplete="off" autocapitalize="sentences" placeholder="Пишите позиции, Enter — новая строка"></textarea>
      <div class="chips" id="sug"></div>
      <button class="btn" id="next" disabled>Заказ</button>
    </div>
    <div id="s2" hidden>
      <label class="lbl" for="tn">Какой стол?</label>
      <input id="tn" type="number" inputmode="numeric" min="1" placeholder="Номер стола">
      <div class="chips" id="chips"></div>
      <label class="lbl" for="cm">Комментарий (необязательно)</label>
      <input id="cm" type="text" placeholder="Например: без сахара">
      <div class="btns"><button class="btn ghost" id="back">Назад</button><button class="btn" id="save" disabled>Сохранить</button></div>
    </div></div>`;
  document.body.appendChild(bg);
  const $ = s => bg.querySelector(s);
  const ta = $('#qt'), tn = $('#tn');
  const close = () => bg.remove();

  ta.value = store.get('draft', '') || '1. ';
  renum(ta);
  const refresh = () => { $('#next').disabled = !itemsOf(ta).length; store.set('draft', itemsOf(ta).length ? ta.value : ''); };
  refresh();
  // Подсказки из меню: пустая строка — избранное, иначе совпадения по тексту
  let menu = [];
  const sug = $('#sug');
  const curLine = () => ta.value.slice(0, ta.selectionStart).split('\n').length - 1;
  function suggest() {
    const cur = strip(ta.value.split('\n')[curLine()] || '').trim().toLowerCase();
    const list = (cur ? menu.filter(m => m.name.toLowerCase().includes(cur) && m.name.toLowerCase() !== cur) : menu.filter(m => m.isFavorite)).slice(0, 6);
    sug.innerHTML = list.map(m => `<button class="chip" data-dish="${m.id}">${esc(m.name)}</button>`).join('');
  }
  getMenu().then(m => { menu = m; suggest(); }).catch(() => {});
  sug.addEventListener('pointerdown', e => e.preventDefault()); // клавиатура не закрывается
  sug.addEventListener('click', e => {
    const b = e.target.closest('[data-dish]'); if (!b) return;
    const m = menu.find(x => x.id === +b.dataset.dish), i = curLine(), lines = ta.value.split('\n');
    lines[i] = m.name; ta.value = lines.join('\n'); renum(ta);
    const end = ta.value.split('\n').slice(0, i + 1).join('\n').length;
    ta.focus(); ta.setSelectionRange(end, end); refresh(); suggest();
  });
  ta.addEventListener('keyup', suggest); ta.addEventListener('click', suggest);
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 50);

  // Enter -> новая пронумерованная строка (beforeinput работает и на Android-клавиатурах)
  ta.addEventListener('beforeinput', e => {
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    e.preventDefault();
    const pos = ta.selectionStart, line = ta.value.slice(0, pos).split('\n').length;
    if (!strip(ta.value.split('\n')[line - 1]).trim()) return; // пустую строку не плодим
    ta.value = ta.value.slice(0, pos) + '\n' + ta.value.slice(ta.selectionEnd);
    renum(ta);
    const lines = ta.value.split('\n'), end = lines.slice(0, line + 1).join('\n').length;
    ta.setSelectionRange(end, end); refresh(); suggest();
  });
  ta.addEventListener('input', () => {
    if (!ta.value.trim()) ta.value = '1. ';
    const p = ta.selectionStart, before = ta.value.length;
    renum(ta); const d = ta.value.length - before; ta.setSelectionRange(p + d, p + d); refresh(); suggest();
  });

  $('#next').onclick = async () => {
    $('#s1').hidden = true; $('#s2').hidden = false;
    const rec = await recentTables();
    const nums = [...new Set([...rec, 1, 2, 3, 4, 5, 6, 7, 8])].slice(0, 10);
    $('#chips').innerHTML = nums.map(n => `<button class="chip" data-n="${n}">${esc(n)}</button>`).join('');
    if (table) { tn.value = table; tn.dispatchEvent(new Event('input')); } else tn.focus();
  };
  $('#back').onclick = () => { $('#s2').hidden = true; $('#s1').hidden = false; ta.focus(); };
  tn.addEventListener('input', () => { $('#save').disabled = !(+tn.value > 0); });
  bg.addEventListener('click', e => {
    if (e.target === bg || e.target.closest('[data-close]')) return close();
    const c = e.target.closest('.chip[data-n]');
    if (c) { tn.value = c.dataset.n; tn.dispatchEvent(new Event('input')); }
  });
  $('#save').onclick = async e => {
    e.currentTarget.disabled = true; // защита от двойного нажатия
    try {
      const number = +tn.value;
      await saveQuickOrder({ number, lines: itemsOf(ta), comment: $('#cm').value.trim() });
      store.set('draft', ''); close(); toast(`Записано: стол ${number}`); onSaved();
    } catch { toast('Не удалось сохранить. Попробуйте ещё раз'); e.currentTarget.disabled = false; }
  };
}
