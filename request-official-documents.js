/* Editable official document workspaces generated from a request's priced items. */
(() => {
  "use strict";
  const VAT = 18;
  const TYPES = {
    INVOICE: { label: "Hesab-faktura", title: "HESAB-FAKTURA", short: "HF" },
    DELIVERY_HANDOVER: { label: "Təhvil-təslim aktı", title: "TƏHVİL-TƏSLİM AKTI", short: "TT" },
    PRICE_AGREEMENT: { label: "Qiymət razılaşma protokolu", title: "QİYMƏT RAZILAŞMA PROTOKOLU", short: "QRP" },
  };
  const TEMPLATES = {
    INVOICE: "templates/HF-yeni.xlsx",
    DELIVERY_HANDOVER: "templates/TT-yeni.xlsx",
    PRICE_AGREEMENT: "templates/QRP-yeni.xlsx",
  };
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
  const xml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[character]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => new Intl.NumberFormat("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value));
  const today = () => new Date().toISOString().slice(0, 10);
  const defaultDocument = (request, type) => ({
    type,
    city: "Bakı şəhəri",
    date: today(),
    number: request.id.replace(/^SR-/, ""),
    title: TYPES[type].title,
    intro: "Aşağıda qeyd olunan malların göndərilməsi ilə bağlı tərəflər arasında razılaşma əsasında tərtib edilmişdir.",
    seller: "AZPLOM MMC",
    sellerAddress: "",
    sellerPhone: "",
    buyer: request.customer || "",
    buyerAddress: "",
    buyerPhone: "",
    beneficiary: "AZPLOM MMC",
    taxId: "",
    account: "",
    bank: "",
    bankTaxId: "",
    bankCode: "",
    iban: "",
    swift: "",
    vatRate: VAT,
    items: (request.items || []).map(item => ({ name: item.name || "", unit: item.unit || "ədəd", quantity: number(item.qty), price: number(item.sale) })),
  });
  const getDraft = (request, type) => structuredClone(request.officeDocuments?.[type] || defaultDocument(request, type));
  const saveDraft = (request, draft, notify = true) => {
    request.officeDocuments ||= {};
    request.officeDocuments[draft.type] = structuredClone(draft);
    window.audit?.("DOCUMENT_EDIT", `${request.id}:${draft.type}`);
    window.save?.();
    if (notify) window.toast?.(`${TYPES[draft.type].label} yadda saxlanıldı.`);
  };
  const cell = (field, value, className = "") => `<input class="office-cell ${className}" data-field="${field}" value="${esc(value)}">`;
  const textCell = (field, value, className = "") => `<textarea class="office-cell ${className}" data-field="${field}">${esc(value)}</textarea>`;

  function style() {
    if (document.querySelector("#official-document-styles")) return;
    const css = document.createElement("style"); css.id = "official-document-styles";
    css.textContent = `.office-doc-top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:14px 0 18px}.office-doc-tabs{display:flex;gap:7px;flex-wrap:wrap}.office-doc-tab{border:1px solid #d7e1ee;border-radius:10px;background:#fff;color:#52647c;padding:9px 11px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}.office-doc-tab.active{background:#173d73;color:#fff;border-color:#173d73}.office-doc-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.office-sheet-wrap{overflow:auto;padding:24px;background:#e9eff6;border:1px solid #d9e3ee;border-radius:16px}.office-sheet{width:980px;min-height:1080px;margin:auto;padding:54px 56px;background:#fff;box-shadow:0 14px 34px #15274622;color:#132c4b;font-family:Arial,Helvetica,sans-serif}.office-sheet-header{display:grid;grid-template-columns:1fr 180px;align-items:center;gap:16px;font-size:13px;font-weight:700}.office-sheet-title{margin:38px 0 22px;text-align:center;font-size:23px;font-weight:800;letter-spacing:.2px}.office-meta{display:grid;grid-template-columns:92px minmax(0,1fr) 92px minmax(0,1fr);gap:0;border:1px solid #173d73;margin-bottom:17px}.office-meta span{display:flex;align-items:center;padding:8px 9px;border-right:1px solid #d4dfeb;border-bottom:1px solid #d4dfeb;background:#f2f7fc;font-size:11px;font-weight:800}.office-meta .office-cell{border:0;border-right:1px solid #d4dfeb;border-bottom:1px solid #d4dfeb;border-radius:0;box-shadow:none;min-height:37px}.office-intro{width:100%;min-height:62px;margin:8px 0 17px;padding:11px 12px;border:1px solid #cbd8e7;border-radius:8px;background:#fbfdff;color:#314a68;font:12px/1.5 Arial}.office-grid{width:100%;border-collapse:collapse;table-layout:fixed}.office-grid th{padding:10px 7px;border:1px solid #173d73;background:#173d73;color:#fff;font-size:11px;text-align:center}.office-grid td{padding:0;border:1px solid #cbd8e7}.office-grid .office-cell{width:100%;min-height:37px;border:0;border-radius:0;box-shadow:none;padding:8px 7px;background:transparent;font:12px Arial}.office-grid .num{text-align:right}.office-grid .row-control{width:43px;border:0;background:transparent;color:#b64152;font-size:17px;cursor:pointer}.office-add-row{margin-top:10px;border:1px dashed #9dbce1;border-radius:9px;background:#f7fbff;color:#1767ce;padding:8px 11px;font:inherit;font-weight:750;font-size:12px;cursor:pointer}.office-totals{width:310px;margin:18px 0 0 auto;border-collapse:collapse}.office-totals td{padding:9px 10px;border:1px solid #cbd8e7;font-size:12px}.office-totals td:first-child{font-weight:700;background:#f5f8fc}.office-totals td:last-child{text-align:right;font-weight:800}.office-parties{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:46px}.office-party{min-height:160px;border-top:1px solid #607b9c;padding-top:9px;font-size:12px}.office-party b{display:block;margin-bottom:10px}.office-bank{display:grid;grid-template-columns:145px 1fr;gap:0;margin-top:36px;border:1px solid #cbd8e7}.office-bank b{padding:9px;border-right:1px solid #cbd8e7;border-bottom:1px solid #cbd8e7;background:#f5f8fc;font-size:11px}.office-bank .office-cell{border:0;border-bottom:1px solid #cbd8e7;border-radius:0;box-shadow:none;min-height:35px}.office-cell{border:1px solid #cad8e7;border-radius:7px;background:#fff;color:#163451;font:inherit;padding:7px 8px;outline:none}.office-cell:focus{border-color:#4286de;box-shadow:0 0 0 3px #dceaff;background:#fff}.office-cell.area{width:100%;min-height:68px;resize:vertical}.office-field-label{display:block;color:#70829a;font-size:10px;font-weight:750;margin:8px 0 4px}.office-signature{margin-top:45px;font-size:12px}.office-sheet input[type=date]{font-family:inherit}@media(max-width:900px){.office-doc-top{align-items:flex-start;flex-direction:column}.office-doc-actions{justify-content:flex-start}.office-sheet-wrap{margin:0 -10px;border-radius:0;padding:10px}.office-sheet{transform-origin:top left}.office-sheet-header{font-size:12px}}`;
    document.head.append(css);
  }

  function itemRows(draft) {
    return draft.items.map((item, index) => `<tr data-item-index="${index}"><td class="num">${index + 1}</td><td><input class="office-cell" data-item="name" value="${esc(item.name)}"></td><td><input class="office-cell" data-item="unit" value="${esc(item.unit)}"></td><td><input class="office-cell num" data-item="quantity" type="number" min="0" step="0.001" value="${number(item.quantity)}"></td><td><input class="office-cell num" data-item="price" type="number" min="0" step="0.01" value="${number(item.price).toFixed(2)}"></td><td class="office-line-total num">${money(number(item.quantity) * number(item.price))}</td><td><button type="button" class="row-control" title="Sətiri sil">×</button></td></tr>`).join("");
  }
  function totals(draft) {
    const subtotal = draft.items.reduce((sum, item) => sum + number(item.quantity) * number(item.price), 0), vat = subtotal * number(draft.vatRate) / 100;
    return { subtotal, vat, total: subtotal + vat };
  }
  function renderEditor(request, type) {
    style();
    const draft = getDraft(request, type), info = TYPES[type], sum = totals(draft);
    page = "official-document";
    window.__officialDocumentType = type;
    document.querySelector("#root").innerHTML = `<div class="content"><div class="head"><div><button class="secondary" id="officeBack">← Sorğuya qayıt</button><div class="eyebrow" style="margin-top:16px">RƏSMİ SƏNƏD REDAKTORU</div><h1>${info.label}</h1><p>Excel görünüşündə məlumatları dəyişin, sonra sənədi .xlsx formatında endirin.</p></div></div><div class="office-doc-top"><div class="office-doc-tabs">${Object.entries(TYPES).map(([key, item]) => `<button type="button" class="office-doc-tab ${key === type ? "active" : ""}" data-document-type="${key}">${item.label}</button>`).join("")}</div><div class="office-doc-actions"><button type="button" class="secondary" id="officeSave">Yadda saxla</button><button type="button" class="primary" id="officeDownload">↧ Excel endir</button></div></div><div class="office-sheet-wrap"><section class="office-sheet" id="officeSheet"><div class="office-sheet-header"><input class="office-cell" data-field="city" value="${esc(draft.city)}"><input class="office-cell" data-field="date" type="date" value="${esc(draft.date)}"></div><input class="office-cell office-sheet-title" data-field="title" value="${esc(draft.title)}"><div class="office-meta"><span>${type === "INVOICE" ? "SATICI" : "Sənəd №"}</span>${type === "INVOICE" ? cell("seller", draft.seller) : cell("number", draft.number)}<span>${type === "INVOICE" ? "ALICI" : "Tarix"}</span>${type === "INVOICE" ? cell("buyer", draft.buyer) : cell("date", draft.date)}<span>${type === "INVOICE" ? "ÜNVAN" : "ALICI"}</span>${type === "INVOICE" ? cell("sellerAddress", draft.sellerAddress) : cell("buyer", draft.buyer)}<span>${type === "INVOICE" ? "ÜNVAN" : "SATICI"}</span>${type === "INVOICE" ? cell("buyerAddress", draft.buyerAddress) : cell("seller", draft.seller)}<span>${type === "INVOICE" ? "ƏLAQƏ" : "Qeyd"}</span>${type === "INVOICE" ? cell("sellerPhone", draft.sellerPhone) : cell("number", draft.number)}<span>${type === "INVOICE" ? "ƏLAQƏ" : ""}</span>${type === "INVOICE" ? cell("buyerPhone", draft.buyerPhone) : cell("vatRate", draft.vatRate)}</div>${type === "INVOICE" ? "" : textCell("intro", draft.intro, "office-intro")}<table class="office-grid"><thead><tr><th style="width:42px">№</th><th>Malın (iş,xidmət) adı</th><th style="width:104px">Ölçü vahidi</th><th style="width:94px">Miqdarı</th><th style="width:128px">Vahidin qiyməti</th><th style="width:132px">Ümumi dəyəri</th><th style="width:42px"></th></tr></thead><tbody id="officeItems">${itemRows(draft)}</tbody></table><button type="button" class="office-add-row" id="officeAddRow">＋ Sətir əlavə et</button><table class="office-totals"><tbody><tr><td>Cəm</td><td id="officeSubtotal">${money(sum.subtotal)}</td></tr><tr><td>ƏDV (<input class="office-cell" style="width:44px;padding:2px 4px" data-field="vatRate" type="number" min="0" step="0.01" value="${number(draft.vatRate)}">%)</td><td id="officeVat">${money(sum.vat)}</td></tr><tr><td>Yekun</td><td id="officeTotal">${money(sum.total)}</td></tr></tbody></table>${type === "INVOICE" ? `<div class="office-bank"><b>BENEFICIARY</b>${cell("beneficiary", draft.beneficiary)}<b>Company Tax ID</b>${cell("taxId", draft.taxId)}<b>ACCOUNT NUMBER</b>${cell("account", draft.account)}<b>BANK NAME</b>${cell("bank", draft.bank)}<b>Bank Tax ID</b>${cell("bankTaxId", draft.bankTaxId)}<b>Bank Code</b>${cell("bankCode", draft.bankCode)}<b>IBAN NUMBER</b>${cell("iban", draft.iban)}<b>SWIFT CODE</b>${cell("swift", draft.swift)}</div><div class="office-signature">İMZA __________________________</div>` : `<div class="office-parties"><div class="office-party"><b>ALICI</b><input class="office-cell" data-field="buyer" value="${esc(draft.buyer)}"><label class="office-field-label">İmza</label><div>____________________________</div></div><div class="office-party"><b>SATICI</b><input class="office-cell" data-field="seller" value="${esc(draft.seller)}"><label class="office-field-label">İmza</label><div>____________________________</div></div></div>`}</section></div></div>`;
    bindEditor(request, type);
  }

  function readEditor(type) {
    const draft = { type, items: [] };
    document.querySelectorAll("#officeSheet [data-field]").forEach(input => { draft[input.dataset.field] = input.value; });
    document.querySelectorAll("#officeItems tr").forEach(row => {
      draft.items.push({ name: row.querySelector('[data-item="name"]')?.value.trim() || "", unit: row.querySelector('[data-item="unit"]')?.value.trim() || "ədəd", quantity: number(row.querySelector('[data-item="quantity"]')?.value), price: number(row.querySelector('[data-item="price"]')?.value) });
    });
    draft.vatRate = number(draft.vatRate || VAT);
    return draft;
  }
  function refreshTotals(type) {
    const draft = readEditor(type), sum = totals(draft);
    document.querySelectorAll("#officeItems tr").forEach((row, index) => { const item = draft.items[index]; row.querySelector(".office-line-total").textContent = money(item.quantity * item.price); });
    document.querySelector("#officeSubtotal").textContent = money(sum.subtotal);
    document.querySelector("#officeVat").textContent = money(sum.vat);
    document.querySelector("#officeTotal").textContent = money(sum.total);
  }
  function bindEditor(request, type) {
    document.querySelector("#officeBack").onclick = () => { page = "request-detail"; window.openRequestWorkspace?.(request.id); };
    document.querySelectorAll("[data-document-type]").forEach(button => button.onclick = () => { saveDraft(request, readEditor(type), false); renderEditor(request, button.dataset.documentType); });
    document.querySelector("#officeSave").onclick = () => saveDraft(request, readEditor(type));
    document.querySelector("#officeDownload").onclick = async () => { const draft = readEditor(type); saveDraft(request, draft, false); await downloadXlsx(draft, request.id); };
    document.querySelector("#officeAddRow").onclick = () => { const draft = readEditor(type); draft.items.push({ name: "", unit: "ədəd", quantity: 0, price: 0 }); renderEditor(request, type); };
    document.querySelector("#officeItems").addEventListener("input", () => refreshTotals(type));
    document.querySelector("#officeSheet").addEventListener("input", event => { if (event.target.matches('[data-field="vatRate"]')) refreshTotals(type); });
    document.querySelectorAll(".row-control").forEach(button => button.onclick = () => { const draft = readEditor(type), index = Number(button.closest("tr").dataset.itemIndex); draft.items.splice(index, 1); renderEditor(request, type); });
  }

  const crc32 = bytes => { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; };
  const zip = entries => { const encoder = new TextEncoder(), chunks = [], central = []; let offset = 0; const p16 = (array, value) => array.push(value & 255, (value >>> 8) & 255), p32 = (array, value) => array.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255); entries.forEach(([name, text]) => { const file = encoder.encode(text), filename = encoder.encode(name), crc = crc32(file), local = []; p32(local, 0x04034b50); p16(local, 20); p16(local, 0x0800); p16(local, 0); p16(local, 0); p16(local, 0); p32(local, crc); p32(local, file.length); p32(local, file.length); p16(local, filename.length); p16(local, 0); local.push(...filename, ...file); chunks.push(new Uint8Array(local)); const record = []; p32(record, 0x02014b50); p16(record, 20); p16(record, 20); p16(record, 0x0800); p16(record, 0); p16(record, 0); p16(record, 0); p32(record, crc); p32(record, file.length); p32(record, file.length); p16(record, filename.length); p16(record, 0); p16(record, 0); p16(record, 0); p16(record, 0); p32(record, 0); p32(record, offset); record.push(...filename); central.push(new Uint8Array(record)); offset += local.length; }); const size = central.reduce((sum, item) => sum + item.length, 0), end = []; p32(end, 0x06054b50); p16(end, 0); p16(end, 0); p16(end, entries.length); p16(end, entries.length); p32(end, size); p32(end, offset); p16(end, 0); return new Blob([...chunks, ...central, new Uint8Array(end)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); };
  const col = index => { let value = ""; for (let number = index + 1; number; number = Math.floor((number - 1) / 26)) value = String.fromCharCode(65 + ((number - 1) % 26)) + value; return value; };
  const xcell = (column, row, value, style = 0, formula = "") => `<c r="${col(column)}${row}"${style ? ` s="${style}"` : ""}${formula ? "" : ' t="inlineStr"'}>${formula ? `<f>${formula}</f><v>${number(value)}</v>` : `<is><t xml:space="preserve">${xml(value)}</t></is>`}</c>`;
  function xlsxWorksheet(draft) {
    const type = draft.type, sum = totals(draft), rows = [], add = (row, cells) => rows.push(`<row r="${row}">${cells.join("")}</row>`);
    add(1, [xcell(0, 1, draft.city, 1), xcell(6, 1, draft.date, 1)]);
    add(3, [xcell(0, 3, draft.title, 3)]);
    if (type === "INVOICE") { add(5, [xcell(0, 5, "SATICI", 1), xcell(1, 5, draft.seller), xcell(4, 5, "ALICI", 1), xcell(5, 5, draft.buyer)]); add(6, [xcell(0, 6, "ÜNVAN", 1), xcell(1, 6, draft.sellerAddress), xcell(4, 6, "ÜNVAN", 1), xcell(5, 6, draft.buyerAddress)]); }
    else { add(5, [xcell(0, 5, "Sənəd №", 1), xcell(1, 5, draft.number), xcell(4, 5, "Tarix", 1), xcell(5, 5, draft.date)]); add(6, [xcell(0, 6, draft.intro, 0)]); }
    const headerRow = 8; add(headerRow, ["№", "Malın (iş,xidmət) adı", "", "Ölçü vahidi", "Miqdarı", "Vahidin qiyməti", "Ümumi dəyəri"].map((value, index) => xcell(index, headerRow, value, 2)));
    draft.items.forEach((item, index) => { const row = headerRow + index + 1; add(row, [xcell(0, row, index + 1, 0), xcell(1, row, item.name), xcell(3, row, item.unit), xcell(4, row, number(item.quantity)), xcell(5, row, number(item.price)), xcell(6, row, number(item.quantity) * number(item.price), 0, `E${row}*F${row}`)]); });
    const totalRow = headerRow + draft.items.length + 1, firstItem = headerRow + 1, lastItem = Math.max(firstItem, totalRow - 1); add(totalRow, [xcell(5, totalRow, "Cəm", 1), xcell(6, totalRow, sum.subtotal, 1, `SUM(G${firstItem}:G${lastItem})`)]); add(totalRow + 1, [xcell(5, totalRow + 1, "ƏDV", 1), xcell(6, totalRow + 1, sum.vat, 1, `G${totalRow}*${number(draft.vatRate) / 100}`)]); add(totalRow + 2, [xcell(5, totalRow + 2, "Yekun", 1), xcell(6, totalRow + 2, sum.total, 1, `G${totalRow}+G${totalRow + 1}`)]);
    if (type === "INVOICE") { const start = totalRow + 5, pairs = [["BENEFICIARY", draft.beneficiary], ["Company Tax ID", draft.taxId], ["ACCOUNT NUMBER", draft.account], ["BANK NAME", draft.bank], ["Bank Tax ID", draft.bankTaxId], ["Bank Code", draft.bankCode], ["IBAN NUMBER", draft.iban], ["SWIFT CODE", draft.swift]]; pairs.forEach(([label, value], index) => add(start + index, [xcell(0, start + index, label, 1), xcell(2, start + index, value)])); }
    else { const start = totalRow + 5; add(start, [xcell(0, start, "ALICI", 1), xcell(4, start, "SATICI", 1)]); add(start + 1, [xcell(0, start + 1, draft.buyer), xcell(4, start + 1, draft.seller)]); add(start + 5, [xcell(0, start + 5, "İmza ________________________"), xcell(4, start + 5, "İmza ________________________")]); }
    const merges = ["A3:G3", "B8:C8"].concat(type === "INVOICE" ? ["B5:C5", "F5:G5", "B6:C6", "F6:G6"] : ["A6:G6"]);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="8"/><col min="2" max="2" width="35"/><col min="3" max="3" width="9"/><col min="4" max="4" width="14"/><col min="5" max="5" width="13"/><col min="6" max="6" width="17"/><col min="7" max="7" width="18"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map(range => `<mergeCell ref="${range}"/>`).join("")}</mergeCells></worksheet>`;
  }
  const xlsxStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="16"/><color rgb="FF173D73"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173D73"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs></styleSheet>`;
  function downloadFallbackXlsx(draft, requestId) {
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><calcPr calcMode="auto"/><sheets><sheet name="${xml(TYPES[draft.type].label)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const blob = zip([["[Content_Types].xml", contentTypes], ["_rels/.rels", rels], ["xl/workbook.xml", workbook], ["xl/_rels/workbook.xml.rels", workbookRels], ["xl/styles.xml", xlsxStyles], ["xl/worksheets/sheet1.xml", xlsxWorksheet(draft)]]), link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `${TYPES[draft.type].short}-${requestId}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  const excelDate = value => Math.round((Date.parse(`${value || today()}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000);
  const replaceCell = (sheet, reference, value, numeric = false) => {
    const expression = new RegExp(`<c\\b([^>]*\\br="${reference}"[^>]*)>([\\s\\S]*?)<\\/c>`);
    return sheet.replace(expression, (_, attributes) => {
      const cleaned = attributes.replace(/\s+t="[^"]*"/g, "");
      return numeric
        ? `<c${cleaned}><v>${value === "" ? "" : number(value)}</v></c>`
        : `<c${cleaned} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    });
  };
  const shiftReferences = (value, startRow, amount) => value.replace(/([A-Z]+)(\d+)/g, (_, column, rawRow) => `${column}${Number(rawRow) >= startRow ? Number(rawRow) + amount : rawRow}`);
  const expandTemplateRows = (sheet, firstRow, extraRows) => {
    if (!extraRows) return sheet;
    const lastTemplateRow = firstRow + 3, nextRow = lastTemplateRow + 1;
    const source = sheet.match(new RegExp(`<row r="${lastTemplateRow}"[\\s\\S]*?<\\/row>`));
    if (!source) return sheet;
    // Keep every existing formula, merge and lower signature/bank block in the
    // original template, then clone its final styled product row as needed.
    sheet = shiftReferences(sheet, nextRow, extraRows);
    const clones = Array.from({ length: extraRows }, (_, index) => shiftReferences(source[0], nextRow, index + 1)).join("");
    sheet = sheet.replace(source[0], `${source[0]}${clones}`);
    const merge = `B${lastTemplateRow}:C${lastTemplateRow}`;
    const extraMerges = Array.from({ length: extraRows }, (_, index) => `<mergeCell ref="B${nextRow + index}:C${nextRow + index}"/>`).join("");
    sheet = sheet.replace(/<mergeCells count="(\d+)">/, (_, count) => `<mergeCells count="${Number(count) + extraRows}">`);
    sheet = sheet.replace(`<mergeCell ref="${merge}"/>`, `<mergeCell ref="${merge}"/>${extraMerges}`);
    return sheet;
  };
  async function downloadXlsx(draft, requestId) {
    if (!window.JSZip) { downloadFallbackXlsx(draft, requestId); return; }
    const response = await fetch(TEMPLATES[draft.type], { cache: "no-store" });
    if (!response.ok) { window.toast?.("Excel şablonu yüklənmədi."); return; }
    const workbook = await window.JSZip.loadAsync(await response.arrayBuffer());
    const sheetFile = workbook.file("xl/worksheets/sheet1.xml");
    if (!sheetFile) { window.toast?.("Excel şablonunda əsas səhifə tapılmadı."); return; }
    const itemStart = draft.type === "INVOICE" ? 19 : 17, lineCount = Math.max(4, draft.items.length), extraRows = lineCount - 4;
    let sheet = expandTemplateRows(await sheetFile.async("string"), itemStart, extraRows), sum = totals(draft);
    const text = (cell, value) => { sheet = replaceCell(sheet, cell, value); };
    const numeric = (cell, value) => { sheet = replaceCell(sheet, cell, value, true); };
    if (draft.type === "INVOICE") {
      text("A9", draft.city); numeric("F9", excelDate(draft.date)); text("A12", draft.title); text("B14", draft.seller); text("F14", draft.buyer); text("B15", draft.sellerAddress); text("F15", draft.buyerAddress); text("B16", draft.sellerPhone); text("F16", draft.buyerPhone);
      const bankRow = 27 + extraRows; text(`C${bankRow}`, draft.beneficiary); text(`C${bankRow + 1}`, draft.taxId); text(`C${bankRow + 2}`, draft.account); text(`C${bankRow + 3}`, draft.bank); text(`C${bankRow + 4}`, draft.bankTaxId); text(`C${bankRow + 5}`, draft.bankCode); text(`C${bankRow + 7}`, draft.iban); text(`C${bankRow + 8}`, draft.swift);
    } else {
      text("A9", draft.city); numeric("G9", excelDate(draft.date)); text(draft.type === "DELIVERY_HANDOVER" ? "A11" : "B11", `${draft.title} №${draft.number}`); text("A13", draft.intro);
      const partyRow = (draft.type === "DELIVERY_HANDOVER" ? 28 : 30) + extraRows; text(`A${partyRow}`, draft.buyer); text(`E${partyRow}`, draft.seller);
    }
    for (let index = 0; index < 4; index += 1) {
      const item = draft.items[index] || { name: "", unit: "", quantity: "", price: "" }, row = itemStart + index;
      numeric(`A${row}`, index < draft.items.length ? index + 1 : ""); text(`B${row}`, item.name); text(`D${row}`, item.unit); numeric(`E${row}`, item.quantity); numeric(`F${row}`, item.price); numeric(`G${row}`, number(item.quantity) * number(item.price));
    }
    const totalRow = itemStart + lineCount; numeric(`G${totalRow}`, sum.subtotal); numeric(`G${totalRow + 1}`, sum.vat); numeric(`G${totalRow + 2}`, sum.total);
    workbook.file("xl/worksheets/sheet1.xml", sheet);
    const blob = await workbook.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }), link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `${TYPES[draft.type].short}-${requestId}.xlsx`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    window.toast?.(`${TYPES[draft.type].label} göndərdiyiniz Excel şablonunda hazırlandı.`);
  }
  function addLauncher() {
    const requestId = document.querySelector("#root .content h1")?.textContent?.trim();
    const request = (window.db?.requests || []).find(item => item.id === requestId); if (!request || document.querySelector("#officialDocuments")) return;
    const actions = document.querySelector("#detailSave")?.parentElement; if (!actions) return;
    const button = document.createElement("button"); button.type = "button"; button.id = "officialDocuments"; button.className = "secondary"; button.textContent = "Rəsmi sənədlər";
    button.onclick = () => renderEditor(request, "INVOICE"); actions.insertBefore(button, document.querySelector("#detailSave"));
  }
  window.addEventListener("load", () => {
    window.openOfficialDocument = renderEditor;
    const root = document.querySelector("#root");
    if (!root || root.dataset.officialDocumentObserver) return;
    root.dataset.officialDocumentObserver = "1";
    new MutationObserver(addLauncher).observe(root, { childList: true, subtree: true });
    setTimeout(addLauncher, 0);
  });
})();
