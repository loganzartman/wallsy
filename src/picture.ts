export type Picture = {
  name: string;
  pos: [number, number];
  size: [number, number];
  blob: Blob;
  bitmap: ImageBitmap;
};

/** Return source rectangle and destination rectangles for drawing the picture */
export function crop(picture: Picture): [number, number, number, number, number, number, number, number] {
  const sourceRatio = picture.bitmap.width / picture.bitmap.height;
  const targetRatio = picture.size[0] / picture.size[1];

  const dx = picture.pos[0] - picture.size[0] / 2;
  const dy = picture.pos[1] - picture.size[1] / 2;
  const dw = picture.size[0];
  const dh = picture.size[1];

  // wider; keep width, crop top and bottom
  if (targetRatio > sourceRatio) {
    const sx = 0;
    const sw = picture.bitmap.width;
    const heightCrop = picture.bitmap.height - picture.bitmap.height * (sourceRatio / targetRatio);
    const sy = heightCrop / 2;
    const sh = picture.bitmap.height - heightCrop;
    return [sx, sy, sw, sh, dx, dy, dw, dh];
  }
  // taller; crop left and right
  else {
    const sy = 0;
    const sh = picture.bitmap.height;
    const widthCrop = picture.bitmap.width - picture.bitmap.width * (targetRatio / sourceRatio);
    const sx = widthCrop / 2;
    const sw = picture.bitmap.width - widthCrop;
    return [sx, sy, sw, sh, dx, dy, dw, dh];
  }
}
