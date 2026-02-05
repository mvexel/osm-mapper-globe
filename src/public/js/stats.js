export function startStatsPolling({ intervalMs = 10000 } = {}) {
  const mappersEl = document.getElementById("stats-mappers");
  const watchersEl = document.getElementById("stats-watchers");

  function pollStats() {
    fetch("/stats")
      .then((r) => r.json())
      .then((d) => {
        if (mappersEl) mappersEl.textContent = d.mappers + " mapping";
        if (watchersEl) watchersEl.textContent = d.watchers + " watching";
      })
      .catch(() => {});

    setTimeout(pollStats, intervalMs);
  }

  pollStats();
}
