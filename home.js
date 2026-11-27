import { loadMenu, priceText } from './menu-data.js';

try {
  const { sections } = await loadMenu();
  const items = new Map(sections.flatMap((section) => section.items.map((item) => [item.id, item])));
  for (const link of document.querySelectorAll('#pair-items a')) {
    const item = items.get(Number(new URL(link.href).searchParams.get('item')));
    if (!item) continue;
    const prices = item.prices_rub;
    link.querySelector('strong').textContent = prices.length > 1
      ? `от ${priceText({ prices_rub: [Math.min(...prices)] })}`
      : priceText(item);
  }
} catch {
  // The featured pair still has the original menu prices in the server-rendered page.
}
