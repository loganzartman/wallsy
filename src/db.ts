import { type IDBPDatabase, openDB } from 'idb';
import type { State } from './state';

let db: IDBPDatabase;
async function getDB(): Promise<IDBPDatabase> {
  if (!db) {
    db = await openDB('db', 1, {
      upgrade(db) {
        db.createObjectStore('state');
      },
    });
  }
  return db;
}

export async function storeState(state: State): Promise<void> {
  const db = await getDB();
  const tx = await db.transaction('state', 'readwrite');
  await tx.store.clear();
  await tx.store.put(
    {
      ...state,
      pictures: state.pictures.map((picture) => {
        const { bitmap: _omitted, ...rest } = picture;
        return rest;
      }),
    },
    'app-state',
  );
  await tx.done;
}

export async function loadState(): Promise<State | null> {
  const db = await getDB();
  const stored = await db.get('state', 'app-state');

  if (!stored) {
    return null;
  }

  return {
    ...stored,
    pictures: await Promise.all(
      stored.pictures.map(async (picture) => {
        return {
          ...picture,
          bitmap: await createImageBitmap(picture.blob),
        };
      }),
    ),
  };
}

export async function clearState(): Promise<void> {
  const db = await getDB();
  const tx = await db.transaction('state', 'readwrite');
  await tx.store.clear();
  await tx.done;
}
