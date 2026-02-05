import axios from "axios";

const OSM_API_BASE = "https://api.openstreetmap.org/api/0.6";

// changeset model
export interface ChangesetDetails {
  id: number;
  user: string;
  uid: number;
  closedAt: number;
  tags: Record<string, string>;
  minLon?: number;
  minLat?: number;
  maxLon?: number;
  maxLat?: number;
}

// async fetcher
export async function fetchChangesetDetails(
  id: number,
): Promise<ChangesetDetails | null> {
  try {
    const url = `${OSM_API_BASE}/changeset/${id}.json`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.changeset) {
      const cs = data.changeset;

      return {
        id: cs.id,
        user: cs.user,
        uid: cs.uid,
        closedAt: new Date(cs.closed_at).getTime(),
        tags: cs.tags || {},
        minLon: cs.min_lon,
        minLat: cs.min_lat,
        maxLon: cs.max_lon,
        maxLat: cs.max_lat,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching changeset ${id}:`, error);
    return null;
  }
}
