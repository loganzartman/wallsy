import type { State } from './state';
import { Picture } from './picture';

export function snapPointToGrid(point: [number, number], cellSize: number): [number, number] {
  return [Math.round(point[0] / cellSize) * cellSize, Math.round(point[1] / cellSize) * cellSize];
}

export function snapToGrid(state: State, cellSize: number) {
  for (const picture of state.pictures) {
    const x1 = picture.pos[0] - picture.size[0] / 2;
    const y1 = picture.pos[1] - picture.size[1] / 2;
    const rx = Math.round(x1 / cellSize) * cellSize;
    const ry = Math.round(y1 / cellSize) * cellSize;
    picture.pos[0] = rx + picture.size[0] / 2;
    picture.pos[1] = ry + picture.size[1] / 2;
  }
}

export function separate(state: State, separation: number) {
  const forces = new Map<Picture, [number, number]>();

  for (const picture of state.pictures) {
    for (const otherPicture of state.pictures) {
      if (picture === otherPicture) continue;

      // Calculate bounding boxes
      const x1 = picture.pos[0] - picture.size[0] / 2;
      const x2 = picture.pos[0] + picture.size[0] / 2;
      const y1 = picture.pos[1] - picture.size[1] / 2;
      const y2 = picture.pos[1] + picture.size[1] / 2;
      const ox1 = otherPicture.pos[0] - otherPicture.size[0] / 2;
      const ox2 = otherPicture.pos[0] + otherPicture.size[0] / 2;
      const oy1 = otherPicture.pos[1] - otherPicture.size[1] / 2;
      const oy2 = otherPicture.pos[1] + otherPicture.size[1] / 2;

      const isOverlapX = x1 < ox2 + separation && x2 > ox1 - separation;
      const isOverlapY = y1 < oy2 + separation && y2 > oy1 - separation;

      if (!(isOverlapX && isOverlapY)) {
        continue;
      }

      // Calculate overlap amounts in each direction
      const overlapX = Math.min(x2, ox2) - Math.max(x1, ox1) + separation;
      const overlapY = Math.min(y2, oy2) - Math.max(y1, oy1) + separation;

      // Determine push direction based on center positions
      // Use array index as tiebreaker when positions are equal
      const pictureIdx = state.pictures.indexOf(picture);
      const otherIdx = state.pictures.indexOf(otherPicture);
      const pushDirX =
        picture.pos[0] < otherPicture.pos[0] || (picture.pos[0] === otherPicture.pos[0] && pictureIdx < otherIdx)
          ? -1
          : 1;
      const pushDirY =
        picture.pos[1] < otherPicture.pos[1] || (picture.pos[1] === otherPicture.pos[1] && pictureIdx < otherIdx)
          ? -1
          : 1;

      // Initialize force for this picture if needed
      if (!forces.has(picture)) {
        forces.set(picture, [0, 0]);
      }
      const force = forces.get(picture)!;

      // Push in direction of smallest overlap
      if (overlapX < overlapY) {
        force[0] += pushDirX * overlapX * 0.5;
      } else {
        force[1] += pushDirY * overlapY * 0.5;
      }
    }
  }

  for (const [picture, force] of forces) {
    picture.pos[0] += force[0];
    picture.pos[1] += force[1];
  }
}
