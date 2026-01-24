import type { State } from './state';
import { Picture } from './picture';

const MAX_ITER = 1000;

export function snapPointToGrid(point: [number, number], cellSize: number): [number, number] {
  return [Math.round(point[0] / cellSize) * cellSize, Math.round(point[1] / cellSize) * cellSize];
}

export function snapToGrid(state: State, cellSize: number) {
  for (const picture of state.pictures) {
    const x0 = picture.pos[0] - picture.size[0] / 2;
    const y0 = picture.pos[1] - picture.size[1] / 2;
    const rx = Math.round(x0 / cellSize) * cellSize;
    const ry = Math.round(y0 / cellSize) * cellSize;
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

      // Use array index as tiebreaker when positions are equal
      const pictureIdx = state.pictures.indexOf(picture);
      const otherIdx = state.pictures.indexOf(otherPicture);

      // Compute signed overlap in each axis
      // Sign indicates direction to push (negative = left/up, positive = right/down)
      const overlapX = Math.min(x2, ox2) - Math.max(x1, ox1) + separation;
      const overlapY = Math.min(y2, oy2) - Math.max(y1, oy1) + separation;

      const signX =
        picture.pos[0] < otherPicture.pos[0] || (picture.pos[0] === otherPicture.pos[0] && pictureIdx < otherIdx)
          ? -1
          : 1;
      const signY =
        picture.pos[1] < otherPicture.pos[1] || (picture.pos[1] === otherPicture.pos[1] && pictureIdx < otherIdx)
          ? -1
          : 1;

      // Compute fastest separation vector
      // Weight each axis inversely by its overlap (smaller overlap = faster to escape that way)
      const invOverlapX = 1 / overlapX;
      const invOverlapY = 1 / overlapY;
      const totalInv = invOverlapX + invOverlapY;

      // Direction components weighted by inverse overlap
      const dirX = signX * (invOverlapX / totalInv);
      const dirY = signY * (invOverlapY / totalInv);

      // Normalize to unit vector, scale by minimum overlap (the actual separation needed)
      const len = Math.hypot(dirX, dirY);
      const minOverlap = Math.min(overlapX, overlapY);
      const fastestSepX = (dirX / len) * minOverlap;
      const fastestSepY = (dirY / len) * minOverlap;

      const massFactor =
        1 -
        (picture.size[0] * picture.size[1]) /
          (picture.size[0] * picture.size[1] + otherPicture.size[0] * otherPicture.size[1]);

      if (!forces.has(picture)) {
        forces.set(picture, [0, 0]);
      }
      const force = forces.get(picture)!;

      // Apply fastest separation force
      force[0] += fastestSepX * massFactor;
      force[1] += fastestSepY * massFactor;
    }
  }

  for (const [picture, force] of forces) {
    picture.pos[0] += force[0];
    picture.pos[1] += force[1];
  }
}

function attract(state: State, point: [number, number], amount: number) {
  for (const picture of state.pictures) {
    const dx = point[0] - picture.pos[0];
    const dy = point[1] - picture.pos[1];
    const dist = Math.hypot(dx, dy);
    if (dist < amount) {
      picture.pos[0] = point[0];
      picture.pos[1] = point[1];
    } else {
      picture.pos[0] += (dx * amount) / dist;
      picture.pos[1] += (dy * amount) / dist;
    }
  }
}

function attractHorizontalRail(state: State, margin: number, amount: number) {
  for (const picture of state.pictures) {
    const targetY = picture.pos[1] < 0 ? -picture.size[1] / 2 - margin / 2 : picture.size[1] / 2 + margin / 2;
    const dy = targetY - picture.pos[1];
    const dist = Math.abs(dy);
    if (dist < amount) {
      picture.pos[1] = targetY;
    } else {
      picture.pos[1] += (dy * amount) / dist;
    }
  }
}

function attractToYAxis(state: State, amount: number) {
  for (const picture of state.pictures) {
    const dx = 0 - picture.pos[0];
    const dist = Math.abs(dx);
    if (dist < amount) {
      picture.pos[0] = 0;
    } else {
      picture.pos[0] += (dx * amount) / dist;
    }
  }
}

function centroid(state: State): [number, number] {
  let x = 0;
  let y = 0;
  let weight = 0;
  for (const picture of state.pictures) {
    const area = picture.size[0] * picture.size[1];
    x += picture.pos[0] * area;
    y += picture.pos[1] * area;
    weight += area;
  }
  return [x / weight, y / weight];
}

function center(state: State) {
  const c = centroid(state);
  for (const picture of state.pictures) {
    picture.pos[0] -= c[0];
    picture.pos[1] -= c[1];
  }
}

function trackMovement(state: State): () => number {
  const positions = new Map<Picture, [number, number]>();
  for (const picture of state.pictures) {
    positions.set(picture, [picture.pos[0], picture.pos[1]]);
  }

  return () => {
    let movement = 0;
    for (const picture of state.pictures) {
      const initial = positions.get(picture);
      if (!initial) {
        continue;
      }

      const [x1, y1] = initial;
      const [x2, y2] = picture.pos;
      movement += Math.hypot(x2 - x1, y2 - y1);
    }
    return movement;
  };
}

export function layoutCluster(state: State) {
  for (let i = 0; i < MAX_ITER; ++i) {
    center(state);
    const getMovement = trackMovement(state);
    attract(state, [0, 0], 0.5);
    separate(state, state.gridSize);
    if (getMovement() < 0.1) {
      console.log('cluster done in', i, 'iterations');
      break;
    }
  }

  for (let i = 0; i < MAX_ITER; ++i) {
    const getMovement = trackMovement(state);
    separate(state, state.gridSize);
    if (getMovement() < 0.1) {
      console.log('separate done in', i, 'iterations');
      break;
    }
  }

  snapToGrid(state, state.gridSize);
}

export function layoutHorizontalRail(state: State) {
  for (let i = 0; i < MAX_ITER; ++i) {
    center(state);
    const getMovement = trackMovement(state);
    attractHorizontalRail(state, state.gridSize, 0.5);
    separate(state, state.gridSize);
    if (getMovement() < 0.1) {
      console.log('horizontal rail done in', i, 'iterations');
      break;
    }
  }

  for (let i = 0; i < MAX_ITER; ++i) {
    const getMovement = trackMovement(state);
    attractToYAxis(state, 0.1);
    separate(state, state.gridSize);
    attractHorizontalRail(state, state.gridSize, 0.5);
    separate(state, state.gridSize);
    if (getMovement() < 0.1) {
      console.log('horizontal rail done in', i, 'iterations');
      break;
    }
  }

  for (let i = 0; i < MAX_ITER; ++i) {
    const getMovement = trackMovement(state);
    separate(state, state.gridSize);
    if (getMovement() < 0.1) {
      console.log('separate done in', i, 'iterations');
      break;
    }
  }

  snapToGrid(state, state.gridSize);
}
