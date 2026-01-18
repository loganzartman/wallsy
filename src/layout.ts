import type { State } from './state';
import { crop } from './picture';

export function shiftTowardPoint(state: State, target: [number, number], amount: number) {
  for (const picture of state.pictures) {
    const dist = Math.hypot(picture.pos[0] - target[0], picture.pos[1] - target[1]);
    const dx = (target[0] - picture.pos[0]) / dist;
    const dy = (target[1] - picture.pos[1]) / dist;
    picture.pos[0] += dx * amount;
    picture.pos[1] += dy * amount;
  }
}

export function separate(state: State, separation: number) {
  const crops = new Map(state.pictures.map((picture) => [picture, crop(picture)]));

  for (const [picture, pictureCrop] of crops) {
    for (const [otherPicture, otherCrop] of crops) {
      if (picture === otherPicture) continue;

      const [_sx, _sy, _sw, _sh, dx, dy, dw, dh] = pictureCrop;
      const [_osx, _osy, _osw, _osh, odx, ody, odw, odh] = otherCrop;

      const x1 = dx - dw / 2;
      const x2 = dx + dw / 2;
      const y1 = dy - dh / 2;
      const y2 = dy + dh / 2;
      const ox1 = odx - odw / 2;
      const ox2 = odx + odw / 2;
      const oy1 = ody - odh / 2;
      const oy2 = ody + odh / 2;

      const overlapX = x1 < ox2 + separation && x2 > ox1 - separation;
      const overlapY = y1 < oy2 + separation && y2 > oy1 - separation;

      if (overlapX && overlapY) {
        const centerDx = dx - odx;
        const centerDy = dy - ody;
        const dist = Math.hypot(centerDx, centerDy);

        if (dist > 0) {
          const nx = centerDx / dist;
          const ny = centerDy / dist;
          const overlapAmount = Math.min(
            ox2 + separation - x1,
            x2 + separation - ox1,
            oy2 + separation - y1,
            y2 + separation - oy1,
          );
          picture.pos[0] += (nx * overlapAmount) / 2;
          picture.pos[1] += (ny * overlapAmount) / 2;
        }
      }
    }
  }
}
