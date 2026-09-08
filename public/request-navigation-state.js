/* A request URL is only valid while its detail workspace is actually open. */
(() => {
  const clearRequestRoute = () => {
    if (!location.hash.startsWith("#request=")) return;
    history.replaceState({}, "", location.pathname + location.search);
  };

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest(".nav button[data-page], #backRequests")) clearRequestRoute();
  }, true);
})();
