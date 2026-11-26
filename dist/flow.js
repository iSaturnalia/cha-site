const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const registered = new WeakSet();
const targetsByRoot = new WeakMap();
const playing = new Map();

const observer = 'IntersectionObserver' in window && 'animate' in Element.prototype
  ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (reducedMotion.matches || entry.boundingClientRect.top < -40) continue;
        reveal(entry.target);
      }
    })
  : null;

function reveal(element) {
  const intro = element.dataset.flow === 'intro';
  const delay = Math.min(Number(element.dataset.flowDelay) || 0, 200);
  const animation = element.animate([
    { opacity: intro ? 0.64 : 0.26, transform: `translateY(${intro ? 16 : 27}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: intro ? 510 : 680, delay, easing: 'cubic-bezier(0.22, 0.77, 0.24, 1)', fill: 'backwards' });
  playing.set(element, animation);
  animation.finished.catch(() => {}).finally(() => playing.delete(element));
}

export function observeFlow(root, { animateVisible = true } = {}) {
  if (!observer) return;
  for (const previous of targetsByRoot.get(root) ?? []) {
    if (previous.isConnected) continue;
    observer.unobserve(previous);
    playing.get(previous)?.cancel();
  }
  if (reducedMotion.matches) return;
  const elements = [...root.querySelectorAll('[data-flow]')];
  targetsByRoot.set(root, elements);
  for (const element of elements) {
    if (registered.has(element)) continue;
    registered.add(element);
    if (!animateVisible && element.getBoundingClientRect().top < window.innerHeight) continue;
    observer.observe(element);
  }
}

document.addEventListener('focusin', (event) => {
  for (const [element, animation] of playing) {
    if (element.contains(event.target)) animation.cancel();
  }
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    for (const animation of playing.values()) animation.cancel();
  } else {
    observeFlow(document);
  }
});
observeFlow(document);
