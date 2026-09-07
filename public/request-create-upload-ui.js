/* Keeps request-creation file actions visible even when an older cached module is present. */
(() => {
  "use strict";
  function styles() {
    if (document.querySelector("#request-create-upload-ui-styles")) return;
    const style = document.createElement("style"); style.id = "request-create-upload-ui-styles";
    style.textContent = "#requestCreationDocuments [data-new-request-document]{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none}#requestCreationDocuments .request-creation-upload{display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 10px;border:1px dashed #92b9e8;border-radius:8px;background:#fff;color:#1767ce;font-size:11px;font-weight:750;cursor:pointer;transition:.16s ease}#requestCreationDocuments .request-creation-upload:hover{border-color:#397ad2;background:#edf6ff}#requestCreationDocuments .request-creation-upload:focus-within{outline:3px solid #dbeaff}";
    document.head.append(style);
  }
  function upgrade() {
    styles();
    const section = document.querySelector("#requestCreationDocuments");
    if (!section) return;
    section.querySelectorAll("[data-new-request-document]").forEach((input, index) => {
      if (!input.id) input.id = `request-document-upload-${input.dataset.newRequestDocument}-${index}`;
      let label = section.querySelector(`label[for="${input.id}"]`);
      if (!label) {
        label = document.createElement("label");
        label.className = "request-creation-upload";
        label.htmlFor = input.id;
        label.textContent = "＋ Sənəd əlavə et";
        input.after(label);
      }
    });
  }
  window.addEventListener("load", () => {
    const observer = new MutationObserver(() => upgrade());
    observer.observe(document.body, { childList: true, subtree: true });
    upgrade();
  });
})();

