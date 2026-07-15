// powers the "Copy these instructions" button on the OKF guide page. External
// (not inline) so it satisfies the app's CSP (script-src 'self'). Copies the
// canonical raw guide so what's pasted into an AI assistant stays in sync.
(() => {
  const btn = document.getElementById("copy-btn");
  const label = document.getElementById("copy-label");
  if (!btn || !label) return;
  btn.addEventListener("click", () => {
    fetch("/okf-format.md")
      .then((r) => r.text())
      .then((md) => navigator.clipboard.writeText(md))
      .then(() => {
        const prev = label.textContent;
        label.textContent = "Copied — paste into Claude";
        setTimeout(() => {
          label.textContent = prev;
        }, 2500);
      })
      .catch(() => {
        window.open("/okf-format.md", "_blank");
      });
  });
})();
