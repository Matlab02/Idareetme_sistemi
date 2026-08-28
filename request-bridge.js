/* Expose the local ERP shell functions to the optional feature modules. */
window.addEventListener("load", () => {
  window.db = db;
  window.modal = modal;
  window.badge = badge;
  window.statusText = statusText;
  window.toast = toast;
  window.audit = audit;
  window.save = save;
  window.activate = activate;
  window.render = render;
});
