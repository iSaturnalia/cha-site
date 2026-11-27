export const asset = (path) => new URL(`./assets/${path}`, import.meta.url).href;

export async function loadMenu() {
  const response = await fetch(asset('menu.json'));
  if (!response.ok) throw new Error(`Menu request failed (${response.status})`);
  return response.json();
}

const rubles = new Intl.NumberFormat('ru-RU');
export const priceText = (item) =>
  item.prices_rub?.map((price) => `${rubles.format(price)} ₽`).join(' / ') || '';

export function itemName(item) {
  return item.portion === '0.5 / 1.5'
    ? item.name.replace(/\s+0[.,]5\s*\/\s*1[.,]5$/, '')
    : item.name;
}

export function portionText(item) {
  return item.portion === '0.5 / 1.5' ? '0,5 л / 1,5 л' : (item.portion ?? '');
}
