import type { Picture } from './picture';

export type View = {
  dirty: boolean;
  pan: [number, number];
  scale: number;

  selectedPicture: Picture | null;
  hoveredPicture: Picture | null;

  measuring: 'first' | 'second' | 'done' | null;
  measureFrom: [number, number] | null;
  measureTo: [number, number] | null;
};

export function emptyView(view?: View): View {
  if (!view) {
    return {
      dirty: true,
      pan: [0, 0],
      scale: 20,

      selectedPicture: null,
      hoveredPicture: null,

      measuring: null,
      measureFrom: null,
      measureTo: null,
    };
  }

  view.dirty = true;
  view.pan = [0, 0];
  view.scale = 1;
  view.selectedPicture = null;
  view.hoveredPicture = null;
  view.measuring = null;
  view.measureFrom = null;
  view.measureTo = null;
  return view;
}

export function clearMeasure(view: View) {
  view.dirty = true;
  view.measuring = null;
  view.measureFrom = null;
  view.measureTo = null;
}

export function startMeasure(view: View) {
  view.dirty = true;
  view.measuring = 'first';
  view.measureFrom = null;
  view.measureTo = null;
}

export function getMatrix(view: View): DOMMatrix {
  return new DOMMatrix()
    .scale(window.devicePixelRatio)
    .translate(window.innerWidth / 2, window.innerHeight / 2)
    .scale(view.scale)
    .translate(...view.pan);
}

export function windowToWorld(view: View, point: readonly [number, number], vector: boolean = false): [number, number] {
  const matrix = getMatrix(view).inverse();
  const result = matrix.transformPoint({
    x: point[0] * window.devicePixelRatio,
    y: point[1] * window.devicePixelRatio,
    w: vector ? 0 : 1,
  });
  return [result.x, result.y];
}

export function worldToWindow(view: View, point: readonly [number, number], vector: boolean = false): [number, number] {
  const matrix = getMatrix(view);
  const result = matrix.transformPoint({
    x: point[0],
    y: point[1],
    w: vector ? 0 : 1,
  });
  return [result.x / window.devicePixelRatio, result.y / window.devicePixelRatio];
}
