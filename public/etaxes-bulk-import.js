/* Bulk incoming e-Taxes import. No stock is created before final confirmation. */
(() => {
  "use strict";
  const markupExtensions = new Set(["xml", "xhtml", "html", "htm"]);
  const spreadsheetExtensions = new Set(["xlsx", "xls", "csv", "tsv"]);
  let batch = [];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
  const money = (value) => new Intl.NumberFormat("az-AZ", { style: "currency", currency: "AZN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const extension = (name) => String(name || "").split(".").pop().toLowerCase();
  const toast = (message) => window.toast ? window.toast(message) : alert(message);
  const getModule = () => window.invoiceModule;
  const norm = (value) => String(value ?? "").toLocaleLowerCase("az-AZ").replace(/[ə]/g, "e").replace(/[ı]/g, "i").replace(/\s+/g, " ").trim();

  function parseEtxSummary(rows, filename) {
    const headerIndex = rows.findIndex((row) => row.some((value) => norm(value).includes("qaime nomresi")));
    if (headerIndex < 0) return null;
    const headers = rows[headerIndex].map(norm), find = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name))), seriesIndex = find("qaime seriyasi"), numberIndex = find("qaime nomresi"), tinIndex = find("voen"), nameIndex = find("adi"), dateIndex = find("qaime tarixi"), totalIndex = find("yekun mebleg"), vatIndex = find("qaime edv meblegi", "malin edv meblegi");
    if (numberIndex < 0 || totalIndex < 0) return null;
    return rows.slice(headerIndex + 1).map((row) => {
      const number = `${String(row[seriesIndex] || "").trim()}${String(row[numberIndex] || "").trim()}`.trim();
      if (!number || !/\d/.test(number)) return null;
      const toNumber = (value) => Number(String(value ?? "").replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")) || 0;
      return { number, supplier: String(row[nameIndex] || "").trim(), supplierTin: String(row[tinIndex] || "").trim(), date: String(row[dateIndex] || "").trim(), total: toNumber(row[totalIndex]), vat: toNumber(row[vatIndex]), items: [], filename, sourceFormat: "e‑Taxes Excel reyestri", sourceText: "", summaryOnly: true };
    }).filter(Boolean);
  }

  async function unzipInvoiceEntries(file) {
    const bytes = new Uint8Array(await file.arrayBuffer()), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder("utf-8");
    let eocd = -1;
    for (let index = Math.max(0, bytes.length - 65557); index <= bytes.length - 4; index += 1) if (view.getUint32(index, true) === 0x06054b50) eocd = index;
    if (eocd < 0) throw new Error(`${file.name}: ZIP arxivi etibarlı deyil.`);
    const total = view.getUint16(eocd + 10, true), directoryOffset = view.getUint32(eocd + 16, true);
    let pointer = directoryOffset, entries = [];
    for (let count = 0; count < total; count += 1) {
      if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error(`${file.name}: ZIP siyahısı oxunmadı.`);
      const method = view.getUint16(pointer + 10, true), compressedSize = view.getUint32(pointer + 20, true), nameLength = view.getUint16(pointer + 28, true), extraLength = view.getUint16(pointer + 30, true), commentLength = view.getUint16(pointer + 32, true), localOffset = view.getUint32(pointer + 42, true), name = decoder.decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
      pointer += 46 + nameLength + extraLength + commentLength;
      if (!markupExtensions.has(extension(name)) || view.getUint32(localOffset, true) !== 0x04034b50) continue;
      const localNameLength = view.getUint16(localOffset + 26, true), localExtraLength = view.getUint16(localOffset + 28, true), dataStart = localOffset + 30 + localNameLength + localExtraLength, compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let raw;
      if (method === 0) raw = compressed;
      else if (method === 8 && "DecompressionStream" in window) raw = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      else throw new Error(`${file.name}: ${name} üçün sıxılma formatı dəstəklənmir.`);
      entries.push({ name, text: decoder.decode(raw) });
    }
    if (!entries.length) throw new Error(`${file.name}: XML/XHTML qaimə tapılmadı. e‑Taxes “Paket” faylında elektron qaimələr olmalıdır.`);
    return entries;
  }

  async function readFiles(files) {
    const module = getModule();
    if (!module) throw new Error("Qaimə modulu hazır deyil. Səhifəni yeniləyin.");
    const accepted = [], errors = [];
    for (const file of files) {
      try {
        const ext = extension(file.name);
        if (ext === "zip") {
          const entries = await unzipInvoiceEntries(file);
          entries.forEach((entry) => { try { accepted.push({ invoice: module.parseInvoice(entry.text, entry.name), filename: entry.name }); } catch (error) { errors.push(`${entry.name}: ${error.message || "oxunmadı"}`); } });
        } else if (spreadsheetExtensions.has(ext)) {
          const rows = await window.readSpreadsheetRows(file), summary = parseEtxSummary(rows, file.name);
          if (summary?.length) summary.forEach((invoice) => accepted.push({ invoice, filename: file.name, summaryOnly: true }));
          else accepted.push({ invoice: await module.readInvoiceFile(file), filename: file.name });
        } else if (markupExtensions.has(ext)) accepted.push({ invoice: await module.readInvoiceFile(file), filename: file.name });
        else errors.push(`${file.name}: yalnız ZIP, XML/XHTML və ya Excel faylı seçin.`);
      } catch (error) { errors.push(`${file.name}: ${error.message || "oxunmadı"}`); }
    }
    const data = module.ensureData?.(), seen = new Set();
    const unique = accepted.filter((item) => {
      const key = String(item.invoice.number || "").trim().toLowerCase();
      if (!key || seen.has(key)) { errors.push(`${item.filename}: təkrarlanan qaimə nömrəsi.`); return false; }
      seen.add(key);
      if (data?.incomingInvoices?.some((invoice) => String(invoice.number).trim().toLowerCase() === key)) { errors.push(`${item.invoice.number}: sistemdə artıq mövcuddur.`); return false; }
      return true;
    });
    return { accepted: unique, errors };
  }

  function closeModal() { document.querySelector("#etaxesBulkModal")?.remove(); }
  function selectedItems() { return batch.filter((item) => document.querySelector(`[data-etax-item="${item.key}"]`)?.checked); }
  function drawPreview(errors = []) {
    const overlay = document.querySelector("#etaxesBulkModal"); if (!overlay) return;
    const total = batch.reduce((sum, item) => sum + (Number(item.invoice.total) || 0), 0);
    overlay.querySelector("[data-bulk-body]").innerHTML = batch.length ? `<div class="etax-summary"><div><small>Qaimə sayı</small><b>${batch.length}</b></div><div><small>Yekun məbləğ</small><b>${money(total)}</b></div><div><small>Format</small><b>e‑Taxes yoxlaması</b></div></div><div class="etax-notice">Məhsullar, təchizatçı və məbləğ əvvəlcə yoxlanılır. “Seçilənləri təsdiqlə” düyməsinə qədər anbar və qaimə reyestrinə heç nə yazılmır.</div><div class="table-wrap etax-table"><table class="tbl"><thead><tr><th><input type="checkbox" data-etax-all checked aria-label="Hamısını seç"></th><th>Qaimə</th><th>Təchizatçı</th><th>Məhsul</th><th>ƏDV</th><th>Yekun</th><th>Mənbə</th></tr></thead><tbody>${batch.map((item) => `<tr><td><input type="checkbox" data-etax-item="${item.key}" checked aria-label="${esc(item.invoice.number)} seç"></td><td><b>${esc(item.invoice.number)}</b><span class="muted">${esc(String(item.invoice.date || "").slice(0, 10))}</span></td><td>${esc(item.invoice.supplier || "—")}<span class="muted">${esc(item.invoice.supplierTin || "")}</span></td><td>${item.invoice.items?.length || 0} sətir</td><td>${money(item.invoice.vat)}</td><td><b>${money(item.invoice.total)}</b></td><td><span class="muted">${esc(item.filename)}</span></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty etax-empty">Oxuna bilən yeni qaimə tapılmadı.</div>`;
    overlay.querySelector("[data-bulk-errors]").innerHTML = errors.length ? `<details class="etax-errors"><summary>${errors.length} fayl/qaimə əlavə edilmədi</summary><ul>${errors.map((error) => `<li>${esc(error)}</li>`).join("")}</ul></details>` : "";
    overlay.querySelector("[data-etax-all]")?.addEventListener("change", (event) => overlay.querySelectorAll("[data-etax-item]").forEach((input) => { input.checked = event.target.checked; }));
    overlay.querySelector("[data-bulk-confirm]").disabled = !batch.length || batch.some((item) => item.invoice.summaryOnly);
  }

  function chooseFiles() {
    const input = document.createElement("input"); input.type = "file"; input.multiple = true; input.accept = ".zip,.xml,.xhtml,.html,.htm,.xlsx,.xls,.csv,.tsv";
    input.onchange = async () => {
      if (!input.files?.length) return;
      const button = document.querySelector("#etaxesBulkModal [data-bulk-choose]"); if (button) { button.disabled = true; button.textContent = "Oxunur…"; }
      try { const result = await readFiles([...input.files]); batch = result.accepted.map((item, index) => ({ ...item, key: `etax-${Date.now()}-${index}` })); drawPreview(result.errors); }
      catch (error) { batch = []; drawPreview([error.message || "Fayllar oxunmadı."]); }
      finally { if (button) { button.disabled = false; button.textContent = "Faylları seç"; } }
    };
    input.click();
  }

  function confirmBatch() {
    const selected = selectedItems();
    if (!selected.length) return toast("Ən azı bir qaimə seçin.");
    const module = getModule(), data = module?.ensureData?.(); if (!module || !data) return toast("Qaimə modulu hazır deyil.");
    let imported = 0, failed = []; closeModal();
    selected.forEach((item) => { const before = data.incomingInvoices.length; try { module.applyIncoming(item.invoice); if (data.incomingInvoices.length > before) imported += 1; else failed.push(item.invoice.number); } catch (_) { failed.push(item.invoice.number); } });
    if (imported) toast(`${imported} qaimə təsdiqləndi; mallar anbara lot kimi daxil edildi.${failed.length ? ` ${failed.length} qaimə yoxlanmalıdır.` : ""}`);
    else toast("Heç bir qaimə əlavə edilmədi. Qaimə istiqaməti və məhsul sətirlərini yoxlayın.");
  }

  function openBulkImport() {
    closeModal(); batch = [];
    const overlay = document.createElement("div"); overlay.id = "etaxesBulkModal"; overlay.className = "modal-bg";
    overlay.innerHTML = `<div class="modal etax-bulk-modal"><div class="documents-head"><div><div class="eyebrow">E‑TAXES · KÜTLƏVİ İDXAL</div><h2>Gələn qaimələri yoxla</h2><p>e‑Taxes “Paket” ZIP faylını və ya bir neçə XML/XHTML qaiməni seçin.</p></div><button class="icon" data-bulk-close>×</button></div><div class="etax-start"><b>1. e‑Taxes-də “Gələnlər” → Paket ilə qaimələri bir ZIP faylında endirin.</b><span>2. Burada ZIP-i seçin. Sistem qaimə, məhsul sətirləri, ƏDV və məbləğləri yoxlayacaq.</span></div><div data-bulk-body class="etax-upload"><button class="primary" data-bulk-choose>Faylları seç</button><p>ZIP (XML/XHTML), XML/XHTML və Excel dəstəklənir. Excel xülasəsində məhsul sətirləri yoxdursa, stok yaradılmayacaq.</p></div><div data-bulk-errors></div><div class="actions"><button class="secondary" data-bulk-close>Bağla</button><button class="primary" data-bulk-confirm disabled>✓ Seçilənləri təsdiqlə və anbara daxil et</button></div></div>`;
    overlay.onclick = (event) => { if (event.target === overlay || event.target.closest("[data-bulk-close]")) closeModal(); };
    overlay.querySelector("[data-bulk-choose]").onclick = chooseFiles;
    overlay.querySelector("[data-bulk-confirm]").onclick = confirmBatch;
    document.body.append(overlay);
  }

  function installButton() {
    const anchor = document.querySelector("#uploadIncoming");
    if (!anchor || document.querySelector("#eTaxesBulkImport")) return;
    const button = document.createElement("button"); button.type = "button"; button.id = "eTaxesBulkImport"; button.className = "secondary etax-bulk-button"; button.innerHTML = "⇅ e‑Taxes kütləvi idxal"; button.onclick = openBulkImport; anchor.before(button);
  }
  function installStyles() {
    if (document.querySelector("#etaxes-bulk-styles")) return;
    const style = document.createElement("style"); style.id = "etaxes-bulk-styles";
    style.textContent = `.etax-bulk-button{border-color:#c9d8f3!important;color:#155bb4!important;background:linear-gradient(135deg,#f8fbff,#edf5ff)!important}.etax-bulk-modal{width:min(1160px,calc(100% - 28px))}.etax-start{display:grid;gap:5px;margin:16px 0;padding:13px 15px;border:1px solid #d8e7fb;border-radius:12px;background:#f6faff;color:#52627a;font-size:13px;line-height:1.5}.etax-start b{color:#183a6a}.etax-upload{padding:28px 16px;text-align:center;border:1.5px dashed #b6cce9;border-radius:13px;background:#fbfdff}.etax-upload p{max-width:660px;margin:10px auto 0;color:#718097;font-size:12px;line-height:1.5}.etax-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.etax-summary>div{display:grid;gap:4px;padding:12px 13px;border:1px solid #e0e8f3;border-radius:11px;background:#fbfcfe}.etax-summary small{color:#8491a4;text-transform:uppercase;font-size:10px;letter-spacing:.05em}.etax-summary b{color:#193963;font-size:15px}.etax-notice{margin-bottom:12px;padding:10px 12px;border-radius:10px;background:#fff8e8;color:#8b6318;font-size:12px;line-height:1.45}.etax-table{max-height:380px;border:1px solid #e4eaf3;border-radius:12px}.etax-table td .muted{display:block;margin-top:3px;font-size:10px}.etax-table input[type=checkbox]{accent-color:#1b71d8;width:15px;height:15px}.etax-errors{margin-top:13px;padding:10px 12px;border:1px solid #f1d6db;border-radius:10px;background:#fff8f8;color:#9f2d43;font-size:12px}.etax-errors summary{cursor:pointer;font-weight:700}.etax-errors ul{margin:8px 0 0;padding-left:18px;max-height:130px;overflow:auto}.etax-empty{margin:16px 0}@media(max-width:700px){.etax-summary{grid-template-columns:1fr}.etax-bulk-modal .actions{flex-direction:column-reverse}.etax-bulk-modal .actions button{width:100%}}`;
    document.head.append(style);
  }
  window.addEventListener("load", () => { installStyles(); installButton(); new MutationObserver(installButton).observe(document.querySelector("#root") || document.body, { childList: true, subtree: true }); });
})();
