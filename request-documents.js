/* Required document checklist and request-folder filtering. */
(() => {
  const required = [
    { type: "DELIVERY_HANDOVER", title: "Təhvil-təslim sənədi", hint: "İmzalanmış təhvil-təslim aktı" },
    { type: "PRICE_AGREEMENT", title: "Qiymət razılaşma protokolu", hint: "Təsdiqlənmiş qiymət razılaşması" },
    { type: "INVOICE", title: "Hesab-faktura", hint: "Gedən hesab-faktura" },
  ];
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (x) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[x]));
  const statusOptions = [
    ["ALL", "Bütün statuslar"],
    ["NEW", "Yeni"],
    ["PRICING", "Qiymət hazırlanır"],
    ["QUOTATION_SENT", "Təklif göndərilib"],
    ["ACTIVE", "Aktiv"],
  ];
  let statusFilter = "ALL";
  let folderMode = "MAIN";
  function sessionUsername() {
    try { return JSON.parse(sessionStorage.getItem("erp-auth-session") || "null")?.username || "İstifadəçi"; } catch { return "İstifadəçi"; }
  }
  const documentHydration = new Map();
  const documentSignature = documents => (documents || []).map(item => `${item.type}:${item.documentId || ""}:${item.filename || ""}:${item.uploadedAt || ""}`).sort().join("|");
  const activeRequestId = () => document.querySelector("#root .content h1")?.textContent?.trim() || "";
  async function hydrateRequestDocuments(request) {
    if (!request?.id || documentHydration.has(request.id)) return documentHydration.get(request.id) || false;
    let session; try { session = JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch {}
    if (!session?.token) return false;
    const task = fetch(`api/request-document.php?requestId=${encodeURIComponent(request.id)}`, { headers: { Authorization: `Bearer ${session.token}` }, cache: "no-store" })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(payload?.documents)) return false;
        const changed = documentSignature(request.documents) !== documentSignature(payload.documents);
        request.documents = payload.documents;
        return changed;
      })
      .catch(() => false)
      .finally(() => documentHydration.delete(request.id));
    documentHydration.set(request.id, task);
    return task;
  }
  function softDeleteRequest(request) {
    let records = [];
    try { records = db.requests || []; } catch { return false; }
    const index = records.findIndex((item) => item.id === request?.id);
    if (index < 0) return false;
    const hasFinancialLink = (db.sales || []).some((item) => item.request === request.id) || (db.purchases || []).some((item) => item.request === request.id);
    const warning = hasFinancialLink
      ? "Bu sorğuya bağlı maliyyə əməliyyatları var. Sorğu əsas siyahıdan çıxarılacaq, lakin audit və əlaqəli qeydlər qorunacaq. Davam edilsin?"
      : "Bu sorğu əsas siyahıdan silinsin? Audit tarixçəsi üçün arxiv nüsxəsi qorunacaq.";
    if (!confirm(warning)) return false;
    db.deletedRequests ||= [];
    db.deletedRequests.unshift({ ...structuredClone(request), deletedAt: new Date().toISOString(), deletedBy: sessionUsername(), deletionType: "SOFT_DELETE" });
    records.splice(index, 1);
    audit("DELETE", request.id);
    save();
    if (location.hash.startsWith("#request=")) history.replaceState({}, "", location.pathname + location.search);
    page = "requests";
    render();
    toast(`${request.id} silindi; audit arxivində qorunur`);
    return true;
  }
  window.softDeleteRequest = softDeleteRequest;
  const styles = () => { if (document.querySelector("#required-document-styles")) return; const style = document.createElement("style"); style.id = "required-document-styles"; style.textContent = ".documents-panel{margin-top:16px}.documents-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.document-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}.document-card{border:1px solid #e3e9f2;border-radius:12px;padding:14px;background:#fbfcfe}.document-card.ready{border-color:#bfe8d2;background:#f5fcf8}.document-card b{display:block;font-size:13px}.document-card small{display:block;color:#8491a6;margin:5px 0 12px;min-height:30px}.document-card input{display:none}.document-card label{display:inline-block;cursor:pointer;color:#1767ce;font-size:12px;font-weight:650}.document-card .file-name{display:block;color:#16845d;font-size:11px;margin-top:9px;overflow-wrap:anywhere}.doc-progress{margin-top:13px;padding:11px;border-radius:10px;background:#f3f7fc;color:#526078;font-size:12px}.doc-progress strong{color:#1767ce}.doc-count{display:inline-block;min-width:40px;padding:5px 9px;border:1px solid #e4eaf3;border-radius:999px;background:#f5f7fb;color:#748198;font-size:12px;font-weight:750;text-align:center;line-height:1}.doc-count.partial{border-color:#f3d79d;background:#fff8e9;color:#a46b0a}.doc-count.complete{border-color:#bfe8d2;background:#e7f8ef;color:#157752}.request-status-filter{min-width:175px;border:1px solid #dce3ed;border-radius:10px;padding:10px 12px;background:#fff;color:#536179;font:inherit}.request-parent{display:flex!important;align-items:center;justify-content:space-between}.request-parent::after{content:'⌄';font-size:15px;line-height:1;transition:transform .2s ease}.request-parent.collapsed::after{transform:rotate(-90deg)}.request-folder-group{display:grid;gap:2px;max-height:180px;overflow:hidden;opacity:1;transition:max-height .22s ease,opacity .18s ease}.request-folder-group.collapsed{max-height:0;opacity:0;pointer-events:none}.request-folder{display:flex!important;align-items:center;justify-content:space-between;gap:8px;padding-left:25px!important;font-size:12px!important;color:#7a6a96!important}.request-folder-count{min-width:18px;text-align:center;font-variant-numeric:tabular-nums}.request-folder:hover,.request-folder.active{background:#f4effd!important;color:#713fbc!important}.request-folder-button.active{background:#f4effd;color:#713fbc;border-color:#d7c4f3}.danger-action{margin-left:8px;padding:7px 10px;border:1px solid #f0c4cc;border-radius:8px;background:#fff4f5;color:#bd3045;font:inherit;font-size:12px;font-weight:650;cursor:pointer}.danger-action:hover{background:#ffe9ec}.request-filter-empty td{text-align:center!important;color:#8794a7!important;padding:30px 12px!important}@media(max-width:760px){.document-grid{grid-template-columns:1fr}.doc-count{min-width:42px}.request-status-filter{min-width:145px}}"; document.head.appendChild(style); };
  function documentCount(request) {
    const done = Math.min(required.length, (request.documents || []).filter((item) => required.some((doc) => doc.type === item.type)).length);
    const state = done === required.length ? "complete" : done ? "partial" : "empty";
    return `<span class="doc-count ${state}" title="${done} sənəd hazırdır, ${required.length - done} sənəd çatışmır" aria-label="${required.length} sənəddən ${done} hazırdır">${required.length}/${done}</span>`;
  }
  function requestTableStyles() {
    if (document.querySelector("#request-table-select-styles")) return;
    const style = document.createElement("style"); style.id = "request-table-select-styles";
    style.textContent = `.tbl td:last-child select:not(#requestStatusFilter){appearance:none;min-width:154px;max-width:190px;height:36px;padding:8px 32px 8px 11px;border:1px solid #d7e1ed;border-radius:10px;background-color:#fff;background-image:linear-gradient(45deg,transparent 50%,#8391a5 50%),linear-gradient(135deg,#8391a5 50%,transparent 50%);background-position:calc(100% - 15px) 15px,calc(100% - 10px) 15px;background-size:5px 5px;background-repeat:no-repeat;color:#4b5c74;font:inherit;font-size:12px;font-weight:650;box-shadow:0 2px 6px rgba(20,33,58,.05);cursor:pointer;transition:border-color .16s ease,box-shadow .16s ease,background-color .16s ease}.tbl td:last-child select:not(#requestStatusFilter):hover{border-color:#9eb9df;background-color:#fbfdff}.tbl td:last-child select:not(#requestStatusFilter):focus{outline:none;border-color:#4f8eea;box-shadow:0 0 0 3px rgba(79,142,234,.14)}.tbl td:last-child select[data-request-status="NEW"]{border-color:#f1d9a4;background-color:#fffaf0;color:#9b690a}.tbl td:last-child select[data-request-status="PRICING"]{border-color:#d9c9f2;background-color:#fbf9ff;color:#7040bd}.tbl td:last-child select[data-request-status="QUOTATION_SENT"]{border-color:#c2daf8;background-color:#f6faff;color:#2469b7}.tbl td:last-child select[data-request-status="WAITING_CUSTOMER"]{border-color:#f1d9a4;background-color:#fffaf0;color:#9b690a}.tbl td:last-child select[data-request-status="ACTIVE"]{border-color:#bfe5d2;background-color:#f5fcf8;color:#167752}.tbl td:last-child select[data-request-status="COMPLETED"]{border-color:#bfe5d2;background-color:#f5fcf8;color:#167752}.tbl td:last-child select[data-request-status="REJECTED"]{border-color:#f0c4cc;background-color:#fff5f6;color:#bd3045}@media(max-width:760px){.tbl td:last-child select:not(#requestStatusFilter){min-width:132px;max-width:100%;height:34px;padding-left:9px;padding-right:29px}}`;
    document.head.appendChild(style);
  }
  function enhanceRequestList() {
    const table = [...document.querySelectorAll("table.tbl")].find((candidate) => [...candidate.querySelectorAll("thead th")].some((cell) => cell.textContent.trim().toLocaleUpperCase("az-AZ") === "SORĞU"));
    if (!table) return;
    const headerRow = table.querySelector("thead tr");
    if (!headerRow) return;
    styles(); requestTableStyles();
    let header = headerRow.querySelector("th[data-request-documents]");
    if (!header) { header = document.createElement("th"); header.dataset.requestDocuments = "1"; header.textContent = "SƏNƏDLƏR"; headerRow.insertBefore(header, headerRow.lastElementChild); }
    const toolbar = document.querySelector(".toolbar");
    toolbar?.querySelectorAll("#rejectedFolderButton,#salesFolderButton,#waitingCustomerFolderButton").forEach((button) => button.remove());
    if (toolbar && !toolbar.querySelector("#requestStatusFilter")) {
      const select = document.createElement("select");
      select.id = "requestStatusFilter";
      select.className = "request-status-filter";
      select.setAttribute("aria-label", "Sorğuları statusa görə filtrlə");
      select.innerHTML = statusOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
      select.value = statusFilter;
      select.onchange = () => { statusFilter = select.value; enhanceRequestList(); };
      const exportButton = toolbar.querySelector("button");
      if (exportButton) toolbar.insertBefore(select, exportButton); else toolbar.append(select);
    }
    const statusSelect = toolbar?.querySelector("#requestStatusFilter");
    if (statusSelect && statusSelect.value !== statusFilter) statusSelect.value = statusFilter;
    document.querySelector("#rejectedFolderNav")?.classList.toggle("active", folderMode === "REJECTED");
    document.querySelector("#salesFolderNav")?.classList.toggle("active", folderMode === "COMPLETED");
    document.querySelector("#waitingCustomerFolderNav")?.classList.toggle("active", folderMode === "WAITING_CUSTOMER");
    let records = [];
    try { records = db.requests || []; } catch { records = []; }
    const completedCount = records.filter((request) => request.status === "COMPLETED").length;
    const salesFolder = document.querySelector("#salesFolderNav");
    if (salesFolder) salesFolder.innerHTML = `↳ Satışlar <span class="request-folder-count" aria-label="${completedCount} tamamlanmış sorğu">${completedCount || ""}</span>`;
    const pageHeading = document.querySelector("#root .head h1");
    const pageDescription = pageHeading?.nextElementSibling;
    if (pageHeading) {
      const isSales = folderMode === "COMPLETED";
      pageHeading.textContent = isSales ? "Satışlar" : "Bütün sorğular";
      if (pageDescription?.tagName === "P") pageDescription.textContent = isSales
        ? "Tamamlanan sorğular satış mərhələsində izlənir."
        : "Qiymət, təklif və sifariş proseslərini buradan izləyin.";
      document.title = `${isSales ? "Satışlar" : "Sorğular"} — AzPlom`;
    }
    const rows = [...table.querySelectorAll("tbody tr")].filter((row) => !row.classList.contains("request-filter-empty"));
    let visibleRows = 0;
    rows.forEach((row) => {
      const link = row.querySelector(".link");
      if (!link) return;
      const request = records.find((item) => item.id === link.textContent.trim());
      if (!request) return;
      let cell = row.querySelector("td[data-request-documents]");
      if (!cell) { cell = document.createElement("td"); cell.dataset.requestDocuments = "1"; row.insertBefore(cell, row.lastElementChild); }
      const markup = documentCount(request);
      if (cell.innerHTML !== markup) cell.innerHTML = markup;
      const matches = folderMode === "REJECTED"
        ? request.status === "REJECTED"
        : folderMode === "COMPLETED"
          ? request.status === "COMPLETED"
          : folderMode === "WAITING_CUSTOMER"
            ? request.status === "WAITING_CUSTOMER"
          : request.status !== "REJECTED" && request.status !== "COMPLETED" && request.status !== "WAITING_CUSTOMER" && (statusFilter === "ALL" || request.status === statusFilter);
      row.hidden = !matches;
      row.dataset.requestStatus = request.status;
      const actionCell = row.lastElementChild;
      const rowStatusSelect = actionCell?.querySelector("select");
      if (rowStatusSelect) rowStatusSelect.dataset.requestStatus = request.status;
      if (matches) visibleRows += 1;
      if (actionCell && !actionCell.querySelector(".delete-request")) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "danger-action delete-request";
        button.textContent = "Sil";
        button.title = "Sorğunu sil";
        button.onclick = () => softDeleteRequest(request);
        actionCell.append(button);
      }
    });
    const tbody = table.querySelector("tbody");
    if (tbody) {
      let empty = tbody.querySelector(".request-filter-empty");
      if ((folderMode !== "MAIN" || statusFilter !== "ALL") && rows.length && visibleRows === 0) {
        if (!empty) { empty = document.createElement("tr"); empty.className = "request-filter-empty"; empty.innerHTML = `<td colspan="8">Bu bölmədə sorğu yoxdur.</td>`; tbody.append(empty); }
      } else if (empty) empty.remove();
    }
  }
  function addPanel(request) {
    styles();
    void hydrateRequestDocuments(request).then(changed => {
      if (!changed || activeRequestId() !== request.id) return;
      if (document.querySelector(".documents-panel.document-upload-busy")) return;
      document.querySelector(".documents-panel")?.remove();
      addPanel(request);
    });
    const mainPanel = document.querySelector(".detail-prices")?.closest(".panel"); if (!mainPanel || document.querySelector(".documents-panel")) return;
    request.documents ||= [];
    const panel = document.createElement("section"); panel.className = "panel documents-panel"; panel.innerHTML = `<div class="documents-head"><div><h2>Sənədlər</h2><p>Bu sorğu üzrə sənədləri istənilən statusda əlavə edə, dəyişə və silə bilərsiniz.</p></div><span class="badge">3 sənəd tələb olunur</span></div><div class="document-grid">${required.map((doc) => { const saved = request.documents.find((item) => item.type === doc.type); return `<div class="document-card ${saved ? "ready" : ""}" data-doc-card="${doc.type}"><b>${doc.title}</b><small>${doc.hint}</small><input id="doc-${doc.type}" class="required-document" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" data-doc-type="${doc.type}">${saved ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label for="doc-${doc.type}">↻ Dəyiş</label><button type="button" class="document-remove" data-doc-type="${doc.type}" style="border:1px solid #f2c8d0;background:#fff7f8;color:#c23b51;border-radius:8px;padding:6px 9px;font:inherit;font-size:12px;font-weight:700;cursor:pointer">Sil</button></div><span class="file-name">✓ ${esc(saved.filename)}</span>` : `<label for="doc-${doc.type}">＋ Sənəd əlavə et</label><span class="muted">PDF, Word, Excel və şəkil</span>`}</div>`; }).join("")}</div><div class="doc-progress"><strong>${request.documents.length}/3</strong> sənəd əlavə olunub. ${request.documents.length === 3 ? "Sorğu tamamlanmağa hazırdır." : "Çatışmayan sənədləri əlavə edin."}</div>`;
    mainPanel.after(panel);
    panel.querySelectorAll(".required-document").forEach((input) => input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const current = (request.documents || []).find((item) => item.type === input.dataset.docType);
      let session; try { session = JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch {}
      if (!session?.token) { input.value = ""; return toast("Sənəd yükləmək üçün sistemə yenidən daxil olun."); }
      const form = new FormData(); form.append("requestId", request.id); form.append("type", input.dataset.docType); form.append("file", file); if (current?.documentId) form.append("replaceDocumentId", current.documentId);
      panel.classList.add("document-upload-busy");
      panel.querySelectorAll("input,button,label").forEach(control => { control.style.pointerEvents = "none"; });
      try {
        const response = await fetch("api/request-document.php", { method: "POST", headers: { Authorization: `Bearer ${session.token}` }, body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.document) throw new Error(payload?.error || "Sənəd serverə yüklənmədi.");
        request.documents = (request.documents || []).filter((item) => item.type !== input.dataset.docType);
        request.documents.push({ type: input.dataset.docType, ...payload.document });
        audit("UPLOAD", `${request.id}:${input.dataset.docType}`); save(); panel.remove(); addPanel(request); toast(`${file.name} bazada saxlanıldı.`);
      } catch (error) { input.value = ""; toast(error.message || "Sənəd yüklənmədi."); }
      finally { panel.classList.remove("document-upload-busy"); panel.querySelectorAll("input,button,label").forEach(control => { control.style.pointerEvents = ""; }); }
    });
    panel.querySelectorAll(".document-card").forEach((card) => {
      const type = card.dataset.docCard, saved = (request.documents || []).find((item) => item.type === type);
      if (!saved) return;
      const button = document.createElement("button"); button.type = "button"; button.className = "secondary document-download"; button.style.marginTop = "10px"; button.style.padding = "7px 10px"; button.style.fontSize = "12px"; button.textContent = "↓ Kompüterə endir";
      const stored = Boolean(saved.documentId);
      if (!stored) { button.disabled = true; button.title = "Bu köhnə sənəd fayl kimi saxlanmayıb. Yenidən yükləyin."; button.style.opacity = ".55"; button.style.cursor = "not-allowed"; card.append(button); return; }
      button.onclick = async () => {
        let session; try { session = JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch {}
        if (!session?.token) return toast("Sənədi endirmək üçün sistemə yenidən daxil olun.");
        try { const url = `api/request-document.php?id=${encodeURIComponent(saved.documentId)}`; const response = await fetch(url, { headers: { Authorization: `Bearer ${session.token}` } }); if (!response.ok) throw new Error("Sənəd tapılmadı."); const blob = await response.blob(); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = saved.filename || "sənəd"; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 0); } catch (error) { toast(error.message || "Sənəd endirilə bilmədi."); }
      };
      card.append(button);
    });
    panel.querySelectorAll(".document-remove").forEach((button) => button.onclick = async () => {
      const type = button.dataset.docType;
      const saved = (request.documents || []).find((item) => item.type === type);
      if (!saved) return;
      if (!confirm(`“${saved.filename}” sənədi silinsin?`)) return;
      let session; try { session = JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch {}
      if (!session?.token) return toast("Sənədi silmək üçün sistemə yenidən daxil olun.");
      button.disabled = true; button.textContent = "Silinir…";
      try {
        if (saved.documentId) {
          const form = new FormData(); form.append("action", "delete"); form.append("requestId", request.id); form.append("documentId", saved.documentId);
          const response = await fetch("api/request-document.php", { method: "POST", headers: { Authorization: `Bearer ${session.token}` }, body: form });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Sənəd silinə bilmədi.");
        }
        request.documents = (request.documents || []).filter((item) => item.type !== type);
        audit("DELETE_DOCUMENT", `${request.id}:${type}`); save(); panel.remove(); addPanel(request); toast("Sənəd silindi.");
      } catch (error) { button.disabled = false; button.textContent = "Sil"; toast(error.message || "Sənəd silinə bilmədi."); }
    });
    const saveButton = document.querySelector("#detailSave"); if (saveButton && !saveButton.dataset.documentBound) { saveButton.dataset.documentBound = "1"; const previous = saveButton.onclick; saveButton.onclick = () => { const status = document.querySelector("#detailStatus")?.value; if (status === "COMPLETED" && (request.documents || []).length < required.length) return toast("Sorğunu tamamlamaq üçün 3 məcburi sənədi əlavə edin."); previous?.(); }; }
  }
  window.addEventListener("load", () => {
    const original = window.detail;
    window.detail = (id) => {
      original(id);
      setTimeout(() => {
        const request = db.requests.find((item) => item.id === id);
        if (request) addPanel(request);
      }, 0);
    };
    // The route script can open a hash-linked request before this wrapper is registered.
    // Re-apply the panel for that initial deep link as well as normal in-app navigation.
    const initialId = decodeURIComponent(location.hash.replace(/^#request=/, ""));
    if (initialId) setTimeout(() => { const request = db.requests.find((item) => item.id === initialId); if (request) addPanel(request); }, 0);

    const requestsNav = document.querySelector('button[data-page="requests"]');
    if (requestsNav && !requestsNav.dataset.requestFolderBound) {
      requestsNav.dataset.requestFolderBound = "1";
      requestsNav.classList.add("request-parent");
      requestsNav.classList.add("collapsed");
      requestsNav.setAttribute("aria-expanded", "false");
      const folderGroup = document.createElement("div");
      folderGroup.id = "requestFolderGroup";
      folderGroup.className = "request-folder-group collapsed";
      folderGroup.dataset.open = "false";
      requestsNav.after(folderGroup);
      const addFolder = (id, label, mode, title) => {
        const folder = document.createElement("button");
        folder.id = id;
        folder.className = "request-folder";
        folder.type = "button";
        folder.textContent = `↳ ${label}`;
        folder.title = title;
        folder.onclick = () => { folderMode = mode; statusFilter = "ALL"; page = "requests"; filter = ""; render(); setTimeout(enhanceRequestList, 0); };
        folderGroup.append(folder);
      };
      addFolder("rejectedFolderNav", "İmtina qovluğu", "REJECTED", "İmtina edilmiş sorğular");
      addFolder("salesFolderNav", "Satışlar", "COMPLETED", "Tamamlanmış sorğuların satış qovluğu");
      addFolder("waitingCustomerFolderNav", "Müştəri gözlənilir", "WAITING_CUSTOMER", "Müştəri cavabı gözlənilən sorğular");
      const setFolderOpen = (shouldOpen) => {
        folderGroup.dataset.open = String(shouldOpen);
        folderGroup.classList.toggle("collapsed", !shouldOpen);
        requestsNav.classList.toggle("collapsed", !shouldOpen);
        requestsNav.setAttribute("aria-expanded", String(shouldOpen));
      };
      const previousRequestsClick = requestsNav.onclick;
      requestsNav.onclick = (event) => {
        const isRequestsPage = page === "requests";
        const isOpen = folderGroup.dataset.open !== "false";
        const shouldOpen = !isRequestsPage || !isOpen;
        setFolderOpen(shouldOpen);
        folderMode = "MAIN";
        statusFilter = "ALL";
        previousRequestsClick?.call(requestsNav, event);
      };
      document.querySelectorAll('.nav button[data-page]:not([data-page="requests"])').forEach((button) => button.addEventListener("click", () => setFolderOpen(false)));
      // The application starts on Dashboard; always begin with request folders closed.
      setTimeout(() => setFolderOpen(false), 0);
    }

    // The shell keeps render() in a page-level lexical binding, so observe #root
    // instead of replacing a window property. This covers navigation and filters.
    const root = document.querySelector("#root");
    if (root && !root.dataset.documentListObserver) {
      const observer = new MutationObserver(() => enhanceRequestList());
      observer.observe(root, { childList: true, subtree: true });
      root.dataset.documentListObserver = "1";
    }
    setTimeout(enhanceRequestList, 0);
  });
})();
