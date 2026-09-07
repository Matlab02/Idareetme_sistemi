/* Unlimited supporting documents for a request; required documents stay separate. */
(() => {
  "use strict";
  const REQUIRED = new Set(["DELIVERY_HANDOVER", "PRICE_AGREEMENT", "INVOICE"]);
  const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png";
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character]));
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch { return null; } };
  const currentRequest = () => {
    const id = document.querySelector("#root .content h1")?.textContent?.trim();
    return (window.db?.requests || []).find(request => request.id === id) || null;
  };
  const requiredCount = request => (request.documents || []).filter(document => REQUIRED.has(document.type)).length;

  function addStyles() {
    if (document.querySelector("#additional-request-document-styles")) return;
    const style = document.createElement("style"); style.id = "additional-request-document-styles";
    style.textContent = ".additional-documents{margin-top:16px;padding-top:16px;border-top:1px solid var(--line,#e4eaf2)}.additional-documents-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.additional-documents h3{margin:0;color:#233756;font-size:13px}.additional-documents p{margin:4px 0 0;color:var(--muted,#697a94);font-size:11px;line-height:1.5}.additional-upload{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border:1px dashed #91b7e7;border-radius:9px;background:#f7fbff;color:#1767ce;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:.16s ease}.additional-upload:hover{border-color:#397ad2;background:#edf6ff}.additional-upload:focus-within{outline:3px solid #dbeaff}.additional-upload input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.additional-document-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.additional-document-row{display:flex;align-items:center;gap:8px;min-width:0;padding:9px 10px;border:1px solid #dbe8f4;border-radius:10px;background:#fbfdff}.additional-document-row i{display:grid;place-items:center;flex:0 0 25px;width:25px;height:25px;border-radius:7px;background:#e9f3ff;color:#1767ce;font-style:normal;font-size:12px}.additional-document-row span{min-width:0;flex:1;overflow:hidden;color:#2d435e;font-size:11px;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.additional-document-row button{flex:0 0 auto;padding:5px 7px!important;font-size:10px!important}.additional-document-empty{margin-top:11px!important;padding:10px;border:1px dashed #dbe5f1;border-radius:9px;background:#fafcff;color:#8491a4!important}.additional-document-busy{opacity:.65;pointer-events:none}@media(max-width:760px){.additional-documents-head{display:grid}.additional-upload{width:100%}.additional-document-list{grid-template-columns:1fr}}";
    document.head.append(style);
  }

  function refreshProgress(request, panel) {
    const progress = panel.querySelector(".doc-progress");
    if (!progress) return;
    const requiredDone = requiredCount(request), supporting = (request.documents || []).filter(document => document.type === "ADDITIONAL").length;
    progress.innerHTML = `<strong>${requiredDone}/3</strong> məcburi sənəd əlavə olunub. ${requiredDone === 3 ? "Sorğu tamamlanmağa hazırdır." : "Çatışmayan məcburi sənədləri əlavə edin."}${supporting ? ` <span class="muted">${supporting} əlavə sənəd də qoşulub.</span>` : ""}`;
  }

  async function uploadAdditional(request, input, section) {
    const files = [...(input.files || [])];
    if (!files.length) return;
    const session = getSession();
    if (!session?.token) { input.value = ""; toast("Sənəd yükləmək üçün sistemə yenidən daxil olun."); return; }
    section.classList.add("additional-document-busy");
    let completed = 0;
    try {
      for (const file of files) {
        const form = new FormData(); form.append("requestId", request.id); form.append("type", "ADDITIONAL"); form.append("file", file);
        const response = await fetch("api/request-document.php", { method: "POST", headers: { Authorization: `Bearer ${session.token}` }, body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.document) throw new Error(payload?.error || `${file.name} yüklənmədi.`);
        request.documents ||= [];
        request.documents.push({ type: "ADDITIONAL", ...payload.document });
        completed++;
        audit("UPLOAD", `${request.id}:ADDITIONAL`);
      }
      save();
      toast(`${completed} əlavə sənəd yükləndi.`);
    } catch (error) {
      if (completed) save();
      toast(error.message || "Əlavə sənəd yüklənmədi.");
    } finally {
      input.value = "";
      section.classList.remove("additional-document-busy");
      attach();
    }
  }

  async function download(fileRecord) {
    const session = getSession();
    if (!session?.token) return toast("Sənədi endirmək üçün sistemə yenidən daxil olun.");
    if (!fileRecord.documentId) return toast("Bu köhnə sənəd fayl kimi saxlanmayıb.");
    try {
      const response = await fetch(`api/request-document.php?id=${encodeURIComponent(fileRecord.documentId)}`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (!response.ok) throw new Error("Sənəd tapılmadı.");
      const blob = await response.blob(), link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = fileRecord.filename || "əlavə-sənəd"; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 0);
    } catch (error) { toast(error.message || "Sənəd endirilə bilmədi."); }
  }

  function bindCompletionGuard(request) {
    const button = document.querySelector("#detailSave");
    if (!button || button.dataset.additionalDocumentGuard) return;
    button.dataset.additionalDocumentGuard = "1";
    const previous = button.onclick;
    button.onclick = () => {
      if (document.querySelector("#detailStatus")?.value === "COMPLETED" && requiredCount(request) < 3) return toast("Sorğunu tamamlamaq üçün 3 məcburi sənədi əlavə edin.");
      previous?.();
    };
  }

  function attach() {
    addStyles();
    const request = currentRequest(), panel = document.querySelector(".documents-panel");
    if (!request || !panel) return;
    refreshProgress(request, panel); bindCompletionGuard(request);
    const additional = (request.documents || []).filter(document => document.type === "ADDITIONAL");
    const signature = additional.map(document => document.documentId || `${document.filename}:${document.uploadedAt || ""}`).join("|");
    const existing = panel.querySelector(".additional-documents");
    if (existing?.dataset.documentSignature === signature) return;
    existing?.remove();
    const section = document.createElement("section"); section.className = "additional-documents"; section.dataset.documentSignature = signature;
    section.innerHTML = `<div class="additional-documents-head"><div><h3>Əlavə sənədlər</h3><p>Məcburi 3 sənəddən əlavə, istənilən sayda fayl qoşa bilərsiniz.</p></div><label class="additional-upload">＋ Əlavə sənəd yüklə<input type="file" multiple accept="${ACCEPTED}" aria-label="Əlavə sənədləri seç"></label></div>${additional.length ? `<div class="additional-document-list">${additional.map((document, index) => `<div class="additional-document-row"><i>⌁</i><span title="${esc(document.filename)}">${esc(document.filename)}</span><button type="button" class="secondary" data-additional-download="${index}">↓ Endir</button></div>`).join("")}</div>` : '<p class="additional-document-empty">Hələ əlavə sənəd qoşulmayıb.</p>'}`;
    panel.append(section);
    section.querySelector("input[type=file]").onchange = event => { void uploadAdditional(request, event.currentTarget, section); };
    section.querySelectorAll("[data-additional-download]").forEach(button => button.onclick = () => { void download(additional[Number(button.dataset.additionalDownload)]); });
  }

  window.addEventListener("load", () => {
    const root = document.querySelector("#root");
    if (!root || root.dataset.additionalDocumentsObserver) return;
    const observer = new MutationObserver(() => attach());
    observer.observe(root, { childList: true, subtree: true });
    root.dataset.additionalDocumentsObserver = "1";
    setTimeout(attach, 0);
  });
})();
