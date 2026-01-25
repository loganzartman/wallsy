import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { State, StoredState } from './state';

interface Schema extends DBSchema {
  state: {
    key: string;
    value: StoredState;
  };
}

let db: IDBPDatabase<Schema>;
async function getDB(): Promise<IDBPDatabase<Schema>> {
  if (!db) {
    db = await openDB('db', 2, {
      upgrade(db, oldVersion, newVersion, tx) {
        console.log('db upgrade', oldVersion, newVersion);
        if (!oldVersion) {
          db.createObjectStore('state');
        }
        // pre-release versions
        if (oldVersion <= 1) {
          console.log('upgrading from pre-release version');
          tx.objectStore('state').clear();
        }
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
      library: new Map(
        [...state.library.entries()].map(([k, v]) => {
          const { bitmap: _omitted, ...rest } = v;
          return [k, rest];
        }),
      ),
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
    library: new Map(
      await Promise.all(
        [...stored.library.entries()].map(async ([k, v]) => {
          return [k, { ...v, bitmap: await createImageBitmap(v.blob) }] as const;
        }),
      ),
    ),
  };
}
