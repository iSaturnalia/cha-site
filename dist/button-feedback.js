// Touch browsers can defer :active while deciding whether a gesture will scroll.
let pressed;

document.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch' || !event.isPrimary) return;
  const button = event.target.closest('.button');
  if (!button) return;
  pressed = { button, id: event.pointerId };
  button.classList.add('is-pressed');
}, { passive: true });

function release(event) {
  if (pressed?.id !== event.pointerId) return;
  pressed.button.classList.remove('is-pressed');
  pressed = undefined;
}

document.addEventListener('pointerup', release, { passive: true });
document.addEventListener('pointercancel', release, { passive: true });
