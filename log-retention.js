/* Keeps operational and superadmin audit logs for seven days only. */
(() => {
  const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
  const parseTime = (value) => {
    if (!value) return 0;
    const iso = Date.parse(value); if (Number.isFinite(iso)) return iso;
    const match = String(value).match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})[,.\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] || 0)).getTime() : 0;
  };
  const prune = () => {
    const cutoff = Date.now() - RETENTION_MS;
    let data = window.db;
    if (data && Array.isArray(data.audit)) {
      let changed = false;
      data.audit.forEach((item) => { if (!item.createdAt) { item.createdAt = new Date(parseTime(item.time) || Date.now()).toISOString(); changed = true; } });
      const kept = data.audit.filter((item) => parseTime(item.createdAt) >= cutoff);
      if (kept.length !== data.audit.length) { data.audit = kept; changed = true; }
      if (changed && typeof window.save === "function") window.save();
    }
    try {
      const raw = localStorage.getItem("erp-superadmin-v1"), state = JSON.parse(raw || "null");
      if (!state || !Array.isArray(state.activity)) return;
      let changed = false;
      state.activity.forEach((item) => { if (!item.createdAt) { item.createdAt = new Date(parseTime(item.time) || Date.now()).toISOString(); changed = true; } });
      const kept = state.activity.filter((item) => parseTime(item.createdAt) >= cutoff);
      if (kept.length !== state.activity.length) { state.activity = kept; changed = true; }
      if (changed) localStorage.setItem("erp-superadmin-v1", JSON.stringify(state));
    } catch {}
  };
  window.addEventListener("erp-state-loaded", prune);
  window.addEventListener("load", () => { setTimeout(prune, 12000); setInterval(prune, 60 * 60 * 1000); });
})();
