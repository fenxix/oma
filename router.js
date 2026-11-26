// Простой hash-роутер: #/hall, #/orders ... Запоминает прокрутку каждого экрана.
const scroll = {};
export function initRouter(routes, fallback, onChange) {
  const view = document.getElementById('view');
  let current = null;
  const go = async (keep = false) => {
    const id = location.hash.replace('#/', '') || fallback;
    const key = routes[id] ? id : fallback;
    if (current && !keep) scroll[current] = view.scrollTop;
    const top = keep ? view.scrollTop : (scroll[key] || 0);
    current = key;
    await onChange(key);
    view.scrollTop = top;
  };
  addEventListener('hashchange', () => go());
  go();
  return { refresh: () => go(true) };
}
