import { db } from "./db";

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

const selectHearts = db.prepare("SELECT hearts FROM changesets WHERE id = ?");

const insertChangeset = db.prepare(`
    INSERT INTO changesets (id, user, location, summary, hearts, processedAt, lat, lon)
    VALUES (@id, @user, @location, @summary, @hearts, @processedAt, @lat, @lon)
    ON CONFLICT(id) DO UPDATE SET
        user=excluded.user,
        location=excluded.location,
        summary=excluded.summary,
        processedAt=excluded.processedAt,
        lat=excluded.lat,
        lon=excluded.lon
`);

const incrementHearts = db.prepare(`
    UPDATE changesets
    SET hearts = hearts + 1
    WHERE id = ?
`);

const selectById = db.prepare("SELECT * FROM changesets WHERE id = ?");

const insertHeartsOnly = db.prepare(`
    INSERT INTO changesets (id, hearts)
    VALUES (?, 1)
`);

export const addChangeset = (c: Changeset) => {
  const existing = selectHearts.get(c.id) as { hearts: number } | undefined;
  const hearts = existing?.hearts ?? c.hearts ?? 0;
  const entry = { ...c, hearts };
  insertChangeset.run(entry);
  changesetStore.set(c.id, entry);
  touchRecentId(c.id);
};

const selectActiveMappers = db.prepare(
  "SELECT COUNT(DISTINCT user) as count FROM changesets WHERE processedAt > ?",
);

export const getActiveMappers = (): number => {
  const row = selectActiveMappers.get(Date.now() - 20 * 60 * 1000) as {
    count: number;
  };
  return row.count;
};

export const incrementHeart = (id: number) => {
  const existing = selectById.get(id) as Changeset | undefined;
  if (!existing) {
    insertHeartsOnly.run(id);
    const hearts = 1;
    const cached = changesetStore.get(id);
    if (cached) cached.hearts = hearts;
    return hearts;
  }
  incrementHearts.run(id);
  const hearts = existing.hearts + 1;
  const cached = changesetStore.get(id);
  if (cached) cached.hearts = hearts;
  return hearts;
};
