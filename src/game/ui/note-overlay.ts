let bound = false;

function getRoot() {
  const el = document.getElementById('noteRoot');
  return el instanceof HTMLElement ? el : null;
}

function getTitleEl() {
  const el = document.getElementById('noteTitle');
  return el instanceof HTMLElement ? el : null;
}

function getTextEl() {
  const el = document.getElementById('noteText');
  return el instanceof HTMLElement ? el : null;
}

export function isNoteOverlayVisible(): boolean {
  const root = getRoot();
  if (!root) return false;
  return root.style.display !== 'none';
}

export function showNoteOverlay(
  title: string,
  text: string,
  opts: { document?: boolean } = {},
) {
  const root = getRoot();
  if (!root) return;
  const titleEl = getTitleEl();
  const textEl = getTextEl();
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  root.classList.toggle('note--document', !!opts.document);
  root.style.display = '';
}

export function hideNoteOverlay() {
  const root = getRoot();
  if (!root) return;
  root.style.display = 'none';
  root.classList.remove('note--document');
}

export function bindNoteOverlayControls({
  getCloseBindings,
}: {
  getCloseBindings?: (() => string[]) | null;
} = {}) {
  if (bound) return;
  bound = true;

  const root = getRoot();
  if (root) {
    root.addEventListener('click', () => {
      hideNoteOverlay();
    });
  }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat) return;
    const bindings = getCloseBindings?.() ?? ['Escape', 'KeyE'];
    if (!bindings.includes(e.code)) return;
    const root = getRoot();
    if (!root || root.style.display === 'none') return;
    hideNoteOverlay();
  });
}
