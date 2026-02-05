export interface Changeset {
  id: number;
  user: string;
  location: string;
  summary: string;
  hearts: number;
  processedAt: number;
  lat: number;
  lon: number;
}

// In-memory store (recent cache)
// we may not need this at all really
export const changesetStore = new Map<number, Changeset>();
const recentIds: number[] = [];
const RECENT_CACHE_LIMIT = 200;

const touchRecentId = (id: number) => {
  const existingIndex = recentIds.indexOf(id);
  if (existingIndex >= 0) recentIds.splice(existingIndex, 1);
  recentIds.unshift(id);
  if (recentIds.length > RECENT_CACHE_LIMIT) {
    const removed = recentIds.pop();
    if (removed !== undefined) changesetStore.delete(removed);
  }
};

export const getChangeset = (id: number) => changesetStore.get(id);

export const getRecentChangesets = (limit = 50): Changeset[] => {
  return recentIds
    .slice(0, limit)
    .map((id) => changesetStore.get(id))
    .filter(Boolean) as Changeset[];
};

export const addChangeset = (c: Changeset) => {
  const existing = changesetStore.get(c.id);
  const hearts = existing?.hearts ?? c.hearts ?? 0;
  const entry = { ...c, hearts };
  changesetStore.set(c.id, entry);
  touchRecentId(c.id);
};

export const getActiveMappers = (): number => {
  const cutoff = Date.now() - 20 * 60 * 1000;
  const users = new Set<string>();
  for (const id of recentIds) {
    const cs = changesetStore.get(id);
    if (cs && cs.processedAt > cutoff) {
      users.add(cs.user);
    }
  }
  return users.size;
};

export const incrementHeart = (id: number) => {
  const existing = changesetStore.get(id);
  if (!existing) return 1;
  existing.hearts += 1;
  return existing.hearts;
};
