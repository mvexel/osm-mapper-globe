export function startRelativeTimeUpdater({ intervalMs = 30000 } = {}) {
  setInterval(() => {
    document.querySelectorAll(".time-ago").forEach((el) => {
      const mins = Math.round((Date.now() - parseInt(el.dataset.time)) / 60000);
      el.textContent = mins < 1 ? "just now" : mins + " min ago";
    });
  }, intervalMs);
}
