import type { Library } from './state';

export type Picture = {
  name: string;
  pos: [number, number];
  size: [number, number];
};

/**
 * Return source rectangle and destination rectangles for drawing the picture.
 */
export function crop({
  picture,
  library,
  trim = 0,
}: {
  picture: Picture;
  library: Library;
  trim?: number;
}): [number, number, number, number, number, number, number, number] {
  const bitmap = library.get(picture.name)?.bitmap;
  if (!bitmap) {
    throw new Error(`Library image ${picture.name} not found`);
  }

  // virtual size includes trim on all edges (simulates larger canvas for wrapping)
  const virtualWidth = picture.size[0] + 2 * trim;
  const virtualHeight = picture.size[1] + 2 * trim;

  const sourceRatio = bitmap.width / bitmap.height;
  const targetRatio = virtualWidth / virtualHeight;

  const dx = picture.pos[0] - picture.size[0] / 2;
  const dy = picture.pos[1] - picture.size[1] / 2;
  const dw = picture.size[0];
  const dh = picture.size[1];

  let sx: number, sy: number, sw: number, sh: number;

  if (targetRatio > sourceRatio) {
    // wider; keep width, crop top and bottom
    sx = 0;
    sw = bitmap.width;
    const heightCrop = bitmap.height - bitmap.height * (sourceRatio / targetRatio);
    sy = heightCrop / 2;
    sh = bitmap.height - heightCrop;
  } else {
    // taller; crop left and right
    sy = 0;
    sh = bitmap.height;
    const widthCrop = bitmap.width - bitmap.width * (targetRatio / sourceRatio);
    sx = widthCrop / 2;
    sw = bitmap.width - widthCrop;
  }

  // further crop to get only the center portion that maps to the visible canvas
  if (trim > 0) {
    const trimFractionX = trim / virtualWidth;
    const trimFractionY = trim / virtualHeight;

    const additionalCropX = sw * trimFractionX;
    const additionalCropY = sh * trimFractionY;

    sx += additionalCropX;
    sy += additionalCropY;
    sw -= 2 * additionalCropX;
    sh -= 2 * additionalCropY;
  }

  return [sx, sy, sw, sh, dx, dy, dw, dh];
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
