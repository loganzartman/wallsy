import { clearState, loadState, storeState } from './db';
import { debounce } from './debounce';
import { separate, shiftTowardPoint } from './layout';
import { crop, hitTest, type Picture } from './picture';
import { emptyState, moveToTop, type State } from './state';
import { emptyView, getMatrix, windowToWorld, worldToWindow, type View } from './view';

let dirty = true;

export async function init({
  canvas,
  dragOverlay,
  clearButton,
  selectedPictureControls,
  selectedPictureWidth,
  selectedPictureHeight,
  selectedPictureDelete,
  selectedPictureClone,
  controlsAutoLayout,
}: {
  canvas: HTMLCanvasElement;
  dragOverlay: HTMLElement;
  clearButton: HTMLButtonElement;
  selectedPictureControls: HTMLElement;
  selectedPictureWidth: HTMLInputElement;
  selectedPictureHeight: HTMLInputElement;
  selectedPictureDelete: HTMLButtonElement;
  selectedPictureClone: HTMLButtonElement;
  controlsAutoLayout: HTMLInputElement;
}) {
  let autoLayout = false;
  const state = (await loadState()) ?? emptyState();
  const view = emptyView();

  function frame() {
    if (autoLayout) {
      shiftTowardPoint(state, [0, 0], 0.1);
      separate(state, 1);
      dirty = true;
    }
    redraw({ canvas, state, view });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => resize({ canvas, state, view }));
  resize({ canvas, state, view });

  const save = debounce(() => {
    storeState(state).catch((error) => console.error(error));
  }, 500);

  function handleSelect(picture: Picture | null) {
    view.selectedPicture = picture;

    if (!picture) {
      selectedPictureControls.classList.remove('visible');
      return;
    }

    selectedPictureWidth.value = picture.size[0].toString();
    selectedPictureHeight.value = picture.size[1].toString();

    const [_sx, _sy, _sw, _sh, _dx, _dy, _dw, dh] = crop(picture);
    const [left, top] = worldToWindow(view, [picture.pos[0], picture.pos[1] + dh / 2]);
    selectedPictureControls.classList.add('visible');
    selectedPictureControls.style.left = `${left}px`;
    selectedPictureControls.style.top = `${top}px`;
  }

  selectedPictureWidth.addEventListener('change', () => {
    if (!view.selectedPicture) {
      return;
    }

    const value = Number.parseFloat(selectedPictureWidth.value);
    if (isNaN(value) || value <= 0.5) {
      return;
    }

    view.selectedPicture.size[0] = value;
    save();
    dirty = true;
    redraw({ canvas, state, view });
    handleSelect(view.selectedPicture);
  });

  selectedPictureHeight.addEventListener('change', () => {
    if (!view.selectedPicture) {
      return;
    }

    const value = Number.parseFloat(selectedPictureHeight.value);
    if (isNaN(value) || value <= 0.5) {
      return;
    }

    view.selectedPicture.size[1] = value;
    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  selectedPictureDelete.addEventListener('click', () => {
    if (!view.selectedPicture) {
      return;
    }
    const picture = view.selectedPicture;
    handleSelect(null);
    state.pictures = state.pictures.filter((p) => p !== picture);
    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  selectedPictureClone.addEventListener('click', () => {
    if (!view.selectedPicture) {
      return;
    }

    const newPicture = {
      ...view.selectedPicture,
      pos: [view.selectedPicture.pos[0] + 1, view.selectedPicture.pos[1] + 1],
    } satisfies Picture;

    state.pictures.push(newPicture);
    handleSelect(newPicture);

    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  controlsAutoLayout.addEventListener('change', () => {
    autoLayout = controlsAutoLayout.checked;
  });

  clearButton.addEventListener('click', () => {
    if (confirm('Really clear everything?')) {
      (async () => {
        handleSelect(null);
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
    if (e.target !== canvas) {
      return;
    }

    dirty = true;

    const picture = hitTest(state.pictures, windowToWorld(view, [e.clientX, e.clientY]));
    if (!picture) {
      handleSelect(null);
      return;
    }

    moveToTop(state, picture);
    draggingPicture = picture;
    handleSelect(picture);
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    dragOffset = [worldPos[0] - picture.pos[0], worldPos[1] - picture.pos[1]];
    save();
    redraw({ canvas, state, view });
  });
  document.addEventListener('pointermove', (e) => {
    if (!draggingPicture) {
      return;
    }
    e.preventDefault();
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    draggingPicture.pos = [worldPos[0] - dragOffset[0], worldPos[1] - dragOffset[1]];
    handleSelect(draggingPicture);
    save();
    dirty = true;
    redraw({ canvas, state, view });
  });
  document.addEventListener('pointerup', () => {
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
        pos[0] += 1;
        pos[1] += 1;
      }
      dirty = true;
      save();
    })().catch((error) => console.error(error));
  });
}

function resize({ canvas, state, view }: { canvas: HTMLCanvasElement; state: State; view: View }) {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  dirty = true;
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
  const matrix = getMatrix(view);
  const invMatrix = matrix.inverse();
  const pixelSize = invMatrix.transformPoint({ x: 1, w: 0 }).x;

  ctx.setTransform(matrix);

  for (const picture of state.pictures) {
    const dimensions = crop(picture);

    ctx.drawImage(picture.bitmap, ...dimensions);

    if (view.selectedPicture === picture) {
      const [_sx, _sy, _sw, _sh, dx, dy, dw, dh] = dimensions;
      ctx.beginPath();
      ctx.roundRect(dx, dy, dw, dh, 4 * pixelSize);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 8 * pixelSize;
      ctx.stroke();
      ctx.strokeStyle = '#31a7f3';
      ctx.lineWidth = 3 * pixelSize;
      ctx.stroke();
    }
  }
  ctx.restore();
}
