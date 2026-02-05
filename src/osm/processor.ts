import { fetchChangesetDetails } from "./api";
import { reverseGeocode } from "./geocoder";
import { addChangeset, Changeset } from "../services/store";

export async function processOsc(oscData: any) {
  // parser for the changeset metadata
  const changesetStats = new Map<
    number,
    { created: number; modified: number; deleted: number }
  >();

  const uniqueChangesets = new Set<number>();

  // closure to capture the changeset details
  const processBlock = (
    block: any,
    actionType: "created" | "modified" | "deleted",
  ) => {
    if (!block) return;
    ["node", "way", "relation"].forEach((type) => {
      if (block[type]) {
        block[type].forEach((item: any) => {
          const cid = parseInt(item.$.changeset);
          uniqueChangesets.add(cid);

          if (!changesetStats.has(cid)) {
            changesetStats.set(cid, { created: 0, modified: 0, deleted: 0 });
          }
          changesetStats.get(cid)![actionType]++;
        });
      }
    });
  };

  if (oscData.osmChange) {
    if (oscData.osmChange.create)
      processBlock(oscData.osmChange.create[0], "created");
    if (oscData.osmChange.modify)
      processBlock(oscData.osmChange.modify[0], "modified");
    if (oscData.osmChange.delete)
      processBlock(oscData.osmChange.delete[0], "deleted"); // 'delete' in XML might be <delete>
  }

  // then process each one
  const results: Changeset[] = [];
  for (const id of uniqueChangesets) {
    const details = await fetchChangesetDetails(id);
    if (!details) continue;

    // centroid
    let lat = 0,
      lon = 0;
    if (details.minLat && details.maxLat && details.minLon && details.maxLon) {
      lat = (details.minLat + details.maxLat) / 2;
      lon = (details.minLon + details.maxLon) / 2;
    }

    // Skip if no bbox (global changes?) or invalid
    // we could do something here to filter out huge changesets but :shrug:
    if (lat === 0 && lon === 0) continue;

    const location = await reverseGeocode(lat, lon);

    const summaryText = details.tags["comment"] || "";

    const changeset: Changeset = {
      id: id,
      user: details.user,
      location: location,
      summary: summaryText,
      hearts: 0,
      processedAt: details.closedAt,
      lat: lat,
      lon: lon,
    };

    addChangeset(changeset);
    results.push(changeset);
    console.log(`Processed changeset ${id}: ${location} - ${summaryText}`);
  }

  return results;
}
