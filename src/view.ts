import type { Picture } from './picture';

export type View = {
  pan: [number, number];
  scale: number;
  selectedPicture: Picture | null;
};

export function emptyView(view?: View): View {
  if (!view) {
    return {
      pan: [0, 0],
      scale: 20,
      selectedPicture: null,
    };
  }
  view.pan = [0, 0];
  view.scale = 1;
  return view;
}

export function getMatrix(view: View): DOMMatrix {
  return new DOMMatrix()
    .scale(window.devicePixelRatio)
    .translate(window.innerWidth / 2, window.innerHeight / 2)
    .scale(view.scale)
    .translate(...view.pan);
}

export function windowToWorld(view: View, point: [number, number], vector: boolean = false): [number, number] {
  const matrix = getMatrix(view).inverse();
  const result = matrix.transformPoint({
    x: point[0] * window.devicePixelRatio,
    y: point[1] * window.devicePixelRatio,
    w: vector ? 0 : 1,
  });
  return [result.x, result.y];
}

export function worldToWindow(view: View, point: [number, number], vector: boolean = false): [number, number] {
  const matrix = getMatrix(view);
  const result = matrix.transformPoint({
    x: point[0],
    y: point[1],
    w: vector ? 0 : 1,
  });
  return [result.x / window.devicePixelRatio, result.y / window.devicePixelRatio];
}
