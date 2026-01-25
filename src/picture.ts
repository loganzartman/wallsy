import type { Library } from './state';

export type Picture = {
  name: string;
  pos: [number, number];
  size: [number, number];
};

/** Return source rectangle and destination rectangles for drawing the picture */
export function crop({
  picture,
  library,
}: {
  picture: Picture;
  library: Library;
}): [number, number, number, number, number, number, number, number] {
  const bitmap = library.get(picture.name)?.bitmap;
  if (!bitmap) {
    throw new Error(`Library image ${picture.name} not found`);
  }
  const sourceRatio = bitmap.width / bitmap.height;
  const targetRatio = picture.size[0] / picture.size[1];

  const dx = picture.pos[0] - picture.size[0] / 2;
  const dy = picture.pos[1] - picture.size[1] / 2;
  const dw = picture.size[0];
  const dh = picture.size[1];

  // wider; keep width, crop top and bottom
  if (targetRatio > sourceRatio) {
    const sx = 0;
    const sw = bitmap.width;
    const heightCrop = bitmap.height - bitmap.height * (sourceRatio / targetRatio);
    const sy = heightCrop / 2;
    const sh = bitmap.height - heightCrop;
    return [sx, sy, sw, sh, dx, dy, dw, dh];
  }
  // taller; crop left and right
  else {
    const sy = 0;
    const sh = bitmap.height;
    const widthCrop = bitmap.width - bitmap.width * (targetRatio / sourceRatio);
    const sx = widthCrop / 2;
    const sw = bitmap.width - widthCrop;
    return [sx, sy, sw, sh, dx, dy, dw, dh];
  }
}

export function hitTest({
  pictures,
  library,
  pos,
}: {
  pictures: Picture[];
  library: Library;
  pos: [number, number];
}): Picture | null {
  for (let i = pictures.length - 1; i >= 0; i--) {
    const picture = pictures[i];
    const [_sx, _sy, _sw, _sh, dx, dy, dw, dh] = crop({ picture, library });
    if (pos[0] >= dx && pos[0] <= dx + dw && pos[1] >= dy && pos[1] <= dy + dh) {
      return picture;
    }
  }
  return null;
}
