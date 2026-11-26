const section = document.querySelector('#ritual');
const track = section.querySelector('.ritual-track');
const panel = section.querySelector('.ritual-panel');
const visual = section.querySelector('.ritual-visual');
const canvas = section.querySelector('.ritual-canvas');
const poster = section.querySelector('.ritual-poster');
const instruction = section.querySelector('.ritual-instruction');
const fallbackCopy = section.querySelector('.ritual-fallback-copy');
const controls = section.querySelector('.ritual-controls');
const buttons = [...controls.querySelectorAll('button')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (value) => Math.min(1, Math.max(0, value));
let model;
let loading = false;
let onScreen = false;
let pendingFrame = 0;
let lastProgress = -1;
let lastTime = 0;
let activeButton = buttons[0];

function distance() {
  return Math.max(1, track.clientHeight - panel.offsetHeight);
}

function frame(time) {
  pendingFrame = 0;
  if (!onScreen || !model || reducedMotion.matches) return;
  const target = clamp(-track.getBoundingClientRect().top / distance());
  const delta = Math.min(48, time - (lastTime || time - 16));
  const weight = 1 - Math.exp(-delta / 58);
  const progress = lastProgress < 0 || Math.abs(target - lastProgress) < 0.002
    ? target : lastProgress + (target - lastProgress) * weight;
  if (progress !== lastProgress) {
    lastProgress = progress;
    model.render(progress);
  }
  lastTime = progress === target ? 0 : time;
  if (progress !== target) schedule();
  const stage = buttons[progress < 0.36 ? 0 : progress < 0.8 ? 1 : 2];
  if (stage === activeButton) return;
  activeButton?.setAttribute('aria-pressed', 'false');
  stage.setAttribute('aria-pressed', 'true');
  activeButton = stage;
}

function schedule() {
  if (!pendingFrame && onScreen) pendingFrame = requestAnimationFrame(frame);
}

function resize() {
  if (!model || !section.classList.contains('is-enhanced')) return;
  const { width, height } = visual.getBoundingClientRect();
  if (!width || !height) return;
  model.resize(width, height);
  lastProgress = -1;
  schedule();
}

function setEnhanced(enhanced) {
  section.classList.toggle('is-enhanced', enhanced);
  canvas.hidden = !enhanced;
  poster.hidden = enhanced;
  fallbackCopy.hidden = enhanced;
  instruction.hidden = !enhanced;
  controls.hidden = !enhanced;
  if (enhanced) resize();
}

async function enhance() {
  if (reducedMotion.matches || loading || model) return;
  loading = true;
  try {
    const { createTeaScene } = await import('./tea-scene.js');
    if (reducedMotion.matches) return;
    model = createTeaScene(canvas);
    setEnhanced(true);
  } catch {
    setEnhanced(false);
  } finally {
    loading = false;
  }
}

new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) enhance();
}, { rootMargin: '650px 0px' }).observe(section);

new IntersectionObserver(([entry]) => {
  onScreen = entry.isIntersecting;
  if (!onScreen) lastTime = 0;
  schedule();
}).observe(section);

new ResizeObserver(resize).observe(visual);
window.addEventListener('scroll', schedule, { passive: true });
for (const button of buttons) {
  button.addEventListener('click', () => {
    const top = window.scrollY + track.getBoundingClientRect().top;
    window.scrollTo({ top: top + distance() * Number(button.dataset.progress), behavior: 'smooth' });
  });
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) setEnhanced(false);
  else if (model) setEnhanced(true);
  else if (onScreen) enhance();
});
canvas.addEventListener('webglcontextlost', () => {
  model = undefined;
  setEnhanced(false);
});
