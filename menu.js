import { tx, wrap, dbAll } from './database.js';

export const getCategories = async () => (await dbAll('categories')).sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
export const getAllDishes = async () => (await dbAll('menuItems')).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
// Доступные блюда: для подсказок и автоцены при записи заказа
export const getMenu = async () => (await getAllDishes()).filter(m => m.isAvailable !== false);

export const saveCategory = c => tx(['categories'], async C => {
  if (c.id) return wrap(C.put({ ...(await wrap(C.get(c.id))), name: c.name }));
  const n = (await wrap(C.getAll())).length;
  return wrap(C.add({ name: c.name, servingStage: null, sortOrder: n, createdAt: Date.now() }));
});
// Блюда удаляются вместе с категорией; старые заказы не меняются (в них копия названия и цены)
export const deleteCategory = id => tx(['categories', 'menuItems'], async (C, M) => {
  for (const d of await wrap(M.index('categoryId').getAll(id))) await wrap(M.delete(d.id));
  await wrap(C.delete(id));
});
export const saveDish = d => tx(['menuItems'], async M => {
  const now = Date.now();
  if (d.id) return wrap(M.put({ ...(await wrap(M.get(d.id))), ...d, updatedAt: now }));
  return wrap(M.add({ image: null, isFavorite: false, ...d, createdAt: now, updatedAt: now }));
});
export const deleteDish = id => tx(['menuItems'], M => wrap(M.delete(id)));
export const toggleFav = id => tx(['menuItems'], async M => {
  const d = await wrap(M.get(id));
  await wrap(M.put({ ...d, isFavorite: !d.isFavorite, updatedAt: Date.now() }));
});
