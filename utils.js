const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  list: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z"/>',
  note: '<path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h6M8 13h8M8 17h5"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  save: '<path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'
};
export const icon = (n, c = '') => `<svg class="ico ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

export function toast(text, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export const store = {
  get(key, def) { try { const v = JSON.parse(localStorage.getItem('offic.' + key)); return v ?? def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem('offic.' + key, JSON.stringify(val)); } catch {} }
};

export const fmtDate = d => d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
export function greeting(name = '') {
  const h = new Date().getHours();
  const g = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
  return name ? `${g}, ${name}` : g;
}
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const hhmm = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
