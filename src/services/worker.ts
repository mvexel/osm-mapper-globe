import { fetchCurrentState, fetchAndParseDiff } from "../osm/replication";
import { processOsc } from "../osm/processor";
import { streamer } from "./streamer";

export class Worker {
  private isRunning = false;
  private lastSequenceNumber = 0;
  private knownSequenceNumber = 0;

  // start the  worker
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log("Worker started.");

    try {
      const state = await fetchCurrentState();
      console.log(
        `Current OSM State: ${state.sequenceNumber} (${state.timestamp})`,
      );

      this.knownSequenceNumber = state.sequenceNumber;
      // Start from 20 minutes ago to ensure files exist on mirrors
      this.lastSequenceNumber = state.sequenceNumber - 20;

      this.loop();
    } catch (error) {
      console.error("Failed to start worker:", error);
      this.isRunning = false;
    }
  }

  // the main changeset meta / data fetcher loop
  async loop() {
    if (!this.isRunning) return;

    try {
      const nextSeq = this.lastSequenceNumber + 1;

      // If we've caught up to the last known state, refresh state
      // before attempting a fetch — avoids 404s entirely.
      if (nextSeq > this.knownSequenceNumber) {
        const state = await fetchCurrentState();
        this.knownSequenceNumber = state.sequenceNumber;

        if (nextSeq > this.knownSequenceNumber) {
          // Still caught up. Wait for next minute, no diff request.
          setTimeout(() => this.loop(), 10 * 1000);
          return;
        }
      }

      const diff = await fetchAndParseDiff(nextSeq);

      if (diff) {
        console.log(`Downloaded diff ${nextSeq}`);
        const changesets = await processOsc(diff);
        console.log(`Extracted ${changesets.length} changesets`);

        streamer.enqueue(changesets);
        this.lastSequenceNumber = nextSeq;
      }
    } catch (error) {
      console.error("Error in worker loop:", error);
    }

    // Stay ~2 minutes behind live. Fetch fast while catching up, throttle to
    // once per minute once close so we never fully catch up.
    const behindBy = this.knownSequenceNumber - this.lastSequenceNumber;
    setTimeout(() => this.loop(), behindBy <= 2 ? 60 * 1000 : 5 * 1000);
  }

  stop() {
    this.isRunning = false;
  }
}

export const worker = new Worker();
