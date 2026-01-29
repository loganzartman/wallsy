import { loadState, storeState } from './db';
import { debounce } from './debounce';
import {
  applyForces,
  layoutCluster,
  layoutHorizontalRail,
  layoutVerticalRail,
  separate,
  snapPointToGrid,
  snapToGrid,
} from './layout';
import { crop, hitTest, type Picture } from './picture';
import { createStateHistory, emptyState, generateManifest, generatePicturesZip, moveToTop, type State } from './state';
import { clearMeasure, emptyView, getMatrix, startMeasure, windowToWorld, worldToWindow, type View } from './view';

export async function init() {
  const canvas = el(HTMLCanvasElement, 'canvas');
  const emptyOverlay = el(HTMLElement, 'empty-overlay');
  const dragOverlay = el(HTMLElement, 'drag-overlay');
  const clearButton = el(HTMLButtonElement, 'clear-button');

  const layoutClusterButton = el(HTMLButtonElement, 'layout-cluster-button');
  const layoutHrailButton = el(HTMLButtonElement, 'layout-hrail-button');
  const layoutVrailButton = el(HTMLButtonElement, 'layout-vrail-button');

  const exportBomButton = el(HTMLButtonElement, 'export-bom-button');
  const exportImagesButton = el(HTMLButtonElement, 'export-images-button');

  const selectedPictureControls = el(HTMLElement, 'selected-picture-controls');
  const selectedPictureWidth = el(HTMLInputElement, 'selected-picture-width');
  const selectedPictureHeight = el(HTMLInputElement, 'selected-picture-height');
  const selectedPictureDelete = el(HTMLButtonElement, 'selected-picture-delete');
  const selectedPictureClone = el(HTMLButtonElement, 'selected-picture-clone');
  const selectedPictureSizeHotbar = el(HTMLElement, 'selected-picture-size-hotbar');
  const selectedPictureSizeHotbarTemplate = el(HTMLTemplateElement, 'selected-picture-size-hotbar-template');
  const selectedPictureFlip = el(HTMLButtonElement, 'selected-picture-flip');

  const controlsAutoLayout = el(HTMLInputElement, 'auto-layout-input');
  const controlsSnapToGrid = el(HTMLInputElement, 'snap-to-grid-input');
  const controlsGridSize = el(HTMLInputElement, 'grid-size-input');

  const state = (await loadState()) ?? emptyState();
  const history = createStateHistory(state);
  const view = emptyView();

  let isAutoLayout = controlsAutoLayout.checked;
  let isSnapToGrid = controlsSnapToGrid.checked;

  let draggingPicture: Picture | null = null;
  let dragOffset: [number, number] = [0, 0];
  let panning = false;
  let panOffset: [number, number] = [0, 0];

  function renderPictureSizeHotbar() {
    selectedPictureSizeHotbar.innerHTML = '';
    if (!view.selectedPicture) {
      return;
    }

    const smallestFirst = view.selectedPicture.size[0] < view.selectedPicture.size[1];
    const countBySize = new Map<string, number>();
    for (const picture of state.pictures) {
      const smallest = Math.min(picture.size[0], picture.size[1]);
      const largest = Math.max(picture.size[0], picture.size[1]);
      const size = `${smallestFirst ? smallest : largest}x${smallestFirst ? largest : smallest}`;
      countBySize.set(size, (countBySize.get(size) ?? 0) + 1);
    }
    const sizes = Array.from(countBySize.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5);

    for (const [size] of sizes) {
      const [width, height] = size.split('x').map(Number.parseFloat);
      const clone = document.importNode(selectedPictureSizeHotbarTemplate.content, true);

      const button = clone.querySelector('button');
      if (!button) {
        throw new Error('Button not found');
      }
      button.addEventListener('click', () => {
        if (!view.selectedPicture) {
          return;
        }
        view.selectedPicture.size = [width, height];
        handleSelect(view.selectedPicture);
        handleStateUpdated();
        view.dirty = true;
        save();
      });

      const widthElement = clone.querySelector('.hotbar-item__width');
      const separatorElement = clone.querySelector('.hotbar-item__separator');
      const heightElement = clone.querySelector('.hotbar-item__height');

      if (!widthElement || !separatorElement || !heightElement) {
        throw new Error('Hotbar item elements not found');
      }

      (widthElement as HTMLElement).innerText = width.toString();
      (separatorElement as HTMLElement).innerText = 'x';
      (heightElement as HTMLElement).innerText = height.toString();

      selectedPictureSizeHotbar.appendChild(clone);
    }
  }

  function handleStateUpdated() {
    if (state.pictures.length === 0) {
      emptyOverlay.style.opacity = '1';
    } else {
      emptyOverlay.style.opacity = '0';
    }
    renderPictureSizeHotbar();
    view.dirty = true;
    redraw({ canvas, state, view });
  }
  handleStateUpdated();

  function frame() {
    if (isAutoLayout) {
      for (let i = 0; i < 10; i++) {
        const forces = new Map<Picture, [number, number]>();
        separate({ state, forces: new Map(), separation: state.gridSize });
        applyForces(forces);
        if (isSnapToGrid) {
          snapToGrid(state, state.gridSize);
        }
      }
      handleStateUpdated();
      view.dirty = true;
    }
    redraw({ canvas, state, view });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => resize({ canvas, state, view }));
  resize({ canvas, state, view });

  const save = debounce(() => {
    history.pushState();
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

    renderPictureSizeHotbar();
  }

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      history.undo();
      handleStateUpdated();
      storeState(state).catch((error) => console.error(error));
      return;
    }

    if (
      ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'y') ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
    ) {
      history.redo();
      handleStateUpdated();
      storeState(state).catch((error) => console.error(error));
      return;
    }

    if (e.key === 'Escape') {
      clearMeasure(view);
      handleSelect(null);
      return;
    }
    if (e.key === 'm') {
      startMeasure(view);
      handleSelect(null);
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
      return;
    }
  });

  selectedPictureWidth.addEventListener('input', () => {
    if (!view.selectedPicture) {
      return;
    }

    const value = Number.parseFloat(selectedPictureWidth.value);
    if (isNaN(value) || value <= 0.5) {
      return;
    }

    view.selectedPicture.size[0] = value;
    handleStateUpdated();
    save();
    handleSelect(view.selectedPicture);
  });

  selectedPictureHeight.addEventListener('input', () => {
    if (!view.selectedPicture) {
      return;
    }

    const value = Number.parseFloat(selectedPictureHeight.value);
    if (isNaN(value) || value <= 0.5) {
      return;
    }

    view.selectedPicture.size[1] = value;
    handleStateUpdated();
    save();
    handleSelect(view.selectedPicture);
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
  });

  selectedPictureClone.addEventListener('click', () => {
    if (!view.selectedPicture) {
      return;
    }

    const newPicture = {
      ...structuredClone(view.selectedPicture),
      pos: [view.selectedPicture.pos[0] + 1, view.selectedPicture.pos[1] - 1],
    } satisfies Picture;

    state.pictures.push(newPicture);
    handleStateUpdated();
    handleSelect(newPicture);
    handleStateUpdated();
    save();
  });

  selectedPictureFlip.addEventListener('click', () => {
    if (!view.selectedPicture) {
      return;
    }
    view.selectedPicture.size = [view.selectedPicture.size[1], view.selectedPicture.size[0]];
    handleSelect(view.selectedPicture);
    handleStateUpdated();
    save();
    view.dirty = true;
  });

  controlsAutoLayout.addEventListener('change', () => {
    isAutoLayout = controlsAutoLayout.checked;
  });

  controlsSnapToGrid.addEventListener('change', () => {
    isSnapToGrid = controlsSnapToGrid.checked;
  });

  controlsGridSize.addEventListener('input', () => {
    state.gridSize = Number.parseInt(controlsGridSize.value);
    handleStateUpdated();
    save();
  });

  clearButton.addEventListener('click', () => {
    if (confirm('Really clear everything?')) {
      (async () => {
        handleSelect(null);
        emptyState(state);
        handleStateUpdated();
        save();
      })().catch((error) => console.error(error));
    }
  });

  layoutClusterButton.addEventListener('click', () => {
    layoutCluster(state, view).then(() => {
      handleStateUpdated();
      save();
    });
  });

  layoutHrailButton.addEventListener('click', () => {
    layoutHorizontalRail(state, view).then(() => {
      handleStateUpdated();
      save();
    });
  });

  layoutVrailButton.addEventListener('click', () => {
    layoutVerticalRail(state, view).then(() => {
      handleStateUpdated();
      save();
    });
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
      view.dirty = true;
      return;
    }

    const picture = hitTest({
      pictures: state.pictures,
      library: state.library,
      pos: windowToWorld(view, [e.clientX, e.clientY]),
    });

    if (!picture) {
      handleSelect(null);

      panning = true;
      panOffset = [e.clientX, e.clientY];

      view.dirty = true;
      return;
    }

    moveToTop(state, picture);
    draggingPicture = picture;
    handleSelect(picture);
    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    dragOffset = [worldPos[0] - picture.pos[0], worldPos[1] - picture.pos[1]];
    handleStateUpdated();
    save();
  });

  document.addEventListener('pointermove', (e) => {
    if (panning) {
      e.preventDefault();
      const delta = [e.clientX - panOffset[0], e.clientY - panOffset[1]] as const;
      const deltaWorld = windowToWorld(view, delta, true);
      view.pan[0] += deltaWorld[0];
      view.pan[1] += deltaWorld[1];

      panOffset = [e.clientX, e.clientY];
      view.dirty = true;
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
      handleStateUpdated();
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
      view.dirty = true;
      redraw({ canvas, state, view });
      return;
    }

    const worldPos = windowToWorld(view, [e.clientX, e.clientY]);
    const hoveredPicture =
      e.target === canvas ? hitTest({ pictures: state.pictures, library: state.library, pos: worldPos }) : null;
    if (hoveredPicture !== view.hoveredPicture) {
      view.hoveredPicture = hoveredPicture;
      view.dirty = true;
      redraw({ canvas, state, view });
    }
  });

  document.addEventListener('pointerup', () => {
    if (draggingPicture) {
      save();
    }
    draggingPicture = null;
    panning = false;
  });

  document.addEventListener('wheel', (e) => {
    if (e.target !== canvas) {
      return;
    }

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

    view.dirty = true;
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

        // enforce filename uniqueness
        const [, basename, extension = ''] = /^(.+)\.([^.]+)$/.exec(file.name) ?? [file.name];
        let name = file.name;
        let i = 0;
        while (state.library.has(name)) {
          name = `${basename} (${++i}).${extension}`;
        }
        const updatedFile = new File([file], name, file);

        state.pictures.push({
          name,
          pos: [pos[0], pos[1]],
          size,
        });

        state.library.set(name, {
          name,
          blob: updatedFile,
          bitmap,
        });

        pos[0] += 1;
        pos[1] += 1;
      }
      handleStateUpdated();
      save();
    })().catch((error) => console.error(error));
  });
}

function resize({ canvas, state, view }: { canvas: HTMLCanvasElement; state: State; view: View }) {
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  view.dirty = true;
  redraw({ canvas, state, view });
}

function redraw({ canvas, state, view }: { canvas: HTMLCanvasElement; state: State; view: View }) {
  if (!view.dirty) {
    return;
  }
  view.dirty = false;

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
    const bitmap = state.library.get(picture.name)?.bitmap;
    if (!bitmap) {
      throw new Error(`Library image ${picture.name} not found`);
    }
    const dimensions = crop({ picture, library: state.library });

    ctx.save();
    ctx.shadowBlur = 1 / pixelSize;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(bitmap, ...dimensions);
    ctx.restore();

    if (view.selectedPicture === picture) {
      const [_sx, _sy, _sw, _sh, dx, dy, dw, dh] = dimensions;
      ctx.beginPath();
      ctx.roundRect(dx, dy, dw, dh, 4 * pixelSize);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 8 * pixelSize;
      ctx.stroke();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 3 * pixelSize;
      ctx.stroke();
    } else if (view.hoveredPicture === picture) {
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
