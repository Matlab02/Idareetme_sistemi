/* Adds sourcing progress to each request line without bypassing human review. */
(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[x]));
  const refreshRow = (row) => {
    const requested = Number(row.querySelector(".requested-qty")?.textContent || 0), found = Number(row.querySelector(".found-qty")?.value || 0), remaining = row.querySelector(".remaining-qty");
    if (remaining) { remaining.textContent = Math.max(0, requested - found); remaining.className = `remaining-qty ${found >= requested ? "found-ok" : "danger"}`; }
  };
  function enrich(id) {
    const request = db.requests.find((item) => item.id === id), table = document.querySelector(".price-table"); if (!request || !table) return;
    const head = table.querySelector("thead tr");
    if (head && !head.querySelector(".found-head")) { const source = document.createElement("th"); source.textContent = "Tapılan"; source.className = "found-head"; const left = document.createElement("th"); left.textContent = "Qalan"; left.className = "remaining-head"; head.children[0].after(source, left); }
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.dataset.index === "-1" || row.querySelector(".found-qty")) return;
      const item = request.items[Number(row.dataset.index)], productCell = row.children[0], sourceCell = document.createElement("td"), leftCell = document.createElement("td");
      const found = Number(item?.sourced || 0), requested = Number(item?.qty || 0);
      sourceCell.innerHTML = `<input class="found-qty" type="number" min="0" max="${requested}" step="0.01" value="${found}" title="Təchizatçılardan tapılan miqdar">`;
      leftCell.innerHTML = `<b class="remaining-qty ${found >= requested ? "found-ok" : "danger"}">${Math.max(0, requested - found)}</b>`;
      productCell.innerHTML += `<span class="muted requested-qty" style="display:none">${requested}</span>`;
      productCell.after(sourceCell, leftCell); sourceCell.querySelector(".found-qty").oninput = () => refreshRow(row);
    });
    const saveButton = document.querySelector("#savePrices");
    if (saveButton && !saveButton.dataset.availabilityBound) {
      saveButton.dataset.availabilityBound = "1";
      const previous = saveButton.onclick;
      saveButton.onclick = () => {
        table.querySelectorAll("tbody tr").forEach((row) => { const index = Number(row.dataset.index); if (index >= 0 && request.items[index]) request.items[index].sourced = Math.min(request.items[index].qty, Number(row.querySelector(".found-qty")?.value || 0)); });
        if ([...table.querySelectorAll(".found-qty")].some((input) => Number(input.value) > Number(input.max))) return toast("Tapılan miqdar tələb olunan miqdardan çox ola bilməz.");
        previous?.();
      };
    }
  }
  window.addEventListener("load", () => {
    const style = document.createElement("style"); style.textContent = ".found-qty{width:78px;border:1px solid #d9e2ee;border-radius:8px;padding:7px}.found-ok{color:#16845d}.remaining-qty{font-size:13px}.margin-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 15px;margin:15px 0;border:1px solid #dce9ff;border-radius:11px;background:#f7faff}.margin-toolbar .field{display:flex;align-items:center;gap:8px;margin:0}.margin-toolbar .field label{white-space:nowrap}.margin-toolbar input{width:82px}.detail-prices{width:100%;min-width:0;table-layout:fixed}.detail-prices input,.detail-prices select{width:100%;min-width:0;max-width:145px}.detail-prices th,.detail-prices td{overflow-wrap:anywhere}@media(max-width:900px){.detail-prices,.detail-prices tbody,.detail-prices tr,.detail-prices td{display:block;width:100%}.detail-prices thead{display:none}.detail-prices tr{border:1px solid #e2e8f0;border-radius:12px;padding:11px;margin:10px 0;background:#fff}.detail-prices td{display:grid;grid-template-columns:42% 58%;align-items:center;padding:7px 4px;border:0}.detail-prices td:first-child{display:block;padding-bottom:12px;border-bottom:1px solid #edf0f5}.detail-prices td:not(:first-child):before{font-size:11px;color:#8491a6;font-weight:650}.detail-prices td:nth-child(2):before{content:'Tələb'}.detail-prices td:nth-child(3):before{content:'Təchizatçı'}.detail-prices td:nth-child(4):before{content:'Tapılan'}.detail-prices td:nth-child(5):before{content:'Qalan'}.detail-prices td:nth-child(6):before{content:'Alış qiyməti'}.detail-prices td:nth-child(7):before{content:'Faiz'}.detail-prices td:nth-child(8):before{content:'Satış qiyməti'}.detail-prices td:nth-child(9):before{content:'Əməliyyat'}.margin-toolbar{display:block}.margin-toolbar .field{margin-top:12px;justify-content:flex-start}}"; document.head.appendChild(style);
    const original = window.openDetail;
    window.openDetail = (id) => { original(id); setTimeout(() => enrich(id), 0); };
    window.detail = window.openDetail;
  });
})();
