/* Client-side request spreadsheet reader: no uploaded file leaves the browser. */
(() => {
  const text = (node) => Array.from(node?.querySelectorAll("t") || []).map((x) => x.textContent).join("");
  const column = (ref = "A1") => ref.replace(/[0-9]/g, "").split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const normalized = (value) => String(value || "").toLocaleLowerCase("az").replace(/[ə]/g, "e").replace(/[ı]/g, "i").replace(/[ü]/g, "u").replace(/[ş]/g, "s").replace(/[ö]/g, "o").replace(/[ç]/g, "c").trim();
  const readNumber = (value) => {
    const raw = String(value ?? "").trim().replace(/\s/g, "");
    if (!raw) return NaN;
    const thousands = /^\d{1,3}([.,]\d{3})+$/.test(raw);
    return Number(thousands ? raw.replace(/[.,]/g, "") : raw.replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, ""));
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[x]));
  const csvRows = (source) => {
    const delimiter = (source.match(/\t/g) || []).length >= (source.match(/;/g) || []).length && (source.match(/\t/g) || []).length >= (source.match(/,/g) || []).length ? "\t" : (source.match(/;/g) || []).length > (source.match(/,/g) || []).length ? ";" : ",";
    const rows = [], current = []; let value = "", quoted = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i], next = source[i + 1];
      if (char === '"' && quoted && next === '"') { value += '"'; i += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (!quoted && char === delimiter) { current.push(value.trim()); value = ""; continue; }
      if (!quoted && (char === "\n" || char === "\r")) { if (char === "\r" && next === "\n") i += 1; current.push(value.trim()); if (current.some((cell) => cell)) rows.push(current.splice(0)); value = ""; continue; }
      value += char;
    }
    current.push(value.trim()); if (current.some((cell) => cell)) rows.push(current);
    return rows;
  };
  const decodeCell = (value) => {
    const holder = document.createElement("div"); holder.innerHTML = String(value || "");
    return (holder.textContent || "").replace(/\s+/g, " ").trim();
  };
  const htmlRows = (source) => {
    const clean = String(source || "").replace(/\u0000/g, "").replace(/^\uFEFF/, "").replace(/<!--[\s\S]*?-->/g, "");
    const withoutCode = clean.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi, "");
    const doc = new DOMParser().parseFromString(withoutCode, "text/html");
    const table = doc.querySelector("table");
    if (table) {
      const rows = [...table.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("th,td")].map((cell) => decodeCell(cell.innerHTML))).filter((row) => row.some(Boolean));
      if (rows.length) return rows;
    }
    const htmlRowsFallback = [...withoutCode.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => [...match[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => decodeCell(cell[1]))).filter((row) => row.some(Boolean));
    if (htmlRowsFallback.length) return htmlRowsFallback;
    // Excel may save .xls as SpreadsheetML XML instead of an HTML table.
    const xmlRows = [...withoutCode.matchAll(/<Row\b[^>]*>([\s\S]*?)<\/Row>/gi)].map((match) => [...match[1].matchAll(/<Cell\b[^>]*>([\s\S]*?)<\/Cell>/gi)].map((cell) => decodeCell(cell[1].replace(/<Data\b[^>]*>/i, "").replace(/<\/Data>/i, "")))).filter((row) => row.some(Boolean));
    if (xmlRows.length) return xmlRows;
    // Last fallback for files exported as tab/comma-delimited text with an .xls suffix.
    if (/[<>]/.test(clean)) throw new Error("Excel cədvəli tanınmadı. XLSX və ya CSV kimi saxlayıb yenidən yükləyin.");
    const plain = clean.replace(/&nbsp;/gi, " ").trim();
    const delimited = plain.includes("\t") || plain.includes(",") || plain.includes(";") ? csvRows(plain) : [];
    if (delimited.length) return delimited;
    throw new Error("Excel cədvəli tanınmadı. Faylı XLSX və ya CSV kimi saxlayıb yenidən yükləyin.");
  };

  async function readTextFile(file) {
    const buffer = await file.arrayBuffer(), bytes = new Uint8Array(buffer);
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
    return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "");
  }
  async function isZipFile(file) {
    const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  }
  async function isLegacyBinaryXls(file) {
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    return [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((value, index) => bytes[index] === value);
  }

  async function inflate(data) {
    if (!("DecompressionStream" in window)) throw new Error("Brauzer XLSX sıxılmasını dəstəkləmir. Faylı CSV kimi saxlayın.");
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function unzip(buffer) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer); let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    if (end < 0) throw new Error("Fayl etibarlı XLSX arxivi deyil.");
    const count = view.getUint16(end + 10, true), cd = view.getUint32(end + 16, true), out = {};
    let pos = cd;
    for (let i = 0; i < count; i++) {
      if (view.getUint32(pos, true) !== 0x02014b50) break;
      const method = view.getUint16(pos + 10, true), compressed = view.getUint32(pos + 20, true), nameLen = view.getUint16(pos + 28, true), extraLen = view.getUint16(pos + 30, true), commentLen = view.getUint16(pos + 32, true), local = view.getUint32(pos + 42, true);
      const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));
      const localNameLen = view.getUint16(local + 26, true), localExtraLen = view.getUint16(local + 28, true), start = local + 30 + localNameLen + localExtraLen;
      const raw = bytes.slice(start, start + compressed);
      out[name] = method === 0 ? raw : method === 8 ? await inflate(raw) : (() => { throw new Error("Dəstəklənməyən XLSX sıxılma formatı."); })();
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }
  async function xlsxRows(file) {
    const files = await unzip(await file.arrayBuffer()), decode = new TextDecoder();
    const sharedXml = files["xl/sharedStrings.xml"] ? new DOMParser().parseFromString(decode.decode(files["xl/sharedStrings.xml"]), "application/xml") : null;
    const shared = sharedXml ? Array.from(sharedXml.querySelectorAll("si")).map(text) : [];
    const worksheets = Object.entries(files).filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    if (!worksheets.length) throw new Error("Excel faylında iş səhifəsi tapılmadı.");
    const parseSheet = (source) => {
      const xml = new DOMParser().parseFromString(decode.decode(source), "application/xml");
      return Array.from(xml.querySelectorAll("sheetData > row")).map((row) => {
        const output = [];
        row.querySelectorAll("c").forEach((cell) => {
          const type = cell.getAttribute("t"), raw = cell.querySelector("v")?.textContent || text(cell), index = column(cell.getAttribute("r") || "A1");
          output[index] = type === "s" ? shared[Number(raw)] : type === "b" ? (raw === "1" ? "TRUE" : "FALSE") : raw;
        });
        return output;
      }).filter((row) => row.some((cell) => String(cell || "").trim()));
    };
    return worksheets.map(([, source]) => parseSheet(source)).sort((a, b) => b.length - a.length)[0];
  }
  async function readSpreadsheetRows(file) {
    const extension = String(file?.name || "").split(".").pop().toLocaleLowerCase("az-AZ");
    if (extension === "xlsx") return xlsxRows(file);
    if (extension === "xls" && await isLegacyBinaryXls(file)) throw new Error("Bu köhnə binary .xls formatıdır. Excel-də Fərqli yadda saxla → .xlsx seçib yenidən yükləyin.");
    if (extension === "xls" && await isZipFile(file)) return xlsxRows(file);
    const source = await readTextFile(file);
    if (["csv", "tsv", "txt"].includes(extension)) return csvRows(source);
    if (["xls", "html", "htm"].includes(extension)) return htmlRows(source);
    throw new Error("Bu fayl formatı oxunmadı. XLSX, CSV və ya Excel-dən ixrac olunmuş .xls seçin.");
  }
  window.readSpreadsheetRows = readSpreadsheetRows;
  const unitValue = (value) => {
    const key = normalized(value).replace(/[.]/g, "");
    return ({ pcs: "ədəd", pc: "ədəd", piece: "ədəd", pieces: "ədəd", adet: "ədəd", eded: "ədəd", kg: "kq", kilo: "kq", kilogram: "kq", gr: "qram", g: "qram", ton: "ton", l: "litr", lt: "litr", meter: "metr", m: "metr", mm: "mm", cm: "sm", box: "qutu", pack: "paket", paket: "paket" }[key] || String(value || "ədəd").replace(/\s+/g, " ").trim() || "ədəd");
  };
  const columnName = (index) => { let name = "", value = index + 1; while (value) { const rest = (value - 1) % 26; name = String.fromCharCode(65 + rest) + name; value = Math.floor((value - 1) / 26); } return name; };
  const firstColumn = (headers, terms) => headers.findIndex((head) => terms.some((term) => head === term || head.includes(`${term} `) || head.endsWith(` ${term}`)));
  const headerTerms = {
    name: ["mehsul adi", "mal adi", "product name", "item name", "description", "tovar", "naimenovanie", "ad"],
    genericName: ["mehsul", "mallar", "mal", "goods", "product", "xidmet"],
    feature: ["xususiyyet", "feature", "model", "material", "olcu", "size", "renk", "reng", "color", "kod", "sku", "description", "aciqlama"],
    quantity: ["miqdar", "say", "eded", "teleb", "quantity", "qty", "kolichestvo", "menge"],
    unit: ["vahid", "unit", "olcu vahidi", "birim", "edinica"],
    cost: ["alis", "cost", "maya", "purchase", "buying"],
    sale: ["satis", "sale", "selling", "price", "qiymet", "retail"],
  };
  function detectColumns(rows) {
    if (!rows.length) return { headerRow: 0, dataStart: 0, headers: [], nameIndexes: [], qtyIndex: -1, unitIndex: -1, costIndex: -1, saleIndex: -1 };
    let headerRow = -1, bestScore = -1;
    rows.forEach((row, index) => {
      const current = row.map(normalized).join(" "), next = (rows[index + 1] || []).map(normalized).join(" "), all = `${current} ${next}`;
      const score = (/(mallar|mehsul|goods|product|xidmet|naimenovanie|tovar)/.test(current) ? 2 : 0) + (/(miqdar|teleb|say|quantity|qty|kolichestvo)/.test(all) ? 2 : 0) + (/(olcu|vahid|unit|birim)/.test(all) ? 1 : 0) + (/(^|\s)(no|№|sku)(\s|$)/.test(current) ? 1 : 0);
      if (score > bestScore) { bestScore = score; headerRow = index; }
    });
    const hasHeader = headerRow >= 0 && bestScore >= 2;
    if (!hasHeader) { headerRow = 0; bestScore = 0; }
    const nextHeader = rows[headerRow + 1] || [];
    const hasSecondHeader = hasHeader && nextHeader.some((cell) => /(vahid|miqdar|olcu|say|unit|quantity)/.test(normalized(cell)));
    const headers = (rows[headerRow] || []).map((cell, index) => `${cell || ""} ${hasSecondHeader ? nextHeader[index] || "" : ""}`).map(normalized);
    const nameIndex = firstColumn(headers, headerTerms.name) >= 0 ? firstColumn(headers, headerTerms.name) : firstColumn(headers, headerTerms.genericName);
    const qtyIndex = firstColumn(headers, headerTerms.quantity), unitIndex = firstColumn(headers, headerTerms.unit), costIndex = firstColumn(headers, headerTerms.cost), saleIndex = firstColumn(headers, headerTerms.sale);
    const featureIndexes = headers.map((head, index) => headerTerms.feature.some((term) => head === term || head.includes(`${term} `)) ? index : -1).filter((index) => index >= 0 && index !== nameIndex && index !== qtyIndex && index !== unitIndex && index !== costIndex && index !== saleIndex);
    return { headerRow, dataStart: hasHeader ? headerRow + (hasSecondHeader ? 2 : 1) : 0, headers, nameIndexes: nameIndex >= 0 ? [nameIndex, ...featureIndexes] : featureIndexes, qtyIndex, unitIndex, costIndex, saleIndex, hasHeader };
  }
  function inferColumns(rows, start = 0) {
    const data = rows.slice(start).filter((row) => row.some((cell) => String(cell || "").trim()));
    const width = Math.max(...data.map((row) => row.length), 0);
    const scores = Array.from({ length: width }, (_, index) => {
      const values = data.map((row) => String(row[index] ?? "").trim()).filter(Boolean);
      const numeric = values.filter((value) => Number.isFinite(readNumber(value)) && readNumber(value) > 0).length;
      const units = values.filter((value) => /^(pcs?|ədəd|adet|kq|kg|qram|g|ton|litr?|l|metr|m|qutu|paket)$/i.test(value)).length;
      const textValues = values.filter((value) => !Number.isFinite(readNumber(value)));
      return { index, numericRatio: values.length ? numeric / values.length : 0, unitRatio: values.length ? units / values.length : 0, textRatio: values.length ? textValues.length / values.length : 0, averageText: textValues.reduce((sum, value) => sum + value.length, 0) / Math.max(1, textValues.length) };
    });
    const qty = [...scores].sort((a, b) => (b.numericRatio + b.averageText / 10000) - (a.numericRatio + a.averageText / 10000))[0];
    const unit = [...scores].sort((a, b) => b.unitRatio - a.unitRatio)[0];
    const name = [...scores].filter((score) => score.index !== qty?.index && score.index !== unit?.index).sort((a, b) => (b.textRatio + b.averageText / 1000) - (a.textRatio + a.averageText / 1000))[0];
    if (!name || !qty || qty.numericRatio < 0.35 || name.textRatio < 0.35) return null;
    return { nameIndexes: [name.index], qtyIndex: qty.index, unitIndex: unit && unit.unitRatio > 0.25 ? unit.index : -1, costIndex: -1, saleIndex: -1, dataStart: start };
  }
  function buildItems(rows, mapping) {
    return rows.slice(mapping.dataStart || 0).map((row) => {
      const name = mapping.nameIndexes.map((index) => String(row[index] || "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ");
      return { name, qty: readNumber(row[mapping.qtyIndex]), unit: unitValue(row[mapping.unitIndex]), cost: readNumber(row[mapping.costIndex]) || 0, sale: readNumber(row[mapping.saleIndex]) || 0 };
    }).filter((item) => item.name && Number.isFinite(item.qty) && item.qty > 0);
  }
  function extract(rows) {
    if (rows.length < 1) throw new Error("Excel faylında məlumat sətri tapılmadı.");
    const detected = detectColumns(rows);
    let mapping = detected;
    if (mapping.nameIndexes.length < 1 || mapping.qtyIndex < 0) mapping = inferColumns(rows, detected.hasHeader ? detected.dataStart : 0) || null;
    if (!mapping || mapping.nameIndexes.length < 1 || mapping.qtyIndex < 0) { const error = new Error("Sütunlar avtomatik tanınmadı. Aşağıdakı xəritələndirmə ilə sütunları seçin."); error.code = "MAPPING_REQUIRED"; error.rows = rows; error.detected = detected; throw error; }
    const items = buildItems(rows, mapping);
    if (!items.length) throw new Error("Uyğun məhsul sətri tapılmadı. Miqdar sütununu yoxlayın.");
    return items;
  }
  function mappingSelect(id, label, headers, selected = -1, multiple = false) {
    const options = headers.map((header, index) => `<option value="${index}" ${multiple ? (selected.includes(index) ? "selected" : "") : (selected === index ? "selected" : "")}>${columnName(index)} · ${escapeHtml(header || "Sütun ${columnName(index)}")}</option>`).join("");
    return `<div class="field"><label for="${id}">${label}</label><select id="${id}" ${multiple ? "multiple size=4" : ""}>${multiple ? options : `<option value="-1">— yoxdur</option>${options}`}</select></div>`;
  }
  function showMapping(rows, filename, detected = {}) {
    const target = document.querySelector("#excelResult"); if (!target) return;
    const width = Math.max(...rows.map((row) => row.length), 0), headers = Array.from({ length: width }, (_, index) => rows[detected.headerRow || 0]?.[index] || `Sütun ${columnName(index)}`);
    const suggestion = inferColumns(rows, detected.hasHeader ? detected.dataStart : 0) || { nameIndexes: [0], qtyIndex: width > 1 ? 1 : 0, unitIndex: -1, costIndex: -1, saleIndex: -1, dataStart: detected.hasHeader ? detected.dataStart : 0 };
    const preview = rows.slice(suggestion.dataStart, suggestion.dataStart + 4).map((row) => `<tr>${headers.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("");
    target.innerHTML = `<div class="result"><b>Sütun xəritələndirməsi tələb olunur</b><span class="muted">${escapeHtml(filename)} · Məhsul və miqdar sütunlarını seçin, sonra tətbiq edin.</span><div class="form" id="excelMappingForm">${mappingSelect("mapName", "Məhsul adı sütun(ları)", headers, suggestion.nameIndexes, true)}${mappingSelect("mapQty", "Miqdar sütunu", headers, suggestion.qtyIndex)}${mappingSelect("mapUnit", "Vahid sütunu", headers, suggestion.unitIndex)}${mappingSelect("mapCost", "Alış qiyməti sütunu", headers, suggestion.costIndex)}${mappingSelect("mapSale", "Satış qiyməti sütunu", headers, suggestion.saleIndex)}<div class="field"><label for="mapStart">Məlumatın başladığı sətir</label><input id="mapStart" type="number" min="1" value="${(suggestion.dataStart || 0) + 1}"></div></div><div class="table-wrap"><table class="tbl"><thead><tr>${headers.map((header, index) => `<th>${columnName(index)} · ${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${preview}</tbody></table></div><button type="button" class="primary" id="applyMapping">Xəritəni tətbiq et</button></div>`;
    document.querySelector("#applyMapping").onclick = () => {
      const selectedNames = [...document.querySelector("#mapName").selectedOptions].map((option) => Number(option.value)).filter((index) => index >= 0);
      const mapping = { nameIndexes: selectedNames, qtyIndex: Number(document.querySelector("#mapQty").value), unitIndex: Number(document.querySelector("#mapUnit").value), costIndex: Number(document.querySelector("#mapCost").value), saleIndex: Number(document.querySelector("#mapSale").value), dataStart: Math.max(0, Number(document.querySelector("#mapStart").value || 1) - 1) };
      const items = buildItems(rows, mapping);
      if (!items.length) return window.toast("Seçilən sütunlarla məhsul tapılmadı. Miqdar sütununu dəyişin.");
      result(items, filename);
    };
  }
  function downloadSample() {
    const link = document.createElement("a"); link.href = new URL("techizat-sorgu-numune.xlsx?v=xlsx-safe2", location.href).href; link.download = "techizat-sorgu-numune.xlsx"; link.click(); window.toast("Makrosuz Excel nümunəsi (XLSX) endirildi");
  }
  function result(items, filename) {
    const target = document.querySelector("#excelResult");
    if (!target) return;
    target.innerHTML = `<div class="result"><b>${items.length} məhsul çıxarıldı · İnsan təsdiqi gözlənilir</b><span class="muted">${filename}</span><table class="tbl"><thead><tr><th>Məhsul</th><th>Miqdar</th><th>Vahid</th><th>Alış</th><th>Satış</th></tr></thead><tbody>${items.map((i) => `<tr><td>${escapeHtml(i.name)}</td><td>${i.qty}</td><td>${escapeHtml(i.unit)}</td><td>${i.cost || '—'}</td><td>${i.sale || '—'}</td></tr>`).join("")}</tbody></table><button type="button" class="primary" id="applyExcel">Sorğuya tətbiq et</button></div>`;
    document.querySelector("#applyExcel").onclick = () => {
      const field = document.querySelector("#requestForm textarea[name=items]");
      field.value = items.map((i) => `${i.name} | ${i.qty} | ${i.unit} | ${i.cost} | ${i.sale}`).join("\n");
      target.innerHTML = `<div class="result"><b>✓ Məhsullar sorğu formasına əlavə edildi.</b><span class="muted">Sorğunu yaratmazdan əvvəl məlumatı yoxlayın.</span></div>`;
    };
  }
  async function readFile() {
    const input = document.querySelector("#excelFile"), file = input?.files?.[0], target = document.querySelector("#excelResult");
    if (!file) return window.toast("Əvvəlcə Excel və ya CSV faylı seçin.");
    target.innerHTML = `<div class="result">Fayl oxunur: ${file.name}...</div>`;
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "xls" && await isLegacyBinaryXls(file)) throw new Error("Bu köhnə binary .xls formatıdır. Excel-də Fərqli yadda saxla → .xlsx və ya .csv seçib yenidən yükləyin.");
      const xlsxLike = ext === "xlsx" || (ext === "xls" && await isZipFile(file));
      const sourceText = !xlsxLike && ["csv", "tsv", "txt", "xls", "html", "htm"].includes(ext) ? await readTextFile(file) : "";
      const rows = ["csv", "tsv", "txt"].includes(ext) ? csvRows(sourceText) : xlsxLike ? await xlsxRows(file) : ["xls", "html", "htm"].includes(ext) ? htmlRows(sourceText) : (() => { throw new Error("Bu fayl formatı oxunmadı. XLSX və ya CSV kimi saxlayın; başlıqlar fərqlidirsə xəritələndirmə istifadə edin."); })();
      if (rows.length <= 1) {
        target.innerHTML = `<div class="result"><b>✓ Boş Excel şablonu oxundu</b><span class="muted">Sütun başlıqları hazırdır. Məhsul sətirlərini əlavə edib faylı yenidən oxudun.</span></div>`;
        return;
      }
      const items = extract(rows); if (!items.length) throw new Error("Uyğun məhsul sətri tapılmadı.");
      const values = rows.flat().map((value) => String(value || "").replace(/\s+/g, " ").trim()).filter(Boolean);
      const customer = values.find((value) => /\b(MMC|LLC|ASC|QSC)\b/i.test(value) && value.length < 90 && !/mallar|tələb olunan|xidmətlər/i.test(value));
      const customerInput = document.querySelector('#requestForm input[name="customer"]');
      const noteInput = document.querySelector('#requestForm textarea[name="note"]');
      if (customer && customerInput && !customerInput.value.trim()) customerInput.value = customer;
      if (noteInput && !noteInput.value.trim()) noteInput.value = `Excel importu: ${file.name}${customer ? ` · ${customer}` : ""}`;
      result(items, file.name);
    } catch (error) {
      if (error.code === "MAPPING_REQUIRED") return showMapping(error.rows, file.name, error.detected);
      target.innerHTML = `<div class="result danger">${escapeHtml(error.message || "Fayl oxuna bilmədi.")}</div>`;
    }
  }
  window.addEventListener("load", () => {
    const previous = window.openRequest;
    window.openRequest = function (prefill = {}) {
      previous(prefill);
      const form = document.querySelector("#requestForm"); if (!form) return;
      const box = document.createElement("div"); box.className = "field full";
      box.innerHTML = `<div class="sample-excel-card" id="sampleExcelCard" style="display:flex;align-items:center;gap:13px;padding:14px 16px;margin:0 0 15px;border:1px solid #cbdcf6;border-radius:13px;background:linear-gradient(135deg,#f0f6ff,#fbfdff);box-shadow:0 5px 14px rgba(36,118,237,.08)"><div class="sample-excel-icon" style="display:grid;place-items:center;flex:0 0 44px;height:44px;border-radius:11px;background:#1f9d68;color:#fff;font-size:11px;font-weight:800;letter-spacing:.04em">CSV</div><div class="sample-excel-copy" style="display:grid;gap:3px;min-width:0"><strong style="color:#172b4d;font-size:13px">📥 Boş Excel numune faylı</strong><span style="color:#6f7f96;font-size:12px;line-height:1.45">Sütun başlıqları hazırdır. Məlumatı hər başlığın altına yazın və sonra bu faylı yükləyin.</span><a id="sampleExcelLink" href="techizat-sorgu-numune.csv?v=excel-semi4" download="techizat-sorgu-numune.csv" style="width:max-content;color:#1767ce;font-size:12px;font-weight:750;text-decoration:none">↧ Numunəni birbaşa endir (CSV)</a></div></div><label>Excel-dən məhsul importu</label><input id="excelFile" type="file" accept=".xlsx,.csv,.tsv,.txt,.xls,.html,.htm"><span class="muted">XLSX və CSV ən stabil formatlardır. Numunə Excel-də sütunlara ayrı düşməsi üçün ; ayırıcısından istifadə edir. Fərqli sütun quruluşu tanınmasa, sütun xəritələndirməsi açılır.</span><div class="import-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px"><button type="button" class="secondary" id="downloadExcelTemplate">↧ Nümunəni endir</button><button type="button" class="secondary" id="readExcel">Excel-dən oxu</button></div><div id="excelResult"></div>`;
      form.querySelector(".field.full")?.before(box);
      const sampleLink = box.querySelector("#sampleExcelLink"), sampleIcon = box.querySelector(".sample-excel-icon"), helper = box.querySelector(".muted");
      if (sampleLink) { sampleLink.href = "techizat-sorgu-numune.xlsx?v=xlsx-safe2"; sampleLink.download = "techizat-sorgu-numune.xlsx"; sampleLink.textContent = "↧ Nümunəni birbaşa endir (XLSX)"; }
      if (sampleIcon) sampleIcon.textContent = "XLSX";
      if (helper) helper.textContent = "Makrosuz XLSX formatıdır. Məhsul məlumatını sütun başlıqlarının altına daxil edin.";
      const readButton = box.querySelector("#readExcel"), downloadButton = box.querySelector("#downloadExcelTemplate");
      if (readButton) readButton.onclick = readFile;
      if (downloadButton) downloadButton.onclick = downloadSample;
    };
  });
})();
