// IndexedDB: все сущности из ТЗ. Версионирование через onupgradeneeded.
const NAME = 'oma', VERSION = 2;
let dbp;
export const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = e => {
      const d = r.result;
      if (e.oldVersion < 1) {
        const mk = (n, idx = []) => { const s = d.createObjectStore(n, { keyPath: 'id', autoIncrement: true }); idx.forEach(i => s.createIndex(i, i)); };
        mk('settings'); mk('tables', ['number']); mk('categories', ['sortOrder']); mk('menuItems', ['categoryId']);
        mk('orders', ['status', 'tableId', 'shiftId', 'createdAt']); mk('orderItems', ['orderId', 'status']);
        mk('shifts', ['startedAt']); mk('tips', ['shiftId']); mk('notes', ['tableId']);
      }
      if (e.oldVersion >= 1 && e.oldVersion < 2) {
        let i = 0;
        r.transaction.objectStore('tables').openCursor().onsuccess = ev => {
          const cur = ev.target.result; if (!cur) return;
          const t = cur.value; let ch = false;
          if (t.positionX === 0 && t.positionY === 0) { t.positionX = 14 + (i % 4) * 24; t.positionY = 14 + (Math.floor(i / 4) % 4) * 22; ch = true; }
          if (t.width === 80 && t.height === 80) { t.width = 64; t.height = 64; ch = true; }
          i++; if (ch) cur.update(t); cur.continue();
        };
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// Транзакция на чтение и запись: fn получает объекты-хранилища в порядке списка
export async function tx(names, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(names, 'readwrite');
    let out;
    t.oncomplete = () => res(out);
    t.onerror = t.onabort = () => rej(t.error);
    Promise.resolve(fn(...names.map(n => t.objectStore(n)))).then(v => { out = v; }, e => { try { t.abort(); } catch {} rej(e); });
  });
}
export const dbAll = async s => wrap((await db()).transaction(s).objectStore(s).getAll());
export const dbIndex = async (s, i, v) => wrap((await db()).transaction(s).objectStore(s).index(i).getAll(v));
