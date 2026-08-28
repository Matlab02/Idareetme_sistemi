/* Gives request details a dedicated browser location and native back behavior. */
(() => {
  const hashId = () => { const match = location.hash.match(/^#request=(.+)$/); return match ? decodeURIComponent(match[1]) : ""; };
  function enhance() {
    const back = document.querySelector("#backRequests"); if (!back || back.dataset.routeBound) return;
    back.dataset.routeBound = "1";
    back.onclick = () => { history.pushState({}, "", location.pathname + location.search); page = "requests"; render(); };
  }
  window.addEventListener("load", () => {
    const base = window.detail;
    const open = (id, fromHistory = false) => { if (!fromHistory) history.pushState({}, "", `${location.pathname}${location.search}#request=${encodeURIComponent(id)}`); base(id); setTimeout(enhance, 0); };
    window.detail = (id) => open(id);
    window.addEventListener("popstate", () => { const id = hashId(); if (id) open(id, true); else { page = "requests"; render(); } });
    const current = hashId();
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    const isRefresh = navigation?.type === "reload" || (!navigation && performance.navigation?.type === 1);
    if (current && isRefresh) { history.replaceState({}, "", location.pathname + location.search); page = "requests"; render(); }
    else if (current) open(current, true);
  });
})();
