/* Optional documents during request creation and later replacement. */
(() => {
  const documentTypes = [
    ["DELIVERY_HANDOVER", "Təhvil-təslim sənədi"],
    ["PRICE_AGREEMENT", "Qiymət razılaşma protokolu"],
    ["INVOICE", "Hesab-faktura"],
  ];

  function styles() {
    if (document.querySelector("#request-creation-document-styles")) return;
    const style = document.createElement("style"); style.id = "request-creation-document-styles";
    style.textContent = ".request-creation-documents{margin-top:2px}.request-creation-document-list{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.request-creation-document{display:grid;gap:6px;padding:10px;border:1px solid #dbe4f0;border-radius:10px;background:#fbfdff}.request-creation-document b{font-size:11px;color:#42536e}.request-creation-document input{font-size:11px;padding:7px!important;background:#fff}.request-creation-document .muted{margin:0;font-size:10px}@media(max-width:760px){.request-creation-document-list{grid-template-columns:1fr}}";
    document.head.appendChild(style);
  }

  function addCreationDocuments() {
    const form = document.querySelector("#requestForm");
    if (!form || form.querySelector("#requestCreationDocuments")) return;
    const section = document.createElement("div"); section.id = "requestCreationDocuments"; section.className = "field full request-creation-documents";
    section.innerHTML = `<label>Sorğu sənədləri <span class="muted">(istəyə bağlı)</span></label><div class="request-creation-document-list">${documentTypes.map(([type, label]) => `<div class="request-creation-document"><b>${label}</b><input type="file" data-new-request-document="${type}" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"><span class="muted">Hələ fayl seçilməyib</span></div>`).join("")}</div><small class="muted">Sorğu yaradıldıqdan sonra bu sənədləri istənilən vaxt yenidən yükləyə və dəyişə bilərsiniz.</small>`;
    form.append(section);
    section.querySelectorAll("[data-new-request-document]").forEach((input) => input.onchange = () => { const file = input.files?.[0], note = input.parentElement.querySelector("span"); if (note) note.textContent = file ? `✓ ${file.name} · yenidən seçərək dəyişə bilərsiniz` : "Hələ fayl seçilməyib"; });
  }

  function collectDocuments() {
    return [...document.querySelectorAll("[data-new-request-document]")].map((input) => { const file = input.files?.[0]; return file ? { type: input.dataset.newRequestDocument, filename: file.name, mimeType: file.type, size: file.size, uploadedAt: new Date().toISOString() } : null; }).filter(Boolean);
  }

  window.addEventListener("load", () => {
    styles();
    const originalOpenRequest = window.openRequest, originalSaveRequest = window.saveRequest;
    if (typeof originalOpenRequest === "function" && !originalOpenRequest.datasetDocumentWrapped) {
      const wrappedOpenRequest = function (...args) { const result = originalOpenRequest.apply(this, args); setTimeout(addCreationDocuments, 0); return result; };
      wrappedOpenRequest.datasetDocumentWrapped = "1"; window.openRequest = wrappedOpenRequest;
    }
    if (typeof originalSaveRequest === "function" && !originalSaveRequest.datasetDocumentWrapped) {
      const wrappedSaveRequest = function (...args) {
        const documents = collectDocuments(), existingIds = new Set((db.requests || []).map((request) => request.id)), result = originalSaveRequest.apply(this, args), created = (db.requests || []).find((request) => !existingIds.has(request.id));
        if (created && documents.length) { created.documents = documents; created.timeline ||= []; created.timeline.push(`${documents.length} sənəd sorğu yaradılarkən əlavə edildi`); audit("UPLOAD", `${created.id}:CREATE`); save(); toast(`${documents.length} sənəd sorğuya əlavə edildi. Sorğunu açıb “Sənədi dəyiş” ilə yenidən yükləyə bilərsiniz.`); }
        return result;
      };
      wrappedSaveRequest.datasetDocumentWrapped = "1"; window.saveRequest = wrappedSaveRequest;
    }
  });
})();
