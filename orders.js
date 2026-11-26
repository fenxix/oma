import { tx, wrap, dbAll, dbIndex } from './database.js';
import { slot } from './tables.js';
import { getMenu } from './menu.js';

const DONE = ['paid', 'closed'];
// "2x кофе" -> 2 штуки; остальное — одна штука
export function parseLine(s) {
  const m = s.match(/^(\d+)\s*[x×х*]\s*(.+)$/i);
  return m ? { name: m[2].trim(), quantity: +m[1] } : { name: s.trim(), quantity: 1 };
}

// Быстрая запись: стол + список позиций. Если у стола уже есть открытый заказ — позиции добавляются в него.
export async function saveQuickOrder({ number, lines, comment }) {
  const now = Date.now();
  const menu = await getMenu();
  return tx(['tables', 'orders', 'orderItems'], async (T, O, I) => {
    let table = (await wrap(T.index('number').getAll(number)))[0];
    if (!table) {
      const id = await wrap(T.add({ number, status: 'free', ...slot(await wrap(T.count())), width: 64, height: 64, shape: 'square', createdAt: now }));
      table = { id, number };
    }
    const open = (await wrap(O.index('tableId').getAll(table.id))).find(o => !DONE.includes(o.status));
    let orderId;
    if (open) {
      orderId = open.id; open.updatedAt = now;
      if (comment) open.comment = open.comment ? open.comment + '; ' + comment : comment;
      await wrap(O.put(open));
    } else {
      orderId = await wrap(O.add({ tableId: table.id, tableNumber: number, status: 'new', total: 0, comment: comment || '', createdAt: now, updatedAt: now, paidAt: null, paymentMethod: null, shiftId: null }));
    }
    for (const line of lines) {
      const { name, quantity } = parseLine(line);
      const m = menu.find(x => x.name.trim().toLowerCase() === name.toLowerCase()); // блюдо из меню — цена подставится сама
      await wrap(I.add({ orderId, menuItemId: m ? m.id : null, nameSnapshot: m ? m.name : name, priceSnapshot: m ? m.price : 0, quantity, comment: '', servingStage: null, status: 'accepted', addedAt: now, updatedAt: now, servedAt: null }));
    }
    return orderId;
  });
}

export async function getActiveOrders() {
  const orders = (await dbAll('orders')).filter(o => !DONE.includes(o.status)).sort((a, b) => a.createdAt - b.createdAt);
  const nums = new Map((await dbAll('tables')).map(t => [t.id, t.number]));
  for (const o of orders) o.tableNumber = nums.get(o.tableId) ?? o.tableNumber;
  for (const o of orders) o.items = (await dbIndex('orderItems', 'orderId', o.id)).sort((a, b) => a.addedAt - b.addedAt || a.id - b.id);
  for (const o of orders) o.total = o.items.reduce((s, i) => s + (i.priceSnapshot || 0) * i.quantity, 0);
  return orders;
}

export async function recentTables(n = 5) {
  const all = (await dbAll('orders')).sort((a, b) => b.createdAt - a.createdAt);
  return [...new Set(all.map(o => o.tableNumber))].slice(0, n);
}
export async function tableCount() { return (await dbAll('tables')).length; }

export const LABEL = { accepted: 'Принято', cooking: 'Готовится', ready: 'Готово', served: 'Подано' };
const NEXT = { accepted: 'cooking', cooking: 'ready', ready: 'served', served: 'accepted' };
// Статус меняется вручную по кругу; время изменения сохраняется
export const cycleItem = id => tx(['orderItems'], async I => {
  const i = await wrap(I.get(id));
  i.status = NEXT[i.status]; i.updatedAt = Date.now(); i.servedAt = i.status === 'served' ? i.updatedAt : null;
  await wrap(I.put(i));
});
export const updateItem = (id, patch) => tx(['orderItems'], async I => {
  const i = await wrap(I.get(id));
  await wrap(I.put({ ...i, ...patch, updatedAt: Date.now() }));
});
// Удаляем позицию; если это была последняя — заказ закрывается пустым
export const deleteItem = id => tx(['orderItems', 'orders'], async (I, O) => {
  const i = await wrap(I.get(id));
  await wrap(I.delete(id));
  if (!(await wrap(I.index('orderId').count(i.orderId)))) {
    const o = await wrap(O.get(i.orderId));
    o.status = 'closed'; o.updatedAt = Date.now();
    await wrap(O.put(o));
  }
});
// Ручной учёт оплаты: способ, сумма, время. После оплаты заказ завершён.
export const payOrder = (id, method, total) => tx(['orders', 'shifts'], async (O, S) => {
  const o = await wrap(O.get(id)), now = Date.now();
  const sh = (await wrap(S.getAll())).find(s => !s.endedAt); // оплата привязывается к активной смене
  Object.assign(o, { status: 'paid', paymentMethod: method, total, paidAt: now, updatedAt: now, shiftId: sh ? sh.id : null });
  await wrap(O.put(o));
});
