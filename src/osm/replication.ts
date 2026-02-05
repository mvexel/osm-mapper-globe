import axios from "axios";
import zlib from "zlib";
import { parseStringPromise } from "xml2js";
import { promisify } from "util";

const unzip = promisify(zlib.unzip);

const REPLICATION_BASE_URL =
  "https://planet.openstreetmap.org/replication/changesets";

export interface ReplicationState {
  sequenceNumber: number;
  timestamp: Date;
}

// first get the state to see where we are in the osm world.
export async function fetchCurrentState(): Promise<ReplicationState> {
  const response = await axios.get(`${REPLICATION_BASE_URL}/state.yaml`);
  let sequenceNumber = 0;
  let timestamp = new Date();

  for (const line of (response.data as string).split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("sequence:")) {
      sequenceNumber = parseInt(trimmed.split(":")[1].trim(), 10);
    } else if (trimmed.startsWith("last_run:")) {
      timestamp = new Date(trimmed.slice("last_run:".length).trim());
    }
  }

  return { sequenceNumber, timestamp };
}

// splice the state into url path stubs
export function getDiffUrl(sequenceNumber: number): string {
  const s = sequenceNumber.toString().padStart(9, "0");
  const path = `${s.slice(0, 3)}/${s.slice(3, 6)}/${s.slice(6, 9)}`;
  return `${REPLICATION_BASE_URL}/${path}.osm.gz`;
}

// then fetch em, return jsified xml
export async function fetchAndParseDiff(sequenceNumber: number) {
  const url = getDiffUrl(sequenceNumber);
  console.log(`Fetching diff: ${url}`);

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = (await unzip(response.data)) as Buffer;
    const xml = buffer.toString("utf-8");
    const result = await parseStringPromise(xml);
    return result;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`Diff ${sequenceNumber} not found (404). Waiting...`);
    } else {
      console.error(`Error fetching diff ${sequenceNumber}:`, error.message);
    }
    return null;
  }
}
