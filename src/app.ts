import { clearState, loadState, storeState } from './db';
import { crop, hitTest, type Picture } from './picture';
import { emptyState, moveToTop, type State } from './state';
import { emptyView, getMatrix, windowToWorld, type View } from './view';

let dirty = true;

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
        dirty = true;
      })().catch((error) => console.error(error));
    }
  });

  // handle moving pictures
  let draggingPicture: Picture | null = null;
  let dragOffset: [number, number] = [0, 0];
  document.addEventListener('pointerdown', (e) => {
    const picture = hitTest(state.pictures, windowToWorld(view, [e.clientX, e.clientY]));
    if (!picture) {
      return;
    }
    moveToTop(state, picture);
    draggingPicture = picture;
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    dragOffset = [worldPos[0] - picture.pos[0], worldPos[1] - picture.pos[1]];
    dirty = true;
    redraw({ canvas, state, view });
  });
  document.addEventListener('pointermove', (e) => {
    if (!draggingPicture) {
      return;
    }
    e.preventDefault();
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    draggingPicture.pos = [worldPos[0] - dragOffset[0], worldPos[1] - dragOffset[1]];
    dirty = true;
    redraw({ canvas, state, view });
  });
  document.addEventListener('pointerup', (e) => {
    draggingPicture = null;
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
      dirty = true;
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
  if (!dirty) {
    return;
  }
  dirty = false;

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
