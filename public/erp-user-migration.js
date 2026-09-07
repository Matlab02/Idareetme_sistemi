/* One-time bridge: moves legacy Superadmin browser accounts into the ERP database. */
(() => {
  "use strict";

  const STORE = "erp-superadmin-v1";
  const session = () => { try { return JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch { return null; } };
  const toastMessage = message => { if (typeof window.toast === "function") window.toast(message); };
  const localUsers = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "{}");
      return (Array.isArray(saved.users) ? saved.users : []).filter(user =>
        /^[A-Za-z0-9._-]{3,64}$/.test(String(user.username || "")) && /^[a-f0-9]{64}$/i.test(String(user.passwordHash || ""))
      ).map(user => ({ name: String(user.name || user.username).trim(), username: String(user.username).trim(), passwordHash: String(user.passwordHash).toLowerCase() }));
    } catch { return []; }
  };

  async function migrate() {
    const current = session();
    if (String(current?.username || "").toLowerCase() !== "sami" || !current?.token) return;
    const users = localUsers();
    if (!users.length) { toastMessage("Köçürüləcək köhnə Superadmin hesabı tapılmadı."); return; }
    const button = document.querySelector("#erpLegacyMigration");
    if (button) { button.disabled = true; button.textContent = "Köçürülür…"; }
    try {
      const response = await fetch("api/erp-user-sync.php", {
        method: "POST",
        headers: { Authorization: `Bearer ${current.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ users })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "İstifadəçilər köçürülə bilmədi.");
      toastMessage(`${data.created || 0} yeni hesab bazaya köçürüldü. Mövcud: ${data.existing || 0}.`);
      if (typeof window.superusers === "function") document.querySelector("#root").innerHTML = window.superusers();
      window.dispatchEvent(new Event("erp-session-ready"));
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "Köhnə istifadəçiləri bazaya köçür"; }
      toastMessage(error.message || "İstifadəçilər köçürülə bilmədi.");
    }
  }

  function wrapSuperuserView() {
    if (typeof window.superusers !== "function" || window.superusers.__migrationWrapped) return;
    const original = window.superusers;
    const wrapped = () => {
      const markup = original();
      const count = localUsers().length;
      const migration = `<button id="erpLegacyMigration" class="secondary" type="button" onclick="window.migrateLegacyErpUsers()">Köhnə istifadəçiləri bazaya köçür${count ? ` (${count})` : ""}</button>`;
      return markup.replace('<button class="primary" onclick="window.openSuperUserCreate()">＋ Yeni istifadəçi</button>', `<div class="erp-user-actions">${migration}<button class="primary" onclick="window.openSuperUserCreate()">＋ Yeni istifadəçi</button></div>`);
    };
    wrapped.__migrationWrapped = true;
    window.superusers = wrapped;
  }

  function install() {
    const current = session();
    if (String(current?.username || "").toLowerCase() !== "sami") return;
    const style = document.createElement("style");
    style.id = "erpMigrationStyles";
    style.textContent = ".erp-user-actions{display:flex;align-items:center;gap:9px}.erp-user-actions .secondary{white-space:nowrap}@media(max-width:640px){.erp-user-actions{width:100%;margin-top:12px}.erp-user-actions button{flex:1}.content .head{flex-wrap:wrap}}";
    if (!document.querySelector("#erpMigrationStyles")) document.head.append(style);
    wrapSuperuserView();
    window.migrateLegacyErpUsers = migrate;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
