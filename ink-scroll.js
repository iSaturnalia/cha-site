const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clamp = (value) => Math.min(1, Math.max(0, value));

const scenes = [...document.querySelectorAll('[data-ink-stage]')].map((element) => {
  const { inkOrigin, inkStart, inkEnd, inkPoint, inkBeforeEnd, inkMinStart, inkMinSpan } = element.dataset;
  return {
    element,
    fromPageTop: inkOrigin === 'page',
    startAt: Number(inkStart ?? 0),
    endAt: Number(inkEnd),
    point: Number(inkPoint ?? 0),
    beforeEnd: Number(inkBeforeEnd ?? 0),
    minStart: Number(inkMinStart ?? 0),
    minSpan: Number(inkMinSpan ?? 0),
    paths: [...element.querySelectorAll('[data-ink-path]')].map((path) => ({
      path,
      start: Number(path.dataset.from ?? 0),
      end: Number(path.dataset.to ?? 1),
      previous: 1,
    })),
    layers: [...element.querySelectorAll('[data-ink-complete]')].map((layer) => ({
      layer,
      end: Number(layer.dataset.inkComplete),
      complete: true,
    })),
  };
});

let frame = 0;
let layoutDirty = true;
let listeners;

function measureScenes() {
  const height = window.innerHeight;
  const top = window.scrollY;
  const limit = document.documentElement.scrollHeight - height;
  for (const scene of scenes) {
    if (scene.fromPageTop) {
      scene.start = scene.startAt * height;
      scene.end = scene.endAt * height;
      continue;
    }
    const rect = scene.element.getBoundingClientRect();
    const anchor = top + rect.top + rect.height * scene.point;
    scene.start = Math.max(scene.minStart * height, anchor - scene.startAt * height);
    scene.end = Math.max(scene.start + scene.minSpan * height, anchor - scene.endAt * height);
    if (scene.beforeEnd) {
      scene.end = Math.min(scene.end, limit - scene.beforeEnd);
      scene.start = Math.min(scene.start, scene.end - Math.min(120, limit / 2));
    }
  }
  layoutDirty = false;
}

function paint(scene, progress) {
  for (const segment of scene.paths) {
    const value = clamp((progress - segment.start) / (segment.end - segment.start));
    if (value === segment.previous) continue;
    segment.path.setAttribute('stroke-dashoffset', 1 - value);
    if (!value || !segment.previous) segment.path.setAttribute('visibility', value ? 'visible' : 'hidden');
    segment.previous = value;
  }
  for (const entry of scene.layers) {
    const complete = progress >= entry.end;
    if (complete === entry.complete) continue;
    // Restore the exact original antialiased pixels after each mark is complete.
    entry.layer.setAttribute('visibility', complete ? 'visible' : 'hidden');
    entry.complete = complete;
  }
}

function update() {
  frame = 0;
  if (layoutDirty) measureScenes();
  for (const scene of scenes) {
    paint(scene, clamp((window.scrollY - scene.start) / Math.max(1, scene.end - scene.start)));
  }
}

function schedule() {
  if (listeners && !frame) frame = requestAnimationFrame(update);
}

function layoutChanged() {
  layoutDirty = true;
  schedule();
}

const layoutObserver = 'ResizeObserver' in window ? new ResizeObserver(layoutChanged) : null;

function stop() {
  listeners?.abort();
  listeners = undefined;
  layoutObserver?.disconnect();
  cancelAnimationFrame(frame);
  frame = 0;
}

function start() {
  stop();
  if (reducedMotion.matches) {
    for (const scene of scenes) paint(scene, 1);
    return;
  }

  listeners = new AbortController();
  const { signal } = listeners;
  window.addEventListener('scroll', schedule, { passive: true, signal });
  window.addEventListener('resize', layoutChanged, { signal });
  window.addEventListener('load', layoutChanged, { once: true, signal });
  layoutObserver?.observe(document.body);
  for (const { element } of scenes) layoutObserver?.observe(element);
  layoutDirty = true;
  update();
}

window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', (event) => {
  if (event.persisted) start();
});
reducedMotion.addEventListener('change', start);
start();
