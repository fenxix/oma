import { tx, wrap, dbAll } from './database.js';

export const activeShift = async () => (await dbAll('shifts')).find(s => !s.endedAt) || null;

// Вторую активную смену создать нельзя
export const startShift = (salaryType, salaryValue) => tx(['shifts'], async S => {
  if ((await wrap(S.getAll())).some(s => !s.endedAt)) return null;
  const s = { startedAt: Date.now(), endedAt: null, salaryType, salaryValue, totalSales: 0, tips: 0, orderCount: 0, duration: 0 };
  s.id = await wrap(S.add(s));
  return s;
});

// Всё считается из сохранённых оплат и чаевых смены. Чаевые — отдельно от заработка.
export async function shiftStats(s) {
  const orders = (await dbAll('orders')).filter(o => o.shiftId === s.id && o.status === 'paid');
  const tips = (await dbAll('tips')).filter(t => t.shiftId === s.id).reduce((a, t) => a + t.amount, 0);
  const sales = orders.reduce((a, o) => a + (o.total || 0), 0);
  const earn = s.salaryType === 'percent' ? sales * s.salaryValue / 100 : s.salaryValue;
  return { orders: orders.length, tables: new Set(orders.map(o => o.tableId)).size, sales, tips, earn };
}
export const addTip = (shiftId, amount, paymentMethod) => tx(['tips'], T => wrap(T.add({ shiftId, amount, paymentMethod, createdAt: Date.now() })));

export async function endShift(s) {
  const st = await shiftStats(s), now = Date.now();
  await tx(['shifts'], async S => {
    const x = await wrap(S.get(s.id));
    Object.assign(x, { endedAt: now, duration: now - x.startedAt, totalSales: st.sales, tips: st.tips, orderCount: st.orders, earnings: st.earn });
    await wrap(S.put(x));
  });
  return st;
}
export const pastShifts = async () => (await dbAll('shifts')).filter(s => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);
