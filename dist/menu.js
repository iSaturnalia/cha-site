import { observeFlow } from './flow.js';
import { asset, itemName, loadMenu, portionText, priceText } from './menu-data.js';

const tabs = [...document.querySelectorAll('.menu-tabs a')];
const search = document.querySelector('#search');
const clear = document.querySelector('.clear-search');
const form = document.querySelector('.search-form');
const results = document.querySelector('#menu-results');
const status = document.querySelector('.menu-status');
const index = document.querySelector('.section-index');
const links = document.querySelector('#section-links');
const select = document.querySelector('#jump-select');
const dialog = document.querySelector('#dish-dialog');
const picture = document.querySelector('#dish-picture');

const itemCount = new Intl.PluralRules('ru');
const countLabels = { one: 'позиция', few: 'позиции', many: 'позиций', other: 'позиций' };

function normalize(value) {
  return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function sectionGroup(name) {
  if (/^Китайский чай|^Фэн-Шуй/i.test(name)) return 'tea';
  if (/десерты|гонконгские вафли|крамбл/i.test(name)) return 'desserts';
  if (/bubble tea|смузи|лимонады|фреш|милкшейки|кофе/i.test(name)) return 'drinks';
  return 'kitchen';
}

function sectionLabel(name) {
  return name.replace(/^ВКУС АЗИИ\s*❤️\s*\/\s*/i, 'Вкус Азии · ')
    .replace(/^Китайский чай\s*\/\s*/i, '').replace(/\s[⭐⌚]/gu, '');
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function photo(item, className) {
  const file = item.photo?.file;
  if (!file) return null;
  const img = element('img', '', className);
  img.src = asset(file);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.addEventListener('error', () => img.replaceWith(element('span', '', className)), { once: true });
  return img;
}

function dishRow(item) {
  const listItem = element('li');
  const button = element('button', '', 'dish-row');
  button.type = 'button';
  button.dataset.item = item.id;
  button.setAttribute('aria-haspopup', 'dialog');
  button.append(photo(item, 'dish-thumb') ?? element('span', '', 'dish-thumb'));
  const details = element('span', '', 'dish-line');
  details.append(element('strong', itemName(item)));
  const portion = portionText(item);
  if (portion) details.append(element('span', portion, 'dish-meta'));
  const price = priceText(item);
  if (price) details.append(element('span', price, 'dish-price'));
  button.append(details);
  listItem.append(button);
  return listItem;
}

function details(id) {
  const item = items.get(Number(id));
  if (!item) return;
  document.querySelector('#dish-title').textContent = itemName(item);
  document.querySelector('#dish-category').textContent = item.section.label;
  for (const [field, value] of Object.entries({
    description: item.description,
    portion: portionText(item),
    price: priceText(item),
  })) {
    const node = document.querySelector(`#dish-${field}`);
    node.textContent = value || '';
    node.hidden = !value;
  }
  picture.replaceChildren();
  const thumbnail = item.photo?.quality === 'thumbnail';
  const image = photo(item, thumbnail ? 'detail-thumbnail' : '');
  if (image) {
    image.loading = 'eager';
    image.alt = itemName(item);
    picture.append(image);
    if (thumbnail && item.photo.source_url) {
      const full = new Image();
      full.alt = image.alt;
      full.onload = () => {
        if (full.naturalWidth >= 250) image.replaceWith(full);
      };
      full.src = item.photo.source_url;
    }
  }
  dialog.showModal();
}

function updateUrl(group) {
  const next = new URL(location.href);
  next.searchParams.set('section', group);
  next.searchParams.delete('item');
  history.replaceState(null, '', next);
}

function render() {
  const words = normalize(search.value).split(' ').filter(Boolean);
  const searching = words.length > 0;
  clear.hidden = !search.value;
  const visible = sections.filter((section) => searching || section.group === group)
    .map((section) => ({ ...section, items: searching
      ? section.items.filter((item) => words.every((word) => item.searchText.includes(word)))
      : section.items }))
    .filter((section) => section.items.length);
  const count = visible.reduce((total, section) => total + section.items.length, 0);
  status.textContent = searching
    ? count ? `Найдено: ${count} ${countLabels[itemCount.select(count)]}` : 'Ничего не нашли. Попробуйте другое название или ингредиент.'
    : `${count} ${countLabels[itemCount.select(count)]}`;
  for (const tab of tabs) {
    if (tab.dataset.group === group && !searching) tab.setAttribute('aria-current', 'true');
    else tab.removeAttribute('aria-current');
  }
  const sectionsFragment = document.createDocumentFragment();
  const linksFragment = document.createDocumentFragment();
  const optionsFragment = document.createDocumentFragment();
  for (const section of visible) {
    const heading = element('section', '', 'menu-section');
    heading.id = section.id;
    heading.setAttribute('data-flow', '');
    heading.append(element('h2', section.label));
    const list = element('ul', '', 'dish-list');
    list.append(...section.items.map(dishRow));
    heading.append(list);
    sectionsFragment.append(heading);
    const link = element('a', section.label);
    link.href = `#${section.id}`;
    linksFragment.append(link);
    optionsFragment.append(new Option(section.label, section.id));
  }
  results.replaceChildren(sectionsFragment);
  observeFlow(results, { animateVisible: false });
  links.replaceChildren(linksFragment);
  select.replaceChildren(new Option('Выбрать подраздел', ''), optionsFragment);
  index.hidden = visible.length < 2;
}

let sections = [];
let items = new Map();
let group = 'kitchen';

async function start() {
  const params = new URLSearchParams(location.search);
  const { sections: menu } = await loadMenu();
  sections = menu.map((section, position) => {
    const record = { id: `section-${position + 1}`, label: sectionLabel(section.name), group: sectionGroup(section.name) };
    return {
      ...record,
      items: section.items.map((item) => ({
        ...item,
        section: record,
        searchText: normalize([item.name, item.description, record.label].filter(Boolean).join(' ')),
      })),
    };
  });
  items = new Map(sections.flatMap((section) => section.items.map((item) => [item.id, item])));
  const requestedGroup = params.get('section');
  group = tabs.some((tab) => tab.dataset.group === requestedGroup)
    ? requestedGroup : (items.get(Number(params.get('item')))?.section.group ?? 'kitchen');
  search.disabled = false;
  search.addEventListener('input', render);
  form.addEventListener('submit', (event) => { event.preventDefault(); render(); });
  clear.addEventListener('click', () => {
    search.value = '';
    search.focus();
    render();
  });
  select.addEventListener('change', () => document.getElementById(select.value)?.scrollIntoView());
  for (const tab of tabs) {
    tab.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      search.value = '';
      group = tab.dataset.group;
      updateUrl(group);
      render();
      if (document.querySelector('.menu-nav').getBoundingClientRect().top <= 0) {
        document.querySelector('.catalog-body').scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    });
  }
  results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-item]');
    if (button) details(button.dataset.item);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (new URLSearchParams(location.search).has('item')) updateUrl(group);
  });
  render();
  if (params.get('item')) details(params.get('item'));
  else if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

search.disabled = true;
start().catch(() => {
  status.textContent = 'Не удалось загрузить меню. ';
  const retry = element('a', 'Обновить страницу', 'text-link');
  retry.href = location.href;
  status.append(retry);
});
