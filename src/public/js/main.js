import { initGlobe } from "./globe.js";
import { initStream, installThankHandler } from "./stream.js";
import { startRelativeTimeUpdater } from "./time.js";
import { startStatsPolling } from "./stats.js";

let globeReady = false;
let firstChangesetReady = false;
let pendingFirstCoord = null;

function maybeHideBoot() {
  if (!globeReady || !firstChangesetReady) return;
  const boot = document.getElementById("boot");
  if (!boot || boot.classList.contains("boot-hidden")) return;
  boot.classList.add("boot-hidden");
  window.setTimeout(() => boot.remove(), 900);
}

const globe = initGlobe({
  onReady: () => {
    globeReady = true;
    if (pendingFirstCoord) {
      globe.focusOn(pendingFirstCoord.lat, pendingFirstCoord.lon);
      pendingFirstCoord = null;
    }
    maybeHideBoot();
  },
});

installThankHandler();

initStream({
  onChangeset: ({ id, lat, lon, tag, user }) => {
    globe.addPoint(id, lat, lon);

    if (!firstChangesetReady) {
      firstChangesetReady = true;
      if (globe.isReady()) {
        globe.focusOn(lat, lon);
        maybeHideBoot();
      } else {
        pendingFirstCoord = { lat, lon };
      }
    }

    if (tag) {
      globe.addTagSprite(tag, lat, lon, "#2aff5c");
    } else if (user) {
      globe.addTagSprite(user, lat, lon, "#1a6b3a");
    }
  },
});

startRelativeTimeUpdater();
startStatsPolling();
