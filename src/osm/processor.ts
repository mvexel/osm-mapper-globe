import { reverseGeocode } from "./geocoder";
import { addChangeset, Changeset } from "../services/store";

export async function processOsc(oscData: any) {
  const changesets = oscData?.osm?.changeset;
  if (!changesets) return [];

  const results: Changeset[] = [];
  for (const cs of changesets) {
    const attrs = cs.$;
    const id = parseInt(attrs.id);
    const user = attrs.user;

    const minLat = parseFloat(attrs.min_lat);
    const maxLat = parseFloat(attrs.max_lat);
    const minLon = parseFloat(attrs.min_lon);
    const maxLon = parseFloat(attrs.max_lon);

    // Skip if no bbox
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon))
      continue;

    const lat = (minLat + maxLat) / 2;
    const lon = (minLon + maxLon) / 2;
    if (lat === 0 && lon === 0) continue;

    // Extract comment from tags
    let comment = "";
    if (cs.tag) {
      const commentTag = cs.tag.find((t: any) => t.$.k === "comment");
      if (commentTag) comment = commentTag.$.v;
    }

    const location = await reverseGeocode(lat, lon);

    const changeset: Changeset = {
      id,
      user,
      location,
      summary: comment,
      hearts: 0,
      processedAt: Date.now(),
      lat,
      lon,
    };

    addChangeset(changeset);
    results.push(changeset);
    console.log(`Processed changeset ${id}: ${location} - ${comment}`);
  }

  return results;
}
