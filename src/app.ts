import { clearState, loadState, storeState } from './db';
import { crop } from './picture';
import { emptyState, type State } from './state';
import { emptyView, getMatrix, windowToWorld, type View } from './view';

export async function init({
  canvas,
  dragOverlay,
  clearButton,
}: {
  canvas: HTMLCanvasElement;
  dragOverlay: HTMLElement;
  clearButton: HTMLButtonElement;
}) {
  const state = (await loadState()) ?? emptyState();
  const view = emptyView();

  function frame() {
    redraw({ canvas, state, view });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('resize', () => resize({ canvas, state, view }));
  resize({ canvas, state, view });

  clearButton.addEventListener('click', () => {
    if (confirm('Really clear everything?')) {
      (async () => {
        await clearState();
        emptyState(state);
      })().catch((error) => console.error(error));
    }
  });

  // prevent default drag/drop behavior
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // handle drag/drop
  let dragCounter = 0;
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      dragOverlay.style.opacity = '1';
    }
  });
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      dragOverlay.style.opacity = '0';
    }
  });
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dragOverlay.style.opacity = '0';
    const files = Array.from(e.dataTransfer?.files ?? []).filter((file) => file.type.startsWith('image/'));
    (async () => {
      const pos: [number, number] = windowToWorld(view, [e.clientX, e.clientY]);
      for (const file of files) {
        const bitmap = await createImageBitmap(file);
        const size: [number, number] = [14, 11];
        state.pictures.push({
          name: file.name,
          pos: [pos[0], pos[1]],
          size,
          blob: file,
          bitmap,
        });
        pos[0] += 16;
        pos[1] += 16;
      }
      await storeState(state);
    })().catch((error) => console.error(error));
  });
}

function resize({ canvas, state, view }: { canvas: HTMLCanvasElement; state: State; view: View }) {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  redraw({ canvas, state, view });
}

function redraw({ canvas, state, view }: { canvas: HTMLCanvasElement; state: State; view: View }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Context not found');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(getMatrix(view));
  for (const picture of state.pictures) {
    ctx.drawImage(picture.bitmap, ...crop(picture));
  }
  ctx.restore();
}
