import { EventEmitter } from "events";
import { Changeset } from "./store";

const SPREAD_MS = 60 * 1000; // spread each batch over one minute

class Streamer extends EventEmitter {
  enqueue(changesets: Changeset[]) {
    if (changesets.length === 0) return;

    changesets.forEach((cs) => {
      const delay = Math.random() * SPREAD_MS;
      setTimeout(() => {
        this.emit("changeset", { ...cs, processedAt: Date.now() });
      }, delay);
    });
  }
}

export const streamer = new Streamer();
