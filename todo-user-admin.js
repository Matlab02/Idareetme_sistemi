/* Superadmin-only ERP To-do user directory. Kept distinct from website admins. */
(() => {
  "use strict";
  const escText = value => (typeof esc === "function" ? esc(value) : String(value ?? ""));
  const session = () => { try { return JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch { return null; } };
  const isSuperadmin = () => String(session()?.username || "").toLowerCase() === "sami";
  const request = async (path = "", payload) => {
    const current = session();
    if (!current?.token) throw new Error("Giriş sessiyası tapılmadı. Yenidən daxil olun.");
    const response = await fetch(`api/admin-users.php${path}`, { method: payload ? "POST" : "GET", headers: { Authorization: `Bearer ${current.token}`, ...(payload ? { "Content-Type": "application/json" } : {}) }, body: payload ? JSON.stringify(payload) : undefined, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "İstifadəçi məlumatları yüklənmədi.");
    return data;
  };
  let erpUsers = [], availableUsers = [];

  function mountNav() {
    if (!isSuperadmin()) return;
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector('[data-page="todo-users"]')) return;
    const item = document.createElement("button");
    item.type = "button"; item.dataset.page = "todo-users"; item.className = "todo-user-nav-item";
    item.innerHTML = '<span aria-hidden="true">☑</span>&nbsp; To-do istifadəçiləri';
    item.addEventListener("click", () => { document.querySelectorAll(".nav button[data-page]").forEach(button => button.classList.toggle("active", button === item)); document.querySelector("#root").innerHTML = page(); void refresh(); });
    const log = nav.querySelector('[data-page="superlogs"]');
    if (log) nav.insertBefore(item, log); else nav.append(item);
  }
  function page() {
    return shell("To-do istifadəçiləri", "Bu siyahı yalnız ERP To-do tapşırıqlarında istifadə olunur; saytın digər adminləri burada görünmür.", `<button type="button" class="secondary" onclick="window.todoUserAdmin.refresh()">↻ Yenilə</button>`) + `<section class="todo-user-directory"><div class="todo-user-directory-grid"><section class="panel"><div class="panel-head"><div><h2>Aktiv ERP To-do istifadəçiləri</h2><p>Ümumi və fərdi tapşırıqlar yalnız bu hesablara göndərilir.</p></div><strong class="todo-user-count">${erpUsers.length}</strong></div><div class="todo-user-list">${erpUsers.map(user => `<div class="todo-user-row"><span class="todo-user-avatar">${escText((user.name || user.username).slice(0, 1).toUpperCase())}</span><div><b>${escText(user.name || user.username)}</b><small>@${escText(user.username)}</small></div><span class="todo-user-active">ERP To-do</span></div>`).join("") || '<p class="todo-user-empty">Hələ ERP To-do istifadəçisi yoxdur.</p>'}</div></section><aside class="panel todo-user-add"><span>ERP QRUPU</span><h2>Yeni ERP istifadəçisi yarat</h2><p>Bu istifadəçi avtomatik To-do siyahısına daxil ediləcək.</p><form id="todoUserCreateForm" novalidate><div class="field"><label for="todoUserCreateName">Ad və soyad</label><input id="todoUserCreateName" name="name" maxlength="160" required placeholder="Məsələn: Elçin Məmmədov"></div><div class="field"><label for="todoUserCreateLogin">İstifadəçi adı</label><input id="todoUserCreateLogin" name="username" minlength="3" maxlength="64" required autocomplete="off" placeholder="elcin.mammadov"></div><div class="field"><label for="todoUserCreatePassword">İlkin şifrə</label><input id="todoUserCreatePassword" name="password" type="password" minlength="6" required autocomplete="new-password" placeholder="Ən azı 6 simvol"></div><p id="todoUserCreateError" class="todo-form-error" role="alert"></p><button type="submit" class="primary">ERP istifadəçisi yarat</button></form><div class="todo-user-divider"><span>və ya</span></div><h3>Mövcud hesabı aktivləşdir</h3><p>Saytda hesabı olan işçini ERP To-do istifadəçisi edin.</p><form id="todoUserEnrollForm" novalidate><div class="field"><label for="todoUserSelect">Mövcud hesab</label><select id="todoUserSelect" name="userId"><option value="">Hesab seçin</option>${availableUsers.map(user => `<option value="${escText(user.id)}" data-name="${escText(user.name || user.username)}">${escText(user.name || user.username)} · @${escText(user.username)}</option>`).join("")}</select></div><div class="field"><label for="todoUserName">To-do adı</label><input id="todoUserName" name="name" maxlength="160" placeholder="Ad və soyad"></div><p id="todoUserError" class="todo-form-error" role="alert"></p><button type="submit" class="secondary">Mövcud hesabı əlavə et</button></form></aside></div></section></div>`;
  }
  async function refresh() {
    try {
      const [members, available] = await Promise.all([request(), request("?scope=available")]);
      erpUsers = Array.isArray(members?.users) ? members.users : [];
      availableUsers = Array.isArray(available?.users) ? available.users : [];
      if (document.querySelector("#root .todo-user-directory")) document.querySelector("#root").innerHTML = page();
    } catch (error) { toast(error.message || "To-do istifadəçiləri yüklənmədi."); }
  }
  async function enroll(form) {
    const error = form.querySelector("#todoUserError"), values = Object.fromEntries(new FormData(form));
    if (!values.userId) { error.textContent = "Mövcud hesabı seçin."; return; }
    const button = form.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Əlavə edilir…";
    try { await request("", { action: "activate-erp-user", userId: values.userId, name: String(values.name || "").trim() }); await refresh(); toast("Hesab ERP To-do istifadəçisi kimi aktivləşdirildi."); }
    catch (reason) { error.textContent = reason.message || "İstifadəçi aktivləşdirilə bilmədi."; button.disabled = false; button.textContent = "ERP To-do siyahısına əlavə et"; }
  }
  async function createUser(form) {
    const error = form.querySelector("#todoUserCreateError"), values = Object.fromEntries(new FormData(form));
    const name = String(values.name || "").trim(), username = String(values.username || "").trim(), password = String(values.password || "");
    if (!name || !/^[A-Za-z0-9._-]{3,64}$/.test(username) || password.length < 6) { error.textContent = "Adı, düzgün istifadəçi adını və ən azı 6 simvollu şifrəni yazın."; return; }
    const button = form.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Yaradılır…";
    try { await request("", { action: "create", name, username, password }); await refresh(); toast("Yeni ERP istifadəçisi yaradıldı."); }
    catch (reason) { error.textContent = reason.message || "İstifadəçi yaradıla bilmədi."; button.disabled = false; button.textContent = "ERP istifadəçisi yarat"; }
  }
  function installStyles() {
    if (document.querySelector("#todoUserAdminStyles")) return;
    const style = document.createElement("style"); style.id = "todoUserAdminStyles";
    style.textContent = ".todo-user-nav-item{color:#1767ce!important}.todo-user-directory{margin-top:20px}.todo-user-directory-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px}.todo-user-directory .panel-head{display:flex;justify-content:space-between;gap:15px;align-items:start}.todo-user-directory .panel-head h2,.todo-user-add h2,.todo-user-add h3{margin:0;font-size:16px}.todo-user-add h3{font-size:13px}.todo-user-directory .panel-head p,.todo-user-add p{margin:5px 0;color:var(--muted);font-size:12px;line-height:1.5}.todo-user-count{display:grid;place-items:center;min-width:36px;height:36px;border-radius:10px;background:#edf5ff;color:#1767ce}.todo-user-list{margin-top:14px;border-top:1px solid var(--line)}.todo-user-row{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)}.todo-user-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#edf4ff;color:#1767ce;font-size:13px;font-weight:800}.todo-user-row b{display:block;font-size:13px}.todo-user-row small{display:block;color:var(--muted);font-size:11px;margin-top:2px}.todo-user-active{margin-left:auto;border-radius:999px;padding:5px 8px;background:#e7f8ef;color:#157752;font-size:10px;font-weight:800}.todo-user-empty{padding:20px 0;color:var(--muted);font-size:12px}.todo-user-add>span{display:block;color:#7657d6;font-size:10px;font-weight:800;letter-spacing:.12em}.todo-user-add h2{margin-top:7px}.todo-user-add form{display:grid;gap:12px;margin-top:16px}.todo-user-add form .primary,.todo-user-add form .secondary{width:100%}.todo-user-divider{position:relative;margin:18px 0;border-top:1px solid var(--line);text-align:center}.todo-user-divider span{position:relative;top:-9px;padding:0 9px;background:var(--surface,#fff);color:var(--muted);font-size:11px}@media(max-width:900px){.todo-user-directory-grid{grid-template-columns:1fr}}";
    document.head.append(style);
  }
  function install() {
    installStyles(); mountNav();
    window.todoUserAdmin = { refresh };
    document.addEventListener("submit", event => { if (event.target.id === "todoUserEnrollForm") { event.preventDefault(); void enroll(event.target); } if (event.target.id === "todoUserCreateForm") { event.preventDefault(); void createUser(event.target); } });
    document.addEventListener("change", event => { if (event.target.id === "todoUserSelect") { const option = event.target.options[event.target.selectedIndex]; const field = document.querySelector("#todoUserName"); if (field && option?.dataset.name) field.value = option.dataset.name; } });
    window.addEventListener("erp-session-ready", mountNav);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
