import { clearState, loadState, storeState } from './db';
import { debounce } from './debounce';
import { layoutCluster, layoutHorizontalRail, separate, snapPointToGrid, snapToGrid } from './layout';
import { crop, hitTest, type Picture } from './picture';
import { emptyState, generateManifest, generatePicturesZip, moveToTop, type State } from './state';
import { clearMeasure, emptyView, getMatrix, startMeasure, windowToWorld, worldToWindow, type View } from './view';

let dirty = true;

export async function init() {
  const canvas = el(HTMLCanvasElement, 'canvas');
  const emptyOverlay = el(HTMLElement, 'empty-overlay');
  const dragOverlay = el(HTMLElement, 'drag-overlay');
  const clearButton = el(HTMLButtonElement, 'clear-button');

  const layoutClusterButton = el(HTMLButtonElement, 'layout-cluster-button');
  const layoutGridButton = el(HTMLButtonElement, 'layout-grid-button');
  const layoutRowButton = el(HTMLButtonElement, 'layout-row-button');
  const layoutColumnButton = el(HTMLButtonElement, 'layout-column-button');
  const layoutHrailButton = el(HTMLButtonElement, 'layout-hrail-button');
  const layoutVrailButton = el(HTMLButtonElement, 'layout-vrail-button');

  const exportBomButton = el(HTMLButtonElement, 'export-bom-button');
  const exportImagesButton = el(HTMLButtonElement, 'export-images-button');

  const selectedPictureControls = el(HTMLElement, 'selected-picture-controls');
  const selectedPictureWidth = el(HTMLInputElement, 'selected-picture-width');
  const selectedPictureHeight = el(HTMLInputElement, 'selected-picture-height');
  const selectedPictureDelete = el(HTMLButtonElement, 'selected-picture-delete');
  const selectedPictureClone = el(HTMLButtonElement, 'selected-picture-clone');

  const controlsAutoLayout = el(HTMLInputElement, 'auto-layout-input');
  const controlsSnapToGrid = el(HTMLInputElement, 'snap-to-grid-input');
  const controlsGridSize = el(HTMLInputElement, 'grid-size-input');

  const state = (await loadState()) ?? emptyState();
  const view = emptyView();

  let isAutoLayout = controlsAutoLayout.checked;
  let isSnapToGrid = controlsSnapToGrid.checked;

  let draggingPicture: Picture | null = null;
  let dragOffset: [number, number] = [0, 0];
  let panning = false;
  let panOffset: [number, number] = [0, 0];

  function handleStateUpdated() {
    if (state.pictures.length === 0) {
      emptyOverlay.style.opacity = '1';
    } else {
      emptyOverlay.style.opacity = '0';
    }
  }
  handleStateUpdated();

  function frame() {
    if (isAutoLayout) {
      for (let i = 0; i < 10; i++) {
        separate(state, state.gridSize);
        if (isSnapToGrid) {
          snapToGrid(state, state.gridSize);
        }
      }
      handleStateUpdated();
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
    view.hoveredPicture = null;

    if (!picture) {
      selectedPictureControls.classList.remove('visible');
      return;
    }

    selectedPictureWidth.value = picture.size[0].toString();
    selectedPictureHeight.value = picture.size[1].toString();

    const [left, top] = worldToWindow(view, [picture.pos[0], picture.pos[1] + picture.size[1] / 2]);
    selectedPictureControls.classList.add('visible');
    selectedPictureControls.style.left = `${left}px`;
    selectedPictureControls.style.top = `${top}px`;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearMeasure(view);
      handleSelect(null);
      dirty = true;
      return;
    }
    if (e.key === 'm') {
      startMeasure(view);
      handleSelect(null);
      dirty = true;
      return;
    }

    const targetPicture = view.hoveredPicture ?? view.selectedPicture;
    if (!targetPicture) {
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'x') {
      state.pictures = state.pictures.filter((p) => p !== targetPicture);
      handleStateUpdated();
      handleSelect(null);
      save();
      dirty = true;
      return;
    }
    if (e.key === 'd') {
      const newPicture = {
        ...targetPicture,
        pos: [targetPicture.pos[0] + 1, targetPicture.pos[1] + 1],
      } satisfies Picture;
      state.pictures.push(newPicture);
      handleStateUpdated();
      handleSelect(newPicture);
      save();
      dirty = true;
      return;
    }
  });

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
    handleStateUpdated();
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
    handleStateUpdated();
    handleSelect(newPicture);

    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  controlsAutoLayout.addEventListener('change', () => {
    isAutoLayout = controlsAutoLayout.checked;
  });

  controlsSnapToGrid.addEventListener('change', () => {
    isSnapToGrid = controlsSnapToGrid.checked;
  });

  controlsGridSize.addEventListener('change', () => {
    state.gridSize = Number.parseInt(controlsGridSize.value);
    handleStateUpdated();
    save();
  });

  clearButton.addEventListener('click', () => {
    if (confirm('Really clear everything?')) {
      (async () => {
        handleSelect(null);
        await clearState();
        emptyState(state);
        handleStateUpdated();
        dirty = true;
      })().catch((error) => console.error(error));
    }
  });

  layoutClusterButton.addEventListener('click', () => {
    layoutCluster(state);
    handleStateUpdated();
    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  layoutHrailButton.addEventListener('click', () => {
    layoutHorizontalRail(state);
    handleStateUpdated();
    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  exportBomButton.addEventListener('click', () => {
    const manifest = generateManifest(state);
    const blob = new Blob([manifest], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-of-materials_${fileDate()}.csv`;
    a.click();
  });

  exportImagesButton.addEventListener('click', () => {
    (async () => {
      const blob = await generatePicturesZip(state);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `images_${fileDate()}.zip`;
      a.click();
    })().catch((error) => console.error(error));
  });

  // handle moving pictures
  document.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) {
      return;
    }

    if (view.measuring && view.measuring !== 'done') {
      if (view.measuring === 'first') {
        view.measuring = 'second';
      } else {
        view.measuring = 'done';
      }
      dirty = true;
      redraw({ canvas, state, view });
      return;
    }

    const picture = hitTest(state.pictures, windowToWorld(view, [e.clientX, e.clientY]));
    if (!picture) {
      handleSelect(null);

      panning = true;
      panOffset = [e.clientX, e.clientY];

      return;
    }

    moveToTop(state, picture);
    draggingPicture = picture;
    handleSelect(picture);
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    dragOffset = [worldPos[0] - picture.pos[0], worldPos[1] - picture.pos[1]];
    save();
    dirty = true;
    redraw({ canvas, state, view });
  });

  document.addEventListener('pointermove', (e) => {
    if (panning) {
      e.preventDefault();
      const delta = [e.clientX - panOffset[0], e.clientY - panOffset[1]] as const;
      const deltaWorld = windowToWorld(view, delta, true);
      view.pan[0] += deltaWorld[0];
      view.pan[1] += deltaWorld[1];

      panOffset = [e.clientX, e.clientY];
      dirty = true;
      redraw({ canvas, state, view });
      return;
    }

    if (draggingPicture) {
      e.preventDefault();
      const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
      draggingPicture.pos = [worldPos[0] - dragOffset[0], worldPos[1] - dragOffset[1]];

      if (isSnapToGrid) {
        snapToGrid(state, state.gridSize);
      }

      handleSelect(draggingPicture);
      save();
      dirty = true;
      redraw({ canvas, state, view });
      return;
    }

    if (view.measuring && view.measuring !== 'done') {
      let mousePos = windowToWorld(view, [e.clientX, e.clientY]);
      if (isSnapToGrid) {
        mousePos = snapPointToGrid(mousePos, state.gridSize);
      }
      if (view.measuring === 'first') {
        view.measureFrom = mousePos;
      } else if (view.measuring === 'second') {
        view.measureTo = mousePos;
      }
      dirty = true;
      redraw({ canvas, state, view });
      return;
    }

    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    const hoveredPicture = e.target === canvas ? hitTest(state.pictures, worldPos) : null;
    if (hoveredPicture !== view.hoveredPicture) {
      view.hoveredPicture = hoveredPicture;
      dirty = true;
      redraw({ canvas, state, view });
    }
  });

  document.addEventListener('pointerup', () => {
    draggingPicture = null;
    panning = false;
  });

  document.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Get world position under cursor before zoom
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);

    // Apply zoom (scroll down = zoom out, scroll up = zoom in)
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    view.scale = Math.max(1, Math.min(200, view.scale * zoomFactor));

    // Get world position under cursor after zoom
    const newWorldPos = windowToWorld(view, [e.clientX, e.clientY]);

    // Adjust pan so the same world position stays under cursor
    view.pan[0] += newWorldPos[0] - worldPos[0];
    view.pan[1] += newWorldPos[1] - worldPos[1];

    dirty = true;
    redraw({ canvas, state, view });
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
      handleStateUpdated();
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

    ctx.save();
    ctx.shadowBlur = 1 / pixelSize;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(picture.bitmap, ...dimensions);
    ctx.restore();

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
    } else if (view.hoveredPicture === picture) {
      const [_sx, _sy, _sw, _sh, dx, dy, dw, dh] = dimensions;
      ctx.fillStyle = '#31a7f340';
      ctx.fillRect(dx, dy, dw, dh);
    }
  }

  if (view.measuring && view.measureFrom) {
    if (view.measureTo) {
      ctx.beginPath();
      ctx.moveTo(view.measureFrom[0], view.measureFrom[1]);
      ctx.lineTo(view.measureTo[0], view.measureTo[1]);

      ctx.strokeStyle = 'black';
      ctx.lineWidth = 10 * pixelSize;
      ctx.stroke();

      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4 * pixelSize;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(view.measureFrom[0], view.measureFrom[1], 4 * pixelSize, 0, 2 * Math.PI);

    ctx.lineWidth = 6 * pixelSize;
    ctx.strokeStyle = 'black';
    ctx.fillStyle = 'white';
    ctx.stroke();
    ctx.fill();

    if (view.measureTo) {
      ctx.beginPath();
      ctx.arc(view.measureTo[0], view.measureTo[1], 4 * pixelSize, 0, 2 * Math.PI);

      ctx.lineWidth = 6 * pixelSize;
      ctx.strokeStyle = 'black';
      ctx.stroke();
      ctx.fillStyle = 'white';
      ctx.fill();

      const dx = view.measureTo[0] - view.measureFrom[0];
      const dy = view.measureTo[1] - view.measureFrom[1];
      const angle = Math.atan2(dy, dx);
      const length = Math.hypot(dx, dy);
      const text = `${length.toFixed(1)}`;
      const textX = view.measureFrom[0] + dx * 0.5 + Math.cos(angle + Math.PI / 2) * 36 * pixelSize;
      const textY = view.measureFrom[1] + dy * 0.5 + Math.sin(angle + Math.PI / 2) * 36 * pixelSize;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${36 * pixelSize}px system-ui`;

      ctx.lineWidth = 6 * pixelSize;
      ctx.fillStyle = 'black';
      ctx.strokeText(text, textX, textY);
      ctx.fillStyle = 'white';
      ctx.fillText(text, textX, textY);
    }
  }

  ctx.restore();
}

function el<T extends HTMLElement>(ctor: { new (...args: unknown[]): T }, id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element ${id} not found`);
  }
  if (!(element instanceof ctor)) {
    throw new Error(`Element ${id} is not a ${ctor.name}`);
  }
  return element;
}

function fileDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}
