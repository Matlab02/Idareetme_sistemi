/* Usability improvements for the sourcing table. */
(() => {
  const decimalValue = (value) => { const raw = String(value ?? "").trim().replace(/\s/g, ""); if (!raw) return 0; const normalized = raw.includes(",") && raw.includes(".") ? (raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "")) : raw.replace(",", "."); const parsed = Number(normalized); return Number.isFinite(parsed) ? parsed : 0; };
  const twoDecimals = (value) => decimalValue(value).toFixed(2);
  const recalculate = (row) => {
    const cost = decimalValue(row.querySelector(".source-cost")?.value || 0), margin = decimalValue(row.querySelector(".source-margin")?.value || 0), sale = row.querySelector(".source-sale");
    if (sale && sale.tagName === "INPUT") sale.value = twoDecimals(cost * (1 + margin / 100));
  };
  const bindSaleFormatting = (sale) => { if (!sale || sale.dataset.decimalBound) return; sale.type = "text"; sale.inputMode = "decimal"; sale.value = twoDecimals(sale.value); sale.dataset.decimalBound = "1"; sale.addEventListener("input", () => { if (sale.value.includes(",")) sale.value = sale.value.replace(",", "."); }); sale.addEventListener("blur", () => { sale.value = twoDecimals(sale.value); }); };
  function adjust() {
    const table = document.querySelector(".detail-prices"), panel = table?.closest(".panel"); if (!table || !panel) return;
    const marginField = document.querySelector("#applyMargin")?.closest(".field");
    if (marginField && !document.querySelector(".margin-toolbar")) { const toolbar = document.createElement("div"); toolbar.className = "margin-toolbar"; toolbar.innerHTML = `<div><b>Toplu qiymət qaydası</b><span class="muted">Bütün məhsullara eyni faiz verin, sonra istənilən sətri ayrıca düzəldin.</span></div>`; toolbar.append(marginField); panel.insertBefore(toolbar, table.closest(".table-wrap")); }
    table.querySelectorAll("tbody tr").forEach((row) => {
      const sale = row.querySelector(".source-sale"), cost = row.querySelector(".source-cost"), margin = row.querySelector(".source-margin");
      if (sale && sale.tagName !== "INPUT") { const value = twoDecimals(decimalValue(cost?.value || 0) * (1 + decimalValue(margin?.value || 0) / 100)); sale.outerHTML = `<input class="source-sale" type="text" inputmode="decimal" min="0" step="0.01" value="${value}" title="Satış qiymətini əl ilə də dəyişə bilərsiniz">`; }
      bindSaleFormatting(row.querySelector(".source-sale"));
      if (cost && !cost.dataset.saleBound) { cost.dataset.saleBound = "1"; cost.addEventListener("input", () => recalculate(row)); }
      if (margin && !margin.dataset.saleBound) { margin.dataset.saleBound = "1"; margin.addEventListener("input", () => recalculate(row)); }
    });
    const tbody = table.querySelector("tbody");
    if (tbody && !table.dataset.saleObserver) { table.dataset.saleObserver = "1"; const observer = new MutationObserver(() => { table.querySelectorAll("tbody tr").forEach((row) => { const sale = row.querySelector(".source-sale"), cost = row.querySelector(".source-cost"), margin = row.querySelector(".source-margin"); if (sale && sale.tagName !== "INPUT") { const value = twoDecimals(decimalValue(cost?.value || 0) * (1 + decimalValue(margin?.value || 0) / 100)); sale.outerHTML = `<input class="source-sale" type="text" inputmode="decimal" value="${value}" title="Satış qiymətini əl ilə də dəyişə bilərsiniz">`; } bindSaleFormatting(row.querySelector(".source-sale")); }); }); observer.observe(tbody, { childList: true }); }
    const save = document.querySelector("#detailSave");
    if (save && !save.dataset.manualSaleBound) {
      save.dataset.manualSaleBound = "1";
      const previous = save.onclick;
      save.onclick = () => {
        table.querySelectorAll("tbody tr").forEach((row) => {
          const cost = decimalValue(row.querySelector(".source-cost")?.value || 0);
          const sale = decimalValue(row.querySelector(".source-sale")?.value || 0);
          const margin = row.querySelector(".source-margin");
          if (margin && cost > 0 && sale >= 0) margin.value = (((sale / cost) - 1) * 100).toFixed(2);
        });

        // The original request save handler refreshes the current workspace.
        // Do not render the request list here: a user must remain in the same
        // request after saving a price, margin, supplier or status change.
        previous?.();
      };
    }
    const applyAll = document.querySelector("#applyAll");
    if (applyAll && !applyAll.dataset.recalculateBound) { applyAll.dataset.recalculateBound = "1"; const previousApply = applyAll.onclick; applyAll.onclick = () => { previousApply?.(); table.querySelectorAll("tbody tr").forEach((row) => recalculate(row)); }; }
  }
  window.addEventListener("load", () => { const original = window.detail; window.detail = (id) => { original(id); setTimeout(adjust, 0); }; });
})();
