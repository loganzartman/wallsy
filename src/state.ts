import { zip } from 'fflate';
import type { Picture } from './picture';

export type State = {
  gridSize: number;
  pictures: Picture[];
};

export function emptyState(state?: State): State {
  if (!state) {
    return {
      gridSize: 1,
      pictures: [],
    };
  }
  state.gridSize = 1;
  state.pictures = [];
  return state;
}

export function moveToTop(state: State, picture: Picture) {
  const index = state.pictures.indexOf(picture);
  if (index > -1) {
    state.pictures.splice(index, 1);
    state.pictures.push(picture);
  }
}

export function generateManifest(state: State): string {
  const countByDimensions = new Map<string, number>();
  for (const picture of state.pictures) {
    const dimensions = `${Math.min(...picture.size)}x${Math.max(...picture.size)}`;
    countByDimensions.set(dimensions, (countByDimensions.get(dimensions) ?? 0) + 1);
  }
  const lines = Array.from(countByDimensions.entries()).map(
    ([dimensions, count], i) =>
      `${dimensions},${count},,=B${i + 2}*C${i + 2},${i > 0 ? '' : `=SUM(D2:D${countByDimensions.size + 1})`}`,
  );
  return ['size,count,price,cost,total', ...lines].join('\n');
}

export async function generatePicturesZip(state: State): Promise<Blob> {
  const picturesByDimensions: Record<string, Record<string, Uint8Array>> = {};
  for (const picture of state.pictures) {
    const dimensions = `${Math.min(...picture.size)}x${Math.max(...picture.size)}`;
    picturesByDimensions[dimensions] ??= {};
    picturesByDimensions[dimensions][picture.name] = new Uint8Array(await picture.blob.arrayBuffer());
  }
  const result = Promise.withResolvers<Blob>();
  zip(
    picturesByDimensions,
    {
      // most images already compressed
      level: 0,
    },
    (err, data) => {
      if (err) {
        result.reject(err);
      } else {
        result.resolve(new Blob([data.buffer as ArrayBuffer]));
      }
    },
  );
  return result.promise;
}
