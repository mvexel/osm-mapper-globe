const thanked = new Set();

export function installThankHandler() {
  function thank(id) {
    if (thanked.has(id)) return;
    thanked.add(id);
    const el = document.getElementById(`hearts-${id}`);
    if (el) {
      // Optimistic: swap to solid heart immediately
      el.innerHTML = el.innerHTML
        .replace("&#x2661;", "&#x2764;")
        .replace("♡", "❤");
    }
    fetch(`/thank/${id}`, { method: "POST" })
      .then((res) => res.text())
      .then((html) => {
        if (el) el.innerHTML = html;
      })
      .catch((err) => console.error(err));
  }

  window.thank = thank; // Expose to global for onclick
}

export function initStream({
  streamId = "stream",
  streamPaneId = "stream-pane",
  onChangeset,
} = {}) {
  const streamPane = document.getElementById(streamPaneId);
  const stream = document.getElementById(streamId);

  if (!streamPane || !stream) {
    console.error("Stream pane or stream container not found.");
    return { stream: null, observer: null };
  }

  // --- Stream pane toggle (click left 1/3 to toggle) ---
  let streamVisible = true;
  document.addEventListener("click", (e) => {
    if (e.clientX >= window.innerWidth / 3) return;
    if (e.target.closest(".hearts")) return;
    if (streamVisible) {
      streamPane.classList.add("stream-hidden");
      streamVisible = false;
    } else {
      streamPane.classList.remove("stream-hidden");
      streamVisible = true;
    }
  });

  function handleChangesetNode(node) {
    if (!node) return;
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      node.childNodes.forEach((child) => handleChangesetNode(child));
      return;
    }
    if (!node.classList || !node.classList.contains("changeset")) return;
    if (node.dataset && node.dataset.dotReady === "1") return;
    const lat = parseFloat(node.getAttribute("data-lat"));
    const lon = parseFloat(node.getAttribute("data-lon"));
    const id = node.id.replace("cs-", "");
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;

    if (node.dataset) node.dataset.dotReady = "1";
    const tag = node.getAttribute("data-hashtag");
    const user = node.getAttribute("data-user");

    onChangeset?.({ id, lat, lon, tag, user });
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((n) => handleChangesetNode(n));
    });
    if (stream.children.length > 50) {
      stream.lastElementChild.remove();
    }
  });

  observer.observe(stream, { childList: true });

  return { stream, observer };
}
