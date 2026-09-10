/* Editable official document workspaces generated from a request's priced items. */
(() => {
  "use strict";
  const VAT = 18;
  const TYPES = {
    INVOICE: { label: "Hesab-faktura", title: "HESAB FAKTURA", short: "HF" },
    DELIVERY_HANDOVER: { label: "Təhvil-təslim aktı", title: "TƏHVİL TƏSLİM AKTI", short: "TT" },
    PRICE_AGREEMENT: { label: "Qiymət razılaşma protokolu", title: "Qiymət razılaşma protokolu", short: "QRP" },
  };
  const TEMPLATES = {
    INVOICE: "templates/HF-yeni.xlsx",
    DELIVERY_HANDOVER: "templates/TT-yeni.xlsx",
    PRICE_AGREEMENT: "templates/QRP-yeni.xlsx",
  };
  // The customer-supplied Excel files are the contract for official documents.
  // Their layout, fixed details, signatures and seals must be kept untouched.
  // Only product names and the buyer field are dynamic.
  const TEMPLATE_LAYOUTS = {
    INVOICE: { itemStart: 19, templateRows: 1, buyerColumn: "F", buyerRow: 14 },
    DELIVERY_HANDOVER: { itemStart: 17, templateRows: 16, buyerColumn: "A", buyerRow: 43 },
    PRICE_AGREEMENT: { itemStart: 17, templateRows: 4, buyerColumn: "A", buyerRow: 26 },
  };
  const AZPLOM = {
    seller: "AZPLOM MMC",
    sellerAddress: "Bakı ş., R. Rüstəmov küç., ev 6",
    sellerPhone: "994 51 687 33 32",
    beneficiary: "AZPLOM MMC",
    taxId: "1605987621",
    account: "AZ39AIIB400600M9440352277211",
    bank: "Kapital Bank ASC",
    bankTaxId: "9900003611",
    bankCode: "201229",
    branch: "Kapital Bank ASC, Neftçilər filialı",
    iban: "AZ37NABZ01350100000000001944",
    swift: "AIIBAZ2XXXX",
  };
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
  const xml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" }[character]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = value => new Intl.NumberFormat("az-AZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number(value));
  const today = () => new Date().toISOString().slice(0, 10);
  // The request pricing table is the single source of truth for every official
  // document. Keeping this mapping in one place prevents an old document
  // draft from exporting an earlier sales price.
  const requestDocumentItems = request => (request.items || []).map(item => ({
    name: item.name || "",
    unit: item.unit || "ədəd",
    quantity: number(item.qty),
    price: number(item.sale),
  }));
  const syncOfficialDocumentItems = request => {
    if (!request?.officeDocuments) return;
    const items = requestDocumentItems(request);
    Object.values(request.officeDocuments).forEach(draft => {
      if (draft && typeof draft === "object") draft.items = structuredClone(items);
    });
  };
  const defaultDocument = (request, type) => ({
    type,
    city: "Bakı şəhəri",
    date: today(),
    number: request.id.replace(/^SR-/, ""),
    title: TYPES[type].title,
    intro: "Aşağıda qeyd olunan malların göndərilməsi haqqında çərçivə müqaviləsinin şərtlərinin əsasında sifariş olunmuşdur.",
    seller: AZPLOM.seller,
    sellerAddress: AZPLOM.sellerAddress,
    sellerPhone: AZPLOM.sellerPhone,
    buyer: request.customer || "",
    buyerAddress: "",
    buyerPhone: "",
    beneficiary: AZPLOM.beneficiary,
    taxId: AZPLOM.taxId,
    account: AZPLOM.account,
    bank: AZPLOM.bank,
    bankTaxId: AZPLOM.bankTaxId,
    bankCode: AZPLOM.bankCode,
    branch: AZPLOM.branch,
    iban: AZPLOM.iban,
    swift: AZPLOM.swift,
    vatRate: VAT,
    items: requestDocumentItems(request),
  });
  const getDraft = (request, type) => {
    const base = defaultDocument(request, type), saved = request.officeDocuments?.[type];
    if (!saved) return structuredClone(base);
    const draft = { ...base, ...saved, items: saved.items?.length ? saved.items : base.items };
    const legacyTitles = {
      INVOICE: ["HESAB-FAKTURA", "HESAB FAKTURA"],
      DELIVERY_HANDOVER: ["TƏHVİL-TƏSLİM AKTI", "TƏHVİL TƏSLİM AKTI"],
      PRICE_AGREEMENT: ["QİYMƏT RAZILAŞMA PROTOKOLU", "Qiymət razılaşma pratokolu"],
    };
    if (legacyTitles[type]?.includes(String(saved.title || "").trim())) draft.title = base.title;
    // Older saved documents may not have had party values. Restore the
    // template defaults so buyer/seller blocks never export empty.
    ["buyer", "seller"].forEach(key => { if (!String(draft[key] ?? "").trim()) draft[key] = base[key]; });
    if (type === "INVOICE") Object.keys(AZPLOM).forEach(key => { if (!String(draft[key] ?? "").trim()) draft[key] = AZPLOM[key]; });
    return structuredClone(draft);
  };
  const saveDraft = (request, draft, notify = true) => {
    request.officeDocuments ||= {};
    request.officeDocuments[draft.type] = structuredClone(draft);
    window.audit?.("DOCUMENT_EDIT", `${request.id}:${draft.type}`);
    window.save?.();
    if (notify) window.toast?.(`${TYPES[draft.type].label} yadda saxlanıldı.`);
  };
  const cell = (field, value, className = "") => `<input class="office-cell ${className}" data-field="${field}" value="${esc(value)}">`;
  const textCell = (field, value, className = "") => `<textarea class="office-cell ${className}" data-field="${field}">${esc(value)}</textarea>`;
  const parties = draft => `<div class="office-parties"><div class="office-party"><b>ALICI</b>${cell("buyer", draft.buyer)}<label class="office-field-label">İmza</label><div>____________________________</div><div class="office-stamp-label">M.Y.</div></div><div class="office-party"><b>SATICI</b>${cell("seller", draft.seller)}<label class="office-field-label">İmza</label><div>____________________________</div><div class="office-stamp-label">M.Y.</div></div></div>`;

  function style() {
    if (document.querySelector("#official-document-styles")) return;
    const css = document.createElement("style"); css.id = "official-document-styles";
    css.textContent = `.office-doc-top{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:14px 0 18px}.office-doc-tabs{display:flex;gap:7px;flex-wrap:wrap}.office-doc-tab{border:1px solid #d7e1ee;border-radius:10px;background:#fff;color:#52647c;padding:9px 11px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}.office-doc-tab.active{background:#173d73;color:#fff;border-color:#173d73}.office-doc-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.office-sheet-wrap{overflow:auto;padding:24px;background:#e9eff6;border:1px solid #d9e3ee;border-radius:16px}.office-sheet{width:980px;min-height:1080px;margin:auto;padding:54px 56px;background:#fff;box-shadow:0 14px 34px #15274622;color:#132c4b;font-family:Arial,Helvetica,sans-serif}.office-sheet-header{display:grid;grid-template-columns:1fr 180px;align-items:center;gap:16px;font-size:13px;font-weight:700}.office-sheet-title{margin:38px 0 22px;text-align:center;font-size:23px;font-weight:800;letter-spacing:.2px}.office-meta{display:grid;grid-template-columns:92px minmax(0,1fr) 92px minmax(0,1fr);gap:0;border:1px solid #173d73;margin-bottom:17px}.office-meta span{display:flex;align-items:center;padding:8px 9px;border-right:1px solid #d4dfeb;border-bottom:1px solid #d4dfeb;background:#f2f7fc;font-size:11px;font-weight:800}.office-meta .office-cell{border:0;border-right:1px solid #d4dfeb;border-bottom:1px solid #d4dfeb;border-radius:0;box-shadow:none;min-height:37px}.office-intro{width:100%;min-height:62px;margin:8px 0 17px;padding:11px 12px;border:1px solid #cbd8e7;border-radius:8px;background:#fbfdff;color:#314a68;font:12px/1.5 Arial}.office-grid{width:100%;border-collapse:collapse;table-layout:fixed}.office-grid th{padding:10px 7px;border:1px solid #173d73;background:#173d73;color:#fff;font-size:11px;text-align:center}.office-grid td{padding:0;border:1px solid #cbd8e7}.office-grid .office-cell{width:100%;min-height:37px;border:0;border-radius:0;box-shadow:none;padding:8px 7px;background:transparent;font:12px Arial}.office-grid .num{text-align:right}.office-grid .row-control{width:43px;border:0;background:transparent;color:#b64152;font-size:17px;cursor:pointer}.office-add-row{margin-top:10px;border:1px dashed #9dbce1;border-radius:9px;background:#f7fbff;color:#1767ce;padding:8px 11px;font:inherit;font-weight:750;font-size:12px;cursor:pointer}.office-totals{width:310px;margin:18px 0 0 auto;border-collapse:collapse}.office-totals td{padding:9px 10px;border:1px solid #cbd8e7;font-size:12px}.office-totals td:first-child{font-weight:700;background:#f5f8fc}.office-totals td:last-child{text-align:right;font-weight:800}.office-parties{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:46px}.office-party{min-height:160px;border-top:1px solid #607b9c;padding-top:9px;font-size:12px}.office-party b{display:block;margin-bottom:10px}.office-bank{display:grid;grid-template-columns:145px 1fr;gap:0;margin-top:36px;border:1px solid #cbd8e7}.office-bank b{padding:9px;border-right:1px solid #cbd8e7;border-bottom:1px solid #cbd8e7;background:#f5f8fc;font-size:11px}.office-bank .office-cell{border:0;border-bottom:1px solid #cbd8e7;border-radius:0;box-shadow:none;min-height:35px}.office-cell{border:1px solid #cad8e7;border-radius:7px;background:#fff;color:#163451;font:inherit;padding:7px 8px;outline:none}.office-cell:focus{border-color:#4286de;box-shadow:0 0 0 3px #dceaff;background:#fff}.office-cell.area{width:100%;min-height:68px;resize:vertical}.office-field-label{display:block;color:#70829a;font-size:10px;font-weight:750;margin:8px 0 4px}.office-signature{margin-top:45px;font-size:12px}.office-sheet input[type=date]{font-family:inherit}@media(max-width:900px){.office-doc-top{align-items:flex-start;flex-direction:column}.office-doc-actions{justify-content:flex-start}.office-sheet-wrap{margin:0 -10px;border-radius:0;padding:10px}.office-sheet{transform-origin:top left}.office-sheet-header{font-size:12px}}`;
    css.textContent += `
      /* Native document preview: the editable canvas mirrors the supplied
         Excel forms rather than introducing a separate application layout. */
      .office-sheet-wrap{padding:30px;background:#dfe5e9;border:0;border-radius:0;overflow:auto;scrollbar-gutter:stable}
      .office-sheet{position:relative;box-sizing:border-box;width:794px;min-height:1123px;margin:0 auto;padding:38px 42px 54px;background:#fff;color:#050505;font-family:Calibri,Arial,sans-serif;box-shadow:0 1px 5px #1a273033}
      .office-template-brand{position:absolute;top:27px;right:48px;width:104px;height:104px;display:flex;align-items:center;justify-content:center}
      .office-template-brand img{width:100%;height:100%;object-fit:contain}
      .office-sheet-header{display:grid;grid-template-columns:1fr 148px;gap:0;align-items:end;margin-top:108px;font:700 11px Calibri,Arial,sans-serif}
      .office-sheet-header .office-cell{height:22px;min-height:0;padding:1px 3px;border:0;border-bottom:1px solid transparent;border-radius:0;background:transparent;color:#050505;font:700 11px Calibri,Arial,sans-serif}
      .office-sheet-header .office-cell:last-child{text-align:center}
      .office-sheet-title{display:block;box-sizing:border-box;width:100%;height:38px;margin:28px 0 14px;padding:4px;border:0!important;border-bottom:0!important;border-radius:0!important;background:transparent;color:#050505;text-align:center;font:800 18px/30px Calibri,Arial,sans-serif;letter-spacing:0;box-shadow:none!important}
      .office-title-number{display:inline-block;margin:-45px 0 0 4px;vertical-align:middle;font:800 18px/30px Calibri,Arial,sans-serif}
      .office-meta{grid-template-columns:76px minmax(0,1.7fr) 76px minmax(0,1.35fr);margin:0 0 38px;border:1px solid #060606;background:#fff}
      .office-meta span{min-height:21px;padding:1px 4px;border-color:#060606;background:#fff;color:#050505;font:800 10px/19px Calibri,Arial,sans-serif}
      .office-meta .office-cell{min-height:21px;padding:1px 4px;border-color:#060606;border-radius:0;background:#fff;color:#050505;font:11px/19px Calibri,Arial,sans-serif}
      .office-intro{box-sizing:border-box;width:100%;height:43px;min-height:43px;margin:-2px 0 13px;padding:7px 4px;border:0;border-radius:0;background:transparent;color:#050505;resize:none;font:700 11px/15px Calibri,Arial,sans-serif}
      .office-grid{border-collapse:collapse;table-layout:fixed;border:1px solid #060606}
      .office-grid th{height:31px;padding:2px 4px;border:1px solid #060606;background:#fff;color:#050505;font:800 11px/13px Calibri,Arial,sans-serif}
      .office-grid td{height:29px;border:1px solid #060606;background:#fff}
      .office-grid .office-cell{box-sizing:border-box;width:100%;height:28px;min-height:0;padding:2px 4px;border:0;border-radius:0;background:transparent;color:#050505;font:700 11px/18px Calibri,Arial,sans-serif;box-shadow:none}
      .office-grid .num,.office-grid .office-line-total{text-align:center;font:700 11px/18px Calibri,Arial,sans-serif;color:#050505}
      .office-grid td:nth-child(2) .office-cell,.office-grid td:nth-child(3) .office-cell{text-align:center}
      .office-grid th:last-child,.office-grid td:last-child{display:none}
      .office-grid th:nth-child(1){width:40px!important}.office-grid th:nth-child(3){width:94px!important}.office-grid th:nth-child(4){width:80px!important}.office-grid th:nth-child(5){width:98px!important}.office-grid th:nth-child(6){width:106px!important}
      .office-add-row{margin:9px 0 0;padding:6px 9px;border:1px dashed #7b8791;border-radius:3px;background:#fff;color:#26384d;font:700 11px Calibri,Arial,sans-serif}
      #officeRemoveRow{margin-left:6px}
      .office-add-row:hover{background:#edf3f8}.office-add-row:focus-visible,.office-doc-tab:focus-visible,.office-doc-actions button:focus-visible,.row-control:focus-visible{outline:3px solid #67aee0;outline-offset:2px}
      .office-totals{width:185px;margin:0 0 0 auto;border:0;border-collapse:collapse}
      .office-totals td{height:21px;padding:1px 5px;border:1px solid #060606;background:#fff;color:#050505;font:700 11px/18px Calibri,Arial,sans-serif}
      .office-totals td:first-child{width:91px;background:#fff;text-align:center}.office-totals td:last-child{text-align:center;font-weight:800}.office-totals tr:last-child td{font-weight:800}
      .office-totals .office-cell{width:28px;padding:0;border:0;border-radius:0;background:transparent;font:inherit;text-align:center;box-shadow:none}
      .office-bank{grid-template-columns:158px 1fr;width:548px;margin-top:42px;border:1px solid #060606}
      .office-bank b{height:20px;padding:1px 5px;border-color:#060606;background:#fff;color:#050505;text-align:center;font:11px/18px Calibri,Arial,sans-serif}
      .office-bank .office-cell{height:20px;min-height:0;padding:1px 5px;border-color:#060606;border-radius:0;background:#fff;color:#050505;text-align:center;font:11px/18px Calibri,Arial,sans-serif}
      .office-signature{display:flex;align-items:flex-end;justify-content:center;gap:8px;min-height:135px;margin-top:18px;color:#050505;font:800 10px Calibri,Arial,sans-serif}
      .office-signature img{width:112px;height:112px;object-fit:contain}.office-signature .office-sign-image{width:102px;height:68px;object-fit:contain}
      .office-parties{grid-template-columns:1fr 1fr;gap:25px;margin-top:52px}.office-party,.office-seller-signature{position:relative;min-height:128px;padding:7px 9px;border:1px solid #060606;color:#050505;font:11px Calibri,Arial,sans-serif}.office-party b,.office-seller-signature b{display:block;margin-bottom:9px;text-align:center;font-size:12px}.office-party .office-cell,.office-seller-signature .office-cell{width:100%;min-height:32px;padding:2px 3px;border:0;border-radius:0;border-bottom:1px solid #060606;background:transparent;color:#050505;font:11px Calibri,Arial,sans-serif;box-shadow:none}.office-party .office-field-label,.office-seller-signature .office-field-label{margin:19px 0 3px;color:#050505;font:700 10px Calibri,Arial,sans-serif}.office-stamp-label{margin-top:13px;font:700 10px Calibri,Arial,sans-serif}.office-seller-signature{width:calc(50% - 12px);margin:52px 0 0 auto}.office-party .office-party-stamp,.office-seller-signature .office-party-stamp{position:absolute;right:2px;bottom:-33px;width:100px;height:100px;object-fit:contain}.office-party .office-party-sign,.office-seller-signature .office-party-sign{position:absolute;right:66px;bottom:13px;width:94px;height:58px;object-fit:contain}
      .office-template-DELIVERY_HANDOVER .office-sheet-title,.office-template-PRICE_AGREEMENT .office-sheet-title{margin-top:18px;margin-bottom:7px;font-size:14px;line-height:26px}.office-template-DELIVERY_HANDOVER .office-title-number,.office-template-PRICE_AGREEMENT .office-title-number{margin-top:-39px;font-size:14px;line-height:26px}.office-template-DELIVERY_HANDOVER .office-meta,.office-template-PRICE_AGREEMENT .office-meta{display:none}.office-template-DELIVERY_HANDOVER .office-grid,.office-template-PRICE_AGREEMENT .office-grid{margin-top:8px}.office-template-DELIVERY_HANDOVER .office-totals,.office-template-PRICE_AGREEMENT .office-totals{width:185px}
      .office-cell:focus{outline:2px solid #4b9cda;outline-offset:-2px;background:#fffde8;box-shadow:none!important}.office-cell.area:focus{box-shadow:none!important}
      @media(max-width:900px){.office-sheet-wrap{margin:0 -10px;padding:12px}.office-sheet{transform:none;min-width:794px}.office-doc-top{padding:0 4px}.office-template-brand{right:48px}}
      @media(prefers-reduced-motion:reduce){.office-cell,.office-doc-tab,.office-add-row{transition:none!important}}
    `;
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
    if (!document.querySelector("#official-document-brand-styles")) {
      const brandStyles = document.createElement("style"); brandStyles.id = "official-document-brand-styles";
      brandStyles.textContent = "";
      document.head.append(brandStyles);
    }
    const draft = getDraft(request, type), info = TYPES[type], sum = totals(draft);
    page = "official-document";
    window.__officialDocumentType = type;
    document.querySelector("#root").innerHTML = `<div class="content"><div class="head"><div><button class="secondary" id="officeBack">← Sorğuya qayıt</button><div class="eyebrow" style="margin-top:16px">RƏSMİ SƏNƏD REDAKTORU</div><h1>${info.label}</h1><p>Excel görünüşündə məlumatları dəyişin, sonra sənədi .xlsx formatında endirin.</p></div></div><div class="office-doc-top"><div class="office-doc-tabs">${Object.entries(TYPES).map(([key, item]) => `<button type="button" class="office-doc-tab ${key === type ? "active" : ""}" data-document-type="${key}">${item.label}</button>`).join("")}</div><div class="office-doc-actions"><button type="button" class="secondary" id="officeSave">Yadda saxla</button><button type="button" class="primary" id="officeDownload">↧ Excel endir</button></div></div><div class="office-sheet-wrap"><section class="office-sheet" id="officeSheet"><div class="office-sheet-header"><input class="office-cell" data-field="city" value="${esc(draft.city)}"><input class="office-cell" data-field="date" type="date" value="${esc(draft.date)}"></div><input class="office-cell office-sheet-title" data-field="title" value="${esc(draft.title)}"><div class="office-meta"><span>${type === "INVOICE" ? "SATICI" : "Sənəd №"}</span>${type === "INVOICE" ? cell("seller", draft.seller) : cell("number", draft.number)}<span>${type === "INVOICE" ? "ALICI" : "Tarix"}</span>${type === "INVOICE" ? cell("buyer", draft.buyer) : cell("date", draft.date)}<span>${type === "INVOICE" ? "ÜNVAN" : "ALICI"}</span>${type === "INVOICE" ? cell("sellerAddress", draft.sellerAddress) : cell("buyer", draft.buyer)}<span>${type === "INVOICE" ? "ÜNVAN" : "SATICI"}</span>${type === "INVOICE" ? cell("buyerAddress", draft.buyerAddress) : cell("seller", draft.seller)}<span>${type === "INVOICE" ? "ƏLAQƏ" : "Qeyd"}</span>${type === "INVOICE" ? cell("sellerPhone", draft.sellerPhone) : cell("number", draft.number)}<span>${type === "INVOICE" ? "ƏLAQƏ" : ""}</span>${type === "INVOICE" ? cell("buyerPhone", draft.buyerPhone) : cell("vatRate", draft.vatRate)}</div>${type === "INVOICE" ? "" : textCell("intro", draft.intro, "office-intro")}<table class="office-grid"><thead><tr><th style="width:42px">№</th><th>Malın (iş,xidmət) adı</th><th style="width:104px">Ölçü vahidi</th><th style="width:94px">Miqdarı</th><th style="width:128px">Vahidin qiyməti</th><th style="width:132px">Ümumi dəyəri</th><th style="width:42px"></th></tr></thead><tbody id="officeItems">${itemRows(draft)}</tbody></table><button type="button" class="office-add-row" id="officeAddRow">＋ Sətir əlavə et</button><table class="office-totals"><tbody><tr><td>Cəm</td><td id="officeSubtotal">${money(sum.subtotal)}</td></tr><tr><td>ƏDV (<input class="office-cell" style="width:44px;padding:2px 4px" data-field="vatRate" type="number" min="0" step="0.01" value="${number(draft.vatRate)}">%)</td><td id="officeVat">${money(sum.vat)}</td></tr><tr><td>Yekun</td><td id="officeTotal">${money(sum.total)}</td></tr></tbody></table>${type === "INVOICE" ? `<div class="office-bank"><b>BENEFICIARY</b>${cell("beneficiary", draft.beneficiary)}<b>Company Tax ID</b>${cell("taxId", draft.taxId)}<b>ACCOUNT NUMBER</b>${cell("account", draft.account)}<b>BANK NAME</b>${cell("bank", draft.bank)}<b>Bank Tax ID</b>${cell("bankTaxId", draft.bankTaxId)}<b>Bank Code</b>${cell("bankCode", draft.bankCode)}<b>IBAN NUMBER</b>${cell("iban", draft.iban)}<b>SWIFT CODE</b>${cell("swift", draft.swift)}</div>` : ""}${parties(draft)}</section></div></div>`;
    const sheet = document.querySelector("#officeSheet");
    sheet.classList.add(`office-template-${type}`);
    const logo = document.createElement("div"); logo.className = "office-template-brand"; logo.innerHTML = '<img src="assets/azplom-logo.jpeg" alt="AzPlom loqosu">'; sheet.prepend(logo);
    document.querySelector("#officeAddRow")?.insertAdjacentHTML("afterend", '<button type="button" class="office-add-row" id="officeRemoveRow">Son sətiri sil</button>');
    if (type === "INVOICE") {
      const bank = sheet.querySelector(".office-bank");
      bank?.insertAdjacentHTML("beforeend", `<b>BRANCH</b>${cell("branch", draft.branch)}`);
    }
    if (type !== "INVOICE") {
      const title = sheet.querySelector(".office-sheet-title");
      if (title) title.value = `${draft.title} №${draft.number}`;
    }
    const sellerSignature = sheet.querySelector(".office-party:last-child");
    sellerSignature?.insertAdjacentHTML("beforeend", '<img class="office-party-sign" src="assets/azplom-signature.png" alt="AzPlom imzası"><img class="office-party-stamp" src="assets/azplom-stamp.png" alt="AzPlom möhürü">');
    bindEditor(request, type);
  }

  function readEditor(type) {
    const draft = { type, items: [] };
    document.querySelectorAll("#officeSheet [data-field]").forEach(input => { draft[input.dataset.field] = input.value; });
    document.querySelectorAll("#officeItems tr").forEach(row => {
      draft.items.push({ name: row.querySelector('[data-item="name"]')?.value.trim() || "", unit: row.querySelector('[data-item="unit"]')?.value.trim() || "ədəd", quantity: number(row.querySelector('[data-item="quantity"]')?.value), price: number(row.querySelector('[data-item="price"]')?.value) });
    });
    if (type !== "INVOICE") draft.title = String(draft.title || "").replace(/\s*№\s*[^№]*$/, "").trim();
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
    document.querySelector("#officeDownload").onclick = async () => { const draft = readEditor(type); saveDraft(request, draft, false); try { await downloadXlsx(draft, request.id); } catch (error) { window.toast?.(error.message || "Excel faylı hazırlana bilmədi."); } };
    document.querySelector("#officeAddRow").onclick = () => { const draft = readEditor(type); draft.items.push({ name: "", unit: "ədəd", quantity: 0, price: 0 }); renderEditor(request, type); };
    document.querySelector("#officeRemoveRow").onclick = () => { const draft = readEditor(type); if (draft.items.length > 1) { draft.items.pop(); renderEditor(request, type); } else window.toast?.("Sənəddə ən azı bir məhsul sətiri qalmalıdır."); };
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
    const expression = new RegExp(`<c\\b([^>]*\\br="${reference}"[^>]*?)(?:\\s*\\/\\s*>|>([\\s\\S]*?)<\\/c>)`);
    return sheet.replace(expression, (_, attributes) => {
      const cleaned = attributes.replace(/\s+t="[^"]*"/g, "").replace(/\s*\/\s*$/, "");
      return numeric
        ? `<c${cleaned}><v>${value === "" ? "" : number(value)}</v></c>`
        : `<c${cleaned} t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    });
  };
  const shiftReferences = (value, startRow, amount) => value.replace(/([A-Z]+)(\d+)/g, (_, column, rawRow) => `${column}${Number(rawRow) >= startRow ? Number(rawRow) + amount : rawRow}`);
  const shiftRowNumbers = (value, startRow, amount) => value.replace(/(<row\b[^>]*\br=")(\d+)(")/g, (_, before, rawRow, after) => `${before}${Number(rawRow) >= startRow ? Number(rawRow) + amount : rawRow}${after}`);
  const expandTemplateRows = (sheet, firstRow, templateRows, extraRows) => {
    if (!extraRows) return sheet;
    const lastTemplateRow = firstRow + templateRows - 1, nextRow = lastTemplateRow + 1;
    const source = sheet.match(new RegExp(`<row r="${lastTemplateRow}"[\\s\\S]*?<\\/row>`));
    if (!source) return sheet;
    // Keep every existing formula, merge and lower signature/bank block in the
    // original template, then clone its final styled product row as needed.
    sheet = shiftRowNumbers(shiftReferences(sheet, nextRow, extraRows), nextRow, extraRows);
    const clones = Array.from({ length: extraRows }, (_, index) => {
      const row = lastTemplateRow + index + 1;
      return shiftReferences(source[0], lastTemplateRow, index + 1).replace(`<row r="${lastTemplateRow}"`, `<row r="${row}"`);
    }).join("");
    sheet = sheet.replace(source[0], `${source[0]}${clones}`);
    const merge = `B${lastTemplateRow}:C${lastTemplateRow}`;
    const extraMerges = Array.from({ length: extraRows }, (_, index) => `<mergeCell ref="B${nextRow + index}:C${nextRow + index}"/>`).join("");
    sheet = sheet.replace(/<mergeCells count="(\d+)">/, (_, count) => `<mergeCells count="${Number(count) + extraRows}">`);
    sheet = sheet.replace(`<mergeCell ref="${merge}"/>`, `<mergeCell ref="${merge}"/>${extraMerges}`);
    return sheet;
  };
  // The supplied templates keep the logo, signature and seal as native Excel
  // drawing objects.  When product rows are added, move only the drawings
  // below the product table so the signature area retains the template layout.
  const shiftDrawingRows = (drawing, firstShiftedRow, amount) => {
    if (!amount) return drawing;
    const firstShiftedIndex = firstShiftedRow - 1;
    return drawing.replace(/(<xdr:(?:from|to)>[\s\S]*?<xdr:row>)(\d+)(<\/xdr:row>)/g, (_, before, rawRow, after) => {
      const row = Number(rawRow);
      return `${before}${row >= firstShiftedIndex ? row + amount : row}${after}`;
    });
  };
  async function downloadXlsx(draft, requestId) {
    if (!window.JSZip) throw new Error("Excel şablonu hələ yüklənməyib. Səhifəni yeniləyib yenidən cəhd edin.");
    const response = await fetch(TEMPLATES[draft.type], { cache: "no-store" });
    if (!response.ok) { window.toast?.("Excel şablonu yüklənmədi."); return; }
    const workbook = await window.JSZip.loadAsync(await response.arrayBuffer());
    const sheetFile = workbook.file("xl/worksheets/sheet1.xml");
    if (!sheetFile) { window.toast?.("Excel şablonunda əsas səhifə tapılmadı."); return; }
    const layout = TEMPLATE_LAYOUTS[draft.type], itemStart = layout.itemStart;
    const lineCount = Math.max(layout.templateRows, draft.items.length), extraRows = lineCount - layout.templateRows;
    let sheet = expandTemplateRows(await sheetFile.async("string"), itemStart, layout.templateRows, extraRows);
    const text = (cell, value) => { sheet = replaceCell(sheet, cell, value); };
    const buyerCell = `${layout.buyerColumn}${layout.buyerRow + extraRows}`;
    text(buyerCell, draft.buyer);
    for (let index = 0; index < lineCount; index += 1) {
      const item = draft.items[index], row = itemStart + index;
      text(`B${row}`, item?.name || "");
    }
    workbook.file("xl/worksheets/sheet1.xml", sheet);
    if (extraRows) {
      const firstLowerRow = itemStart + layout.templateRows;
      await Promise.all(Object.keys(workbook.files)
        .filter(name => /^xl\/drawings\/drawing\d+\.xml$/.test(name))
        .map(async name => {
          const drawing = await workbook.file(name).async("string");
          const shifted = shiftDrawingRows(drawing, firstLowerRow, extraRows);
          workbook.file(name, shifted);
        }));
    }
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
    window.syncOfficialDocumentItems = syncOfficialDocumentItems;
    const root = document.querySelector("#root");
    if (!root || root.dataset.officialDocumentObserver) return;
    root.dataset.officialDocumentObserver = "1";
    new MutationObserver(addLauncher).observe(root, { childList: true, subtree: true });
    setTimeout(addLauncher, 0);
  });
})();
