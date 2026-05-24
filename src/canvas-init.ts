let canvasInstance: HTMLCanvasElement | null = null;
let ctxInstance: CanvasRenderingContext2D | null = null;
let canvasCssWidth: number | null = null;
let canvasCssHeight: number | null = null;

export function getCanvas() {
  return canvasInstance;
}

export function getCtx() {
  return ctxInstance;
}

export function getCanvasCssWidth() {
  return canvasCssWidth;
}

export function getCanvasCssHeight() {
  return canvasCssHeight;
}

let initialized = false;

export function initCanvas({
  getFullscreenBindings,
}: {
  getFullscreenBindings?: (() => string[]) | null;
} = {}): void {
  if (initialized) return;
  initialized = true;

  const host = document.getElementById('canvas1');
  if (!host) {
    throw new Error('Missing #canvas1 element');
  }

  const frame = document.getElementById('frame');

  const canvas = document.createElement('canvas');
  canvas.id = 'canvas';

  host.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2d context');
  }

  canvasInstance = canvas;
  ctxInstance = ctx;

  // Отключаем сглаживание при масштабировании, чтобы текстуры не "мыло".
  ctx.imageSmoothingEnabled = false;

  // Адаптация под разные разрешения и HiDPI.
  // canvas.width/height задаём в device-пикселях, а логический размер (CSS px)
  // сохраняем отдельно, чтобы движок мог продолжать работать в "нормальных" пикселях.
  const resizeCanvas = (): void => {
    const rect = host.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width));
    const cssHeight = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    canvasCssWidth = cssWidth;
    canvasCssHeight = cssHeight;

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    // Рисуем в координатах CSS-пикселей (движок оперирует ими),
    // а браузер сам масштабирует в device-пиксели.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // На некоторых браузерах флаг может сбрасываться после setTransform.
    ctx.imageSmoothingEnabled = false;
  };

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Fullscreen: кнопка в UI + горячая клавиша.
  // В fullscreen растягиваем canvas на весь экран.
  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (!document.fullscreenElement) {
        await (frame ?? document.documentElement).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } finally {
      // После переключения fullscreen браузер и CSS grid могут пересчитать размеры
      // не сразу. Ресайзим canvas после layout (пара rAF).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resizeCanvas();
        });
      });
    }
  };

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      toggleFullscreen();
    });
  }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const bindings = getFullscreenBindings?.() ?? ['KeyF'];
    if (bindings.includes(e.code) && !e.repeat) {
      toggleFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resizeCanvas();
      });
    });
  });
}
