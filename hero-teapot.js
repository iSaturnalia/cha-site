const hero = document.querySelector('.hero');
const stage = hero.querySelector('.hero-teapot');
const motion = stage.querySelector('.hero-teapot-motion');
const canvas = stage.querySelector('canvas');
const poster = stage.querySelector('img');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

let scene;
let loading = false;
let visible = false;
let animation = 0;
let last = 0;
let progress = 0;
let leanX = 0;
let leanY = 0;
let pointerX = 0;
let pointerY = 0;

function queue() {
  if (!animation && scene && visible && !reduced.matches) {
    animation = requestAnimationFrame(draw);
  }
}

function scrollPosition() {
  const { top, height } = hero.getBoundingClientRect();
  return clamp(-top / Math.max(height * 0.66, 1));
}

function paint() {
  const drift = smooth(progress);
  motion.style.setProperty('--pot-x', `${drift * 69}%`);
  motion.style.setProperty('--pot-y', `${drift * -23}%`);
  motion.style.setProperty('--pot-scale', String(1 - drift * 0.23));
  motion.style.setProperty('--pot-opacity', String(1 - smooth((progress - 0.26) / 0.64)));
  scene.render(drift, leanX, leanY);
}

function draw(time) {
  animation = 0;
  if (!scene || !visible || reduced.matches) return;
  const delta = Math.min(48, time - (last || time - 16));
  last = time;
  const target = scrollPosition();
  const weight = 1 - Math.exp(-delta / 75);
  const follow = (value, next) => Math.abs(next - value) < 0.001 ? next : value + (next - value) * weight;
  progress = follow(progress, target);
  leanX = follow(leanX, pointerX);
  leanY = follow(leanY, pointerY);
  paint();
  if (progress !== target || leanX !== pointerX || leanY !== pointerY) queue();
  else last = 0;
}

function resize() {
  if (!scene || reduced.matches) return;
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  scene.resize(width, height);
  paint();
}

function showPoster() {
  canvas.hidden = true;
  poster.hidden = false;
  motion.style.removeProperty('--pot-x');
  motion.style.removeProperty('--pot-y');
  motion.style.removeProperty('--pot-scale');
  motion.style.removeProperty('--pot-opacity');
}

async function activate() {
  if (loading || !visible || reduced.matches) return;
  if (!scene) {
    loading = true;
    try {
      const { createHeroTeapot } = await import('./tea-scene.js');
      if (reduced.matches || !visible) return;
      scene = createHeroTeapot(canvas);
    } catch {
      showPoster();
      return;
    } finally {
      loading = false;
    }
  }
  progress = scrollPosition();
  resize();
  canvas.hidden = false;
  poster.hidden = true;
}

new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible) activate();
  else last = 0;
}).observe(hero);
new ResizeObserver(resize).observe(stage);
window.addEventListener('scroll', queue, { passive: true });

hero.addEventListener('pointermove', (event) => {
  if (!finePointer.matches || event.pointerType === 'touch') return;
  const { x, y, width, height } = stage.getBoundingClientRect();
  pointerX = clamp((event.clientX - x) / width) * 2 - 1;
  pointerY = clamp((event.clientY - y) / height) * 2 - 1;
  queue();
}, { passive: true });
hero.addEventListener('pointerleave', () => {
  pointerX = pointerY = 0;
  queue();
});

reduced.addEventListener('change', () => {
  if (reduced.matches) showPoster();
  else activate();
});
canvas.addEventListener('webglcontextlost', () => {
  scene = undefined;
  showPoster();
});
