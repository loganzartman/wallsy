export type View = {
  pan: [number, number];
  scale: number;
};

export function emptyView(view?: View): View {
  if (!view) {
    return {
      pan: [0, 0],
      scale: 20,
    };
  }
  view.pan = [0, 0];
  view.scale = 1;
  return view;
}

export function getMatrix(view: View): DOMMatrix {
  return new DOMMatrix()
    .scale(window.devicePixelRatio)
    .scale(view.scale)
    .translate(...view.pan);
}

export function windowToWorld(view: View, point: [number, number]): [number, number] {
  const matrix = getMatrix(view).inverse();
  const result = matrix.transformPoint({
    x: point[0] * window.devicePixelRatio,
    y: point[1] * window.devicePixelRatio,
  });
  return [result.x, result.y];
}
