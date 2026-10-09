const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' });

export function formatMoney(kopecks: number): string {
  return rub.format(kopecks / 100);
}
