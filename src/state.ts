import type { Picture } from './picture';

export type State = {
  pictures: Picture[];
};

export function emptyState(state?: State): State {
  if (!state) {
    return {
      pictures: [],
    };
  }
  state.pictures = [];
  return state;
}
