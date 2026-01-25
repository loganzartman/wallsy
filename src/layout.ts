import type { State } from './state';
import { Picture } from './picture';
import type { View } from './view';

type Forces = Map<Picture, [number, number]>;

const MAX_ITER = 1000;

function setForce(forces: Forces, picture: Picture, force: [number, number]) {
  forces.set(picture, [...force]);
}

function addForce(forces: Forces, picture: Picture, force: [number, number]) {
  const f = forces.get(picture);
  if (!f) {
    forces.set(picture, [...force]);
    return;
  }
  f[0] += force[0];
  f[1] += force[1];
}

export function applyForces(forces: Forces) {
  for (const [picture, force] of forces) {
    picture.pos[0] += force[0];
    picture.pos[1] += force[1];
  }
}

function trackMovement(state: State): () => number {
  const positions = new Map(state.pictures.map((picture) => [picture, [...picture.pos]]));

  return () => {
    let movement = 0;
    for (const picture of state.pictures) {
      const initial = positions.get(picture);
      if (!initial) {
        continue;
      }
      movement += Math.hypot(picture.pos[0] - initial[0], picture.pos[1] - initial[1]);
    }
    return movement;
  };
}

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

export function separate({
  state,
  forces,
  separation,
  strength = 0.5,
  method = 'radial',
}: {
  state: State;
  forces: Forces;
  separation: number;
  strength?: number;
  method?: 'radial' | 'axis';
}) {
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

      let dx = picture.pos[0] - otherPicture.pos[0];
      let dy = picture.pos[1] - otherPicture.pos[1];
      let dist = Math.hypot(dx, dy);

      // Handle degenerate case: pictures at identical positions
      if (dist < 1e-6) {
        const jitter = Math.random() * Math.PI * 2;
        dx = Math.cos(jitter);
        dy = Math.sin(jitter);
        dist = 1e-6;
      }

      const massFactor =
        1 -
        (picture.size[0] * picture.size[1]) /
          (picture.size[0] * picture.size[1] + otherPicture.size[0] * otherPicture.size[1]);

      if (method === 'axis') {
        const minDistX = (picture.size[0] + otherPicture.size[0]) / 2 + separation;
        const minDistY = (picture.size[1] + otherPicture.size[1]) / 2 + separation;
        const overlapX = minDistX - Math.abs(dx);
        const overlapY = minDistY - Math.abs(dy);

        if (overlapX < overlapY) {
          const sign = dx < 0 ? -1 : 1;
          addForce(forces, picture, [sign * overlapX * massFactor * strength, 0]);
        } else {
          const sign = dy < 0 ? -1 : 1;
          addForce(forces, picture, [0, sign * overlapY * massFactor * strength]);
        }
        continue;
      }

      if (method === 'radial') {
        const angle = Math.atan2(dy, dx);
        const rSelf = Math.min(
          (picture.size[0] + separation) / 2 / Math.abs(Math.cos(angle)),
          (picture.size[1] + separation) / 2 / Math.abs(Math.sin(angle)),
        );
        const rOther = Math.min(
          (otherPicture.size[0] + separation) / 2 / Math.abs(Math.cos(angle)),
          (otherPicture.size[1] + separation) / 2 / Math.abs(Math.sin(angle)),
        );
        const separatedDist = rSelf + rOther;

        const awayX = Math.cos(angle) * (separatedDist - dist);
        const awayY = Math.sin(angle) * (separatedDist - dist);

        addForce(forces, picture, [awayX * massFactor * strength, awayY * massFactor * strength]);
        continue;
      }
    }
  }
}

function attract({
  state,
  forces,
  point,
  amount,
}: {
  state: State;
  forces: Forces;
  point: [number, number];
  amount: number;
}) {
  for (const picture of state.pictures) {
    const dx = point[0] - picture.pos[0];
    const dy = point[1] - picture.pos[1];
    const dist = Math.hypot(dx, dy);
    if (dist < amount) {
      addForce(forces, picture, [dx, dy]);
    } else {
      addForce(forces, picture, [(dx * amount) / dist, (dy * amount) / dist]);
    }
  }
}

function attractRail({
  state,
  forces,
  margin,
  amount,
  mainAxis,
}: {
  state: State;
  forces: Forces;
  margin: number;
  amount: number;
  mainAxis: 'x' | 'y';
}) {
  const crossAxis = mainAxis === 'x' ? 'y' : 'x';
  const crossAxisIndex = crossAxis === 'x' ? 0 : 1;
  const crossAxisDimensionIndex = crossAxis === 'x' ? 0 : 1;

  for (const picture of state.pictures) {
    // Determine target position based on which side of the axis we are on
    const targetPos =
      picture.pos[crossAxisIndex] < 0
        ? -picture.size[crossAxisDimensionIndex] / 2 - margin
        : picture.size[crossAxisDimensionIndex] / 2;

    const forwardSign = picture.pos[crossAxisIndex] < 0 ? 1 : -1;
    const diff = targetPos - picture.pos[crossAxisIndex];
    const dist = Math.abs(diff);

    const force: [number, number] = [0, 0];
    if (dist < amount || forwardSign * diff < 0) {
      force[crossAxisIndex] = diff;
    } else {
      force[crossAxisIndex] = (diff * amount) / dist;
    }

    addForce(forces, picture, force);
  }
}

function projectRail({
  state,
  forces,
  margin,
  mainAxis,
}: {
  state: State;
  forces: Forces;
  margin: number;
  mainAxis: 'x' | 'y';
}) {
  const crossAxis = mainAxis === 'x' ? 'y' : 'x';
  const crossAxisIndex = crossAxis === 'x' ? 0 : 1;
  const crossAxisDimensionIndex = crossAxis === 'x' ? 0 : 1;

  for (const picture of state.pictures) {
    const force = forces.get(picture);
    if (!force) {
      continue;
    }

    const targetPos =
      picture.pos[crossAxisIndex] < 0
        ? -picture.size[crossAxisDimensionIndex] / 2 - margin
        : picture.size[crossAxisDimensionIndex] / 2;

    const forwardSign = picture.pos[crossAxisIndex] < 0 ? 1 : -1;
    const diff = targetPos - picture.pos[crossAxisIndex];

    // Only project if we're moving away from the target rail
    if (forwardSign * diff < 0) {
      force[crossAxisIndex] = diff;
      setForce(forces, picture, force);
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

function center(state: State, axis?: 'x' | 'y') {
  const c = centroid(state);
  for (const picture of state.pictures) {
    if (axis !== 'y') picture.pos[0] -= c[0];
    if (axis !== 'x') picture.pos[1] -= c[1];
  }
}

function attractToGrid(state: State, forces: Forces, gridSize: number, strength: number) {
  for (const picture of state.pictures) {
    const x0 = picture.pos[0] - picture.size[0] / 2;
    const y0 = picture.pos[1] - picture.size[1] / 2;
    const rx = Math.round(x0 / gridSize) * gridSize;
    const ry = Math.round(y0 / gridSize) * gridSize;
    const targetX = rx + picture.size[0] / 2;
    const targetY = ry + picture.size[1] / 2;
    addForce(forces, picture, [(targetX - picture.pos[0]) * strength, (targetY - picture.pos[1]) * strength]);
  }
}

async function resolveOverlaps(state: State, view: View) {
  // Second pass: strict separation and grid alignment
  // We run this to ensure pictures "settle" into valid non-overlapping grid slots
  for (let i = 0; i < 100; ++i) {
    const movement = trackMovement(state);
    const forces = new Map<Picture, [number, number]>();

    // Much weaker grid attraction (0.05) to allow separation forces to push items
    // to new cells without being snapped back immediately.
    if (state.gridSize > 0) {
      attractToGrid(state, forces, state.gridSize, 0.05);
    }

    applyForces(forces);

    // More passes of strong separation to ensure objects can push past each other
    for (let j = 0; j < 15; ++j) {
      const sepForces = new Map<Picture, [number, number]>();
      separate({ state, forces: sepForces, separation: state.gridSize, strength: 1.0, method: 'axis' });
      applyForces(sepForces);
    }

    // Early exit if settled
    if (movement() < 0.1) {
      console.log('overlaps done in', i, 'iterations');
      break;
    }

    view.dirty = true;
    await new Promise((r) => requestAnimationFrame(r));
  }
}

export async function layoutCluster(state: State, view: View) {
  let alpha = 1.0;
  for (let i = 0; i < MAX_ITER; ++i) {
    center(state);

    const movement = trackMovement(state);
    const forces = new Map<Picture, [number, number]>();

    // Decay alpha
    alpha *= 0.97;

    // Stronger initial attraction that decays, with a minimum floor to keep cluster tight
    const attractAmount = Math.max(0.2, 5.0 * alpha);
    attract({ state, forces, point: [0, 0], amount: attractAmount });

    applyForces(forces);

    // Run separation substeps with reduced stiffness for stability
    for (let j = 0; j < 8; ++j) {
      const forces = new Map<Picture, [number, number]>();
      separate({ state, forces, separation: state.gridSize, strength: 0.5 });
      applyForces(forces);
    }

    if (movement() < 1.0 && alpha < 0.15) {
      console.log('cluster done in', i, 'iterations');
      break;
    }

    view.dirty = true;
    await new Promise((r) => requestAnimationFrame(r));
  }

  await resolveOverlaps(state, view);

  center(state);
  snapToGrid(state, state.gridSize);
}

async function compactRail(state: State, view: View, mainAxis: 'x' | 'y') {
  // Intermediate step: compact along the main axis while strictly maintaining rail alignment (cross axis)
  for (let i = 0; i < 100; ++i) {
    const movement = trackMovement(state);
    const forces = new Map<Picture, [number, number]>();

    const mainAxisIndex = mainAxis === 'x' ? 0 : 1;

    // 1. Gravity along the rail (main axis): Gently pull towards center
    for (const picture of state.pictures) {
      const force: [number, number] = [0, 0];
      force[mainAxisIndex] = -picture.pos[mainAxisIndex] * 0.05;
      addForce(forces, picture, force);
    }

    // 2. Locking: Strong attraction to keep them on the rail
    attractRail({ state, forces, margin: state.gridSize, amount: 1.0, mainAxis });

    applyForces(forces);

    // 3. Axis-aligned separation to stack them
    for (let j = 0; j < 4; ++j) {
      const sepForces = new Map<Picture, [number, number]>();
      separate({ state, forces: sepForces, separation: state.gridSize, strength: 1.0, method: 'axis' });

      // Enforce rail constraint strictly after separation might have pushed them off
      projectRail({ state, forces: sepForces, margin: state.gridSize, mainAxis });

      applyForces(sepForces);
    }

    if (movement() < 0.1) {
      break;
    }

    view.dirty = true;
    await new Promise((r) => requestAnimationFrame(r));
  }
}

export async function layoutRail(state: State, view: View, mainAxis: 'x' | 'y') {
  let alpha = 1.0;

  for (let i = 0; i < MAX_ITER; ++i) {
    center(state, mainAxis);

    const movement = trackMovement(state);
    const forces = new Map<Picture, [number, number]>();

    alpha *= 0.97;

    const attractAmount = Math.max(0.2, 5.0 * alpha);
    attractRail({ state, forces, margin: state.gridSize, amount: attractAmount, mainAxis });

    applyForces(forces);

    for (let j = 0; j < 8; ++j) {
      const forces = new Map<Picture, [number, number]>();
      separate({ state, forces, separation: state.gridSize, strength: 0.3 });
      projectRail({ state, forces, margin: state.gridSize, mainAxis });
      applyForces(forces);
    }

    if (movement() < 1.0 && alpha < 0.15) {
      console.log('rail done in', i, 'iterations');
      break;
    }

    view.dirty = true;
    await new Promise((r) => requestAnimationFrame(r));
  }

  await compactRail(state, view, mainAxis);
  await resolveOverlaps(state, view);

  center(state);
  snapToGrid(state, state.gridSize);
}

export async function layoutHorizontalRail(state: State, view: View) {
  return layoutRail(state, view, 'x');
}

export async function layoutVerticalRail(state: State, view: View) {
  return layoutRail(state, view, 'y');
}
