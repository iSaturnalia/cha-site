const section = document.querySelector('#ritual');
const track = section.querySelector('.ritual-track');
const panel = section.querySelector('.ritual-panel');
const visual = section.querySelector('.ritual-visual');
const canvas = section.querySelector('.ritual-canvas');
const poster = section.querySelector('.ritual-poster');
const instruction = section.querySelector('.ritual-instruction');
const progressBar = section.querySelector('.ritual-progress');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (value) => Math.min(1, Math.max(0, value));
let model;
let loading = false;
let onScreen = false;
let pendingFrame = 0;
let lastProgress = -1;
let lastTime = 0;

function frame(time) {
  pendingFrame = 0;
  if (!onScreen || !model || reducedMotion.matches) return;
  const distance = Math.max(1, track.clientHeight - panel.offsetHeight);
  const target = clamp(-track.getBoundingClientRect().top / distance);
  const delta = Math.min(48, time - (lastTime || time - 16));
  const weight = 1 - Math.exp(-delta / 58);
  const progress = lastProgress < 0 || Math.abs(target - lastProgress) < 0.002
    ? target : lastProgress + (target - lastProgress) * weight;
  if (progress !== lastProgress) {
    lastProgress = progress;
    model.render(progress);
    progressBar.style.setProperty('--ritual-progress', String(progress));
  }
  lastTime = progress === target ? 0 : time;
  if (progress !== target) schedule();
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
  instruction.hidden = !enhanced;
  progressBar.hidden = !enhanced;
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
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) setEnhanced(false);
  else if (model) setEnhanced(true);
  else if (onScreen) enhance();
});
canvas.addEventListener('webglcontextlost', () => {
  model = undefined;
  setEnhanced(false);
});
