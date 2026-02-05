import { EventEmitter } from "events";
import { Changeset } from "./store";

class Streamer extends EventEmitter {
  enqueue(changesets: Changeset[], options?: { speedFactor?: number }) {
    if (changesets.length === 0) return;

    const shuffled = [...changesets].sort(() => Math.random() - 0.5);

    const speedFactor = Math.max(0.1, options?.speedFactor ?? 1);
    const duration = 55 * 1000 * speedFactor; // 55 seconds target
    const interval = duration / shuffled.length;

    shuffled.forEach((cs, index) => {
      const delay = index * interval + Math.random() * (interval * 0.5); // interval + jitter
      setTimeout(() => {
        this.emit("changeset", cs);
      }, delay);
    });
  }
}

export const streamer = new Streamer();
