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

function addDot({ id, lat, lon, tag, user }) {
  globe.addPoint(id, lat, lon);
  if (tag) {
    globe.addTagSprite(tag, lat, lon, "#2aff5c");
  } else if (user) {
    globe.addTagSprite(user, lat, lon, "#1a6b3a");
  }
}

const globe = initGlobe({
  onReady: () => {
    globeReady = true;
    // Catch up: add dots for any changesets already in the DOM
    document.querySelectorAll(".changeset").forEach((node) => {
      const lat = parseFloat(node.getAttribute("data-lat"));
      const lon = parseFloat(node.getAttribute("data-lon"));
      const id = node.id.replace("cs-", "");
      if (isNaN(lat) || isNaN(lon)) return;
      addDot({
        id,
        lat,
        lon,
        tag: node.getAttribute("data-hashtag"),
        user: node.getAttribute("data-user"),
      });
    });
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
    addDot({ id, lat, lon, tag, user });

    if (!firstChangesetReady) {
      firstChangesetReady = true;
      if (globe.isReady()) {
        globe.focusOn(lat, lon);
        maybeHideBoot();
      } else {
        pendingFirstCoord = { lat, lon };
      }
    }
  },
});

startRelativeTimeUpdater();
startStatsPolling();

const rotateBtn = document.getElementById("rotate-toggle");
rotateBtn.addEventListener("click", () => {
  const controls = globe.getControls();
  if (!controls) return;
  controls.autoRotate = !controls.autoRotate;
  rotateBtn.textContent = controls.autoRotate ? "[~]" : "[||]";
});

const audioBtn = document.getElementById("audio-toggle");
const ambientAudio = document.getElementById("ambient-audio");
let audioPlaying = false;

audioBtn.addEventListener("click", () => {
  if (audioPlaying) {
    ambientAudio.pause();
    audioBtn.textContent = "[♪]";
  } else {
    ambientAudio.play();
    audioBtn.textContent = "[♫]";
  }
  audioPlaying = !audioPlaying;
});
