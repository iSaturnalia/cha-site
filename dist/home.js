import './flow.js';
import { asset, itemName, loadMenu, priceText } from './menu-data.js';

const featured = {
  kitchen: [1, 8, 4],
  tea: [150, 158, 154],
  drinks: [15, 109, 134],
  desserts: [12, 14, 105],
};

const tabs = [...document.querySelectorAll('.preview-tabs a')];
const preview = document.querySelector('#menu-preview');
const fullMenu = document.querySelector('[data-full-menu]');

function previewCard(item, group) {
  const card = document.createElement('article');
  card.className = 'preview-card';
  const link = document.createElement('a');
  link.href = `./menu/?section=${group}&item=${item.id}`;
  const photo = group === 'tea' ? null : item.photo?.file;
  if (photo) {
    const image = document.createElement('img');
    image.src = asset(photo);
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    link.append(image);
  }
  const copy = document.createElement('div');
  const name = document.createElement('h3');
  name.textContent = item.id === 4 ? 'Корейский чикен с рисом' : itemName(item);
  const price = document.createElement('strong');
  const prices = item.prices_rub;
  price.textContent = prices?.length > 1
    ? `от ${priceText({ prices_rub: [Math.min(...prices)] })}`
    : priceText(item);
  copy.append(name, price);
  link.append(copy);
  if (!photo && item.description) {
    const description = document.createElement('p');
    description.textContent = item.description;
    link.append(description);
  }
  card.append(link);
  return card;
}

try {
  const { sections } = await loadMenu();
  const items = new Map(sections.flatMap((section) => section.items.map((item) => [item.id, item])));
  for (const tab of tabs) {
    const group = tab.dataset.group;
    const selection = featured[group].map((id) => items.get(id));
    if (selection.some((item) => !item)) continue;
    tab.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      for (const other of tabs) other.removeAttribute('aria-current');
      tab.setAttribute('aria-current', 'true');
      fullMenu.href = tab.href;
      preview.classList.toggle('preview-tea', group === 'tea');
      preview.replaceChildren(...selection.map((item) => previewCard(item, group)));
    });
  }
} catch {
  // Category links still open their full catalog pages when this request fails.
}
