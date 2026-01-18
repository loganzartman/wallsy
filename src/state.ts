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
