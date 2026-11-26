import { tx, wrap, dbAll } from './database.js';

// Стартовое место для нового стола (сетка 4 в ряд), потом пользователь двигает сам. Позиция — % от плана.
export const slot = i => ({ positionX: 14 + (i % 4) * 24, positionY: 14 + (Math.floor(i / 4) % 4) * 22 });
export const getTables = async () => (await dbAll('tables')).sort((a, b) => a.number - b.number);

export const addTable = () => tx(['tables'], async T => {
  const all = await wrap(T.getAll());
  const t = { number: all.reduce((m, x) => Math.max(m, x.number), 0) + 1, status: 'free', ...slot(all.length), width: 64, height: 64, shape: 'square', createdAt: Date.now() };
  t.id = await wrap(T.add(t));
  return t;
});
export const updateTable = (id, patch) => tx(['tables'], async T => {
  const t = await wrap(T.get(id));
  if (t) await wrap(T.put({ ...t, ...patch }));
});
export const deleteTable = id => tx(['tables'], T => wrap(T.delete(id)));
