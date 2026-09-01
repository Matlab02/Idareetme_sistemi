/* AzPlom ERP Mail Center — browser client for the protected PHP mail API. */
(() => {
  const API = "api/mail.php";
  const FOLDERS = [
    ["INBOX", "⌂", "Gələnlər"],
    ["STARRED", "★", "Ulduzlu"],
    ["SENT", "↗", "Göndərilənlər"],
    ["DRAFTS", "◻", "Qaralamalar"],
    ["ARCHIVE", "▣", "Arxiv"],
    ["SPAM", "!", "Spam"],
    ["TRASH", "⌫", "Zibil qutusu"],
  ];
  const state = {
    open: false, loading: false, detailLoading: false, syncing: false,
    folder: "INBOX", query: "", messages: [], counts: {}, config: null,
    capabilities: {}, selectedId: null, selected: null, selectedIds: new Set(),
    error: "", listVersion: 0, searchTimer: null,
  };

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const text = (value) => String(value ?? "").trim();
  const toast = (value) => window.toast ? window.toast(value) : alert(value);
  const audit = (action, entity) => { try { window.audit?.(action, entity); } catch (_) {} };
  const folderMeta = (folder) => FOLDERS.find(([id]) => id === folder) || [folder, "✉", folder];
  const short = (value, max = 34) => text(value).length > max ? `${text(value).slice(0, Math.max(1, max - 1))}…` : text(value);
  const initial = (name, email) => (text(name || email || "?").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2) || "✉").toUpperCase();
  const bytes = (size) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
  const dateText = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diff = Date.now() - date.getTime();
    if (diff < 24 * 60 * 60 * 1000) return new Intl.DateTimeFormat("az-AZ", { hour: "2-digit", minute: "2-digit" }).format(date);
    if (diff < 7 * 24 * 60 * 60 * 1000) return new Intl.DateTimeFormat("az-AZ", { weekday: "short" }).format(date);
    return new Intl.DateTimeFormat("az-AZ", { day: "2-digit", month: "short" }).format(date);
  };
  const fullDateText = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("az-AZ", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  };

  function session() {
    try { return JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch (_) { return null; }
  }

  function token() { return session()?.token || ""; }

  async function api(action, { method = "GET", data = {}, formData = null } = {}) {
    const currentToken = token();
    if (!currentToken) throw new Error("Mail mərkəzi üçün canlı server girişi tələb olunur.");
    const url = new URL(API, window.location.href);
    url.searchParams.set("action", action);
    const headers = { Authorization: `Bearer ${currentToken}` };
    const options = { method, headers, cache: "no-store" };
    if (method === "GET") {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
      });
    } else if (formData) {
      options.body = formData;
    } else {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(data);
    }
    const response = await fetch(url.toString(), options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || "Mail əməliyyatı tamamlanmadı.");
    return body;
  }

  async function refreshStatus() {
    const response = await api("status");
    state.config = response.config || null;
    state.capabilities = response.capabilities || {};
    state.counts = response.counts || {};
    state.error = "";
    updateUnreadBadge();
    return response;
  }

  async function loadList({ render = true } = {}) {
    const version = ++state.listVersion;
    state.loading = true;
    if (render) draw();
    try {
      const response = await api("list", { data: { folder: state.folder, q: state.query, limit: 60 } });
      if (version !== state.listVersion) return;
      state.messages = response.messages || [];
      state.counts = response.counts || state.counts;
      state.error = "";
      updateUnreadBadge();
    } catch (error) {
      if (version !== state.listVersion) return;
      state.messages = [];
      state.error = error.message || "Mail siyahısı yüklənmədi.";
    } finally {
      if (version === state.listVersion) {
        state.loading = false;
        if (render) draw();
      }
    }
  }

  async function refreshAll() {
    state.loading = true;
    draw();
    try { await refreshStatus(); } catch (error) { state.error = error.message || "Mail serverə qoşulmaq mümkün olmadı."; }
    await loadList({ render: false });
    state.loading = false;
    draw();
  }

  function currentCount(folder) { return state.counts?.[folder] || { total: 0, unread: 0 }; }

  function updateUnreadBadge() {
    const badge = document.querySelector("#mailUnread");
    const unread = Number(currentCount("INBOX").unread || 0);
    if (badge) {
      badge.textContent = unread ? String(unread) : "";
      badge.style.cssText = unread ? "float:right;min-width:18px;padding:1px 5px;border-radius:999px;background:#dbeafe;color:#1764c4;font-size:10px;text-align:center" : "";
    }
  }

  function setActive() {
    document.querySelectorAll(".nav button[data-page]").forEach((button) => button.classList.toggle("active", state.open && button.dataset.page === "mail"));
    const global = document.querySelector("#globalSearch");
    if (global) global.placeholder = state.open ? "⌕  Bütün poçtda axtar..." : "⌕  Bütün sistemdə axtar...";
  }

  function head() {
    const configured = Boolean(state.config?.configured);
    const hasCapability = state.capabilities?.imap !== false;
    return `<div class="content mail-center"><div class="head"><div><div class="eyebrow">AZPLOM CONNECT</div><h1>Poçt Mərkəzi</h1><p>${configured ? `${esc(state.config?.email || "info@azplom.com")} · şirkət yazışmaları və ERP əlaqələri` : "info@azplom.com hesabını təhlükəsiz şəkildə ERP-ə qoşun."}</p></div><div class="mail-head-actions"><span class="mail-status ${configured && hasCapability ? "online" : ""}"><i></i>${configured && hasCapability ? "Bağlı" : "Qoşulma gözləyir"}</span><button class="secondary mail-secondary-icon" data-mail-settings>⚙ Parametrlər</button><button class="secondary mail-secondary-icon" data-mail-history ${configured && !state.syncing ? "" : "disabled"}>⌛ Köhnələri yüklə</button><button class="secondary mail-secondary-icon" data-mail-sync ${configured && !state.syncing ? "" : "disabled"}>${state.syncing ? "↻ Sinxronlaşır..." : "↻ Yenilə"}</button><button class="primary mail-primary" data-mail-compose>＋ Məktub yaz</button></div></div>${configured && !hasCapability ? '<div class="mail-setup-warning">Bu hostingdə PHP IMAP aktiv görünmür. cPanel dəstəyi ilə IMAP genişlənməsi aktivləşdirilməlidir.</div>' : ""}`;
  }

  function folderMarkup() {
    return `<aside class="mail-folders"><div class="mail-folders-top"><span>QOVLUQLAR</span><span>${esc(state.config?.email || "info@azplom.com")}</span></div>${FOLDERS.map(([id, icon, label]) => {
      const count = currentCount(id);
      const value = id === "INBOX" || id === "STARRED" ? Number(count.unread || 0) : Number(count.total || 0);
      return `<button class="mail-folder ${state.folder === id ? "active" : ""}" data-mail-folder="${id}"><span class="mail-folder-icon">${icon}</span><span>${label}</span>${value ? `<span class="mail-folder-count">${value}</span>` : ""}</button>`;
    }).join("")}<span class="mail-folder-spacer"></span><div class="mail-folder-footer"><b>AzPlom Mail</b>Qoşmalar və yazışmalar qorunan server yaddaşında saxlanır.</div></aside>`;
  }

  function listRow(message) {
    const selected = state.selectedId === message.id;
    const sender = message.direction === "OUTGOING" ? (message.to?.[0]?.name || message.to?.[0]?.email || "Alıcı") : (message.from?.name || message.from?.email || "Naməlum");
    return `<button class="mail-row ${selected ? "active" : ""} ${message.isRead ? "" : "unread"}" data-mail-open="${message.id}"><input type="checkbox" class="mail-row-check" data-mail-check="${message.id}" ${state.selectedIds.has(message.id) ? "checked" : ""} aria-label="Məktubu seç"><span class="mail-row-content"><span class="mail-row-sender">${esc(sender)}</span><span class="mail-row-subject">${message.isStarred ? "★ " : ""}${esc(message.subject || "(Mövzusuz)")}</span><span class="mail-row-snippet">${esc(message.snippet || "")}</span></span><span class="mail-row-meta"><span>${esc(dateText(message.receivedAt))}</span>${message.hasAttachments ? '<small class="mail-row-attach">⌇</small>' : ""}${message.deliveryStatus === "FAILED" ? '<small class="mail-row-failed">Xəta</small>' : ""}</span></button>`;
  }

  function listMarkup() {
    const title = folderMeta(state.folder)[2];
    const allSelected = state.messages.length > 0 && state.messages.every((message) => state.selectedIds.has(message.id));
    return `<section class="mail-list-pane"><div class="mail-list-top"><input class="mail-list-search" data-mail-search value="${esc(state.query)}" placeholder="${esc(title)} qovluğunda axtar..."><button class="mail-list-refresh" data-mail-refresh title="Yenilə">↻</button></div><div class="mail-bulkbar"><label><input type="checkbox" data-mail-select-all ${allSelected ? "checked" : ""}> Hamısı</label><span>${state.selectedIds.size ? `${state.selectedIds.size} seçilib` : `${Number(currentCount(state.folder).total || state.messages.length)} məktub`}</span><span style="margin-left:auto">${state.selectedIds.size ? '<button data-mail-bulk="read">Oxunmuş</button><button data-mail-bulk="archive">Arxiv</button><button data-mail-bulk="trash">Sil</button>' : ""}</span></div><div class="mail-list">${state.loading ? '<div class="mail-loading">Məktublar hazırlanır…</div>' : state.error ? `<div class="mail-empty"><div><div class="mail-empty-icon">✉</div><b>Mail serverə qoşulmaq mümkün olmadı</b><p>${esc(state.error)}</p><button class="secondary" style="margin-top:13px" data-mail-settings>Parametrləri aç</button></div></div>` : state.messages.length ? state.messages.map(listRow).join("") : `<div class="mail-empty"><div><div class="mail-empty-icon">✉</div><b>${esc(title)} boşdur</b><p>${state.config?.configured ? "Bu qovluqda hələ məktub yoxdur." : "Mail hesabını qoşduqdan sonra info@azplom.com-a gələn məktublar burada görünəcək."}</p></div></div>`}</div></section>`;
  }

  function relatedOptions(type) {
    const data = window.db || {};
    if (type === "REQUEST") return (data.requests || []).map((item) => ({ id: item.id, label: `${item.id} · ${item.customer || ""}` }));
    if (type === "CUSTOMER") return (data.customers || []).map((item) => ({ id: typeof item === "string" ? item : item.name, label: typeof item === "string" ? item : item.name }));
    if (type === "SUPPLIER") return (data.suppliers || []).map((item) => ({ id: typeof item === "string" ? item : item.name, label: typeof item === "string" ? item : item.name }));
    if (type === "INVOICE") return [...(data.incomingInvoices || []), ...(data.outgoingInvoices || [])].map((item) => ({ id: item.number || item.id, label: item.number || item.id }));
    return [];
  }

  function linkControls(selected) {
    const first = relatedOptions("REQUEST");
    return `<section class="mail-links"><h3>ERP ilə əlaqələndir</h3><div class="mail-link-row"><select data-mail-link-type><option value="REQUEST">Sorğu</option><option value="CUSTOMER">Müştəri</option><option value="SUPPLIER">Təchizatçı</option><option value="INVOICE">Qaimə</option></select><select data-mail-link-entity>${first.length ? first.map((item) => `<option value="${esc(item.id)}">${esc(short(item.label, 44))}</option>`).join("") : '<option value="">Uyğun qeyd yoxdur</option>'}</select><button class="secondary" data-mail-link="${selected.id}">Bağla</button></div>${selected.links?.length ? `<div style="margin-top:10px">${selected.links.map((link) => `<span class="mail-link-badge">⌁ ${esc(link.label || `${link.entityType}: ${link.entityId}`)}</span>`).join("")}</div>` : ""}</section>`;
  }

  function detailsMarkup() {
    if (state.detailLoading) return `<section class="mail-detail"><div class="mail-empty"><div class="mail-empty-icon">◌</div><b>Məktub açılır…</b></div></section>`;
    const selected = state.selected;
    if (!selected) return `<section class="mail-detail"><div class="mail-empty"><div><div class="mail-empty-icon">✉</div><b>Məktub seçin</b><p>Gələnlər, göndərilənlər və qoşmalar bu pəncərədə təhlükəsiz göstəriləcək.</p></div></div></section>`;
    const sender = selected.from || {};
    const thread = state.selectedThread || [];
    return `<section class="mail-detail ${selected ? "mobile-open" : ""}"><div class="mail-detail-top"><h2>${esc(selected.subject || "(Mövzusuz)")}</h2><div class="mail-detail-actions"><button title="Cavabla" data-mail-reply="${selected.id}">↩</button><button title="Yönləndir" data-mail-forward="${selected.id}">↗</button><button title="Ulduzla" data-mail-detail-action="${selected.isStarred ? "unstar" : "star"}" data-mail-id="${selected.id}">${selected.isStarred ? "★" : "☆"}</button><button title="Arxivlə" data-mail-detail-action="archive" data-mail-id="${selected.id}">▣</button><button title="Zibil qutusuna at" data-mail-detail-action="trash" data-mail-id="${selected.id}">⌫</button></div></div><div class="mail-detail-scroll"><div class="mail-message-meta"><div class="mail-sender-avatar">${esc(initial(sender.name, sender.email))}</div><div class="mail-sender-info"><b>${esc(sender.name || sender.email || "Naməlum göndərən")}</b><span>${esc(sender.email || "")}${selected.to?.length ? ` · Kimə: ${esc(selected.to.map((item) => item.email).join(", "))}` : ""}</span>${selected.cc?.length ? `<span>CC: ${esc(selected.cc.map((item) => item.email).join(", "))}</span>` : ""}</div><div class="mail-message-date">${esc(fullDateText(selected.receivedAt))}</div></div>${selected.deliveryStatus === "FAILED" ? '<span class="mail-chip">⚠ Göndəriş uğursuz olub — qaralamalardan yenidən göndərin.</span>' : ""}${selected.htmlAvailable ? '<span class="mail-chip">⊙ HTML məzmunu təhlükəsizlik üçün mətn görünüşündə göstərilir.</span>' : ""}<article class="mail-body">${esc(selected.bodyText || "Bu məktubda görünən mətn yoxdur.")}</article>${selected.attachments?.length ? `<section class="mail-attachments"><h3>Qoşmalar · ${selected.attachments.length}</h3><div class="mail-attachment-list">${selected.attachments.map((attachment) => `<button class="mail-attachment" data-mail-download="${attachment.id}" data-name="${esc(attachment.name)}"><span>📎</span><span>${esc(attachment.name)}<small>${esc(attachment.mimeType)} · ${bytes(Number(attachment.size || 0))}</small></span></button>`).join("")}</div></section>` : ""}${linkControls(selected)}${thread.length > 1 ? `<section class="mail-thread"><h3>Bu yazışmada ${thread.length} məktub</h3><div class="mail-thread-list">${thread.map((message) => `<button class="mail-thread-item" data-mail-thread-open="${message.id}"><span><b>${esc(message.from?.name || message.from?.email || "AzPlom")}</b> · ${esc(short(message.subject, 46))}</span><span>${esc(dateText(message.receivedAt))}</span></button>`).join("")}</div></section>` : ""}</div></section>`;
  }

  function draw() {
    if (!state.open) return;
    const root = document.querySelector("#root");
    if (!root) return;
    root.innerHTML = `${head()}<div class="mail-shell">${folderMarkup()}${listMarkup()}${detailsMarkup()}</div></div>`;
    setActive();
    bind();
  }

  function bind() {
    const root = document.querySelector("#root");
    if (!root) return;
    root.querySelector("[data-mail-compose]")?.addEventListener("click", () => openCompose());
    root.querySelectorAll("[data-mail-settings]").forEach((button) => button.addEventListener("click", openSettings));
    root.querySelector("[data-mail-sync]")?.addEventListener("click", () => syncMailbox("recent"));
    root.querySelector("[data-mail-history]")?.addEventListener("click", () => syncMailbox("history"));
    root.querySelector("[data-mail-refresh]")?.addEventListener("click", refreshAll);
    root.querySelectorAll("[data-mail-folder]").forEach((button) => button.addEventListener("click", () => switchFolder(button.dataset.mailFolder)));
    root.querySelector("[data-mail-search]")?.addEventListener("input", (event) => {
      state.query = event.target.value;
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => loadList(), 280);
    });
    root.querySelectorAll("[data-mail-open]").forEach((button) => button.addEventListener("click", (event) => {
      if (event.target.closest("[data-mail-check]")) return;
      openMessage(Number(button.dataset.mailOpen));
    }));
    root.querySelectorAll("[data-mail-check]").forEach((checkbox) => checkbox.addEventListener("click", (event) => event.stopPropagation()));
    root.querySelectorAll("[data-mail-check]").forEach((checkbox) => checkbox.addEventListener("change", () => {
      const id = Number(checkbox.dataset.mailCheck);
      checkbox.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      draw();
    }));
    root.querySelector("[data-mail-select-all]")?.addEventListener("change", (event) => {
      state.selectedIds = event.target.checked ? new Set(state.messages.map((message) => message.id)) : new Set();
      draw();
    });
    root.querySelectorAll("[data-mail-bulk]").forEach((button) => button.addEventListener("click", () => updateMessages(button.dataset.mailBulk, [...state.selectedIds])));
    root.querySelectorAll("[data-mail-detail-action]").forEach((button) => button.addEventListener("click", () => updateMessages(button.dataset.mailDetailAction, [Number(button.dataset.mailId)])));
    root.querySelectorAll("[data-mail-reply]").forEach((button) => button.addEventListener("click", () => replyTo(state.selected)));
    root.querySelectorAll("[data-mail-forward]").forEach((button) => button.addEventListener("click", () => forward(state.selected)));
    root.querySelectorAll("[data-mail-download]").forEach((button) => button.addEventListener("click", () => downloadAttachment(Number(button.dataset.mailDownload), button.dataset.name || "attachment")));
    root.querySelectorAll("[data-mail-thread-open]").forEach((button) => button.addEventListener("click", () => openMessage(Number(button.dataset.mailThreadOpen))));
    root.querySelector("[data-mail-link-type]")?.addEventListener("change", (event) => {
      const select = root.querySelector("[data-mail-link-entity]");
      const options = relatedOptions(event.target.value);
      select.innerHTML = options.length ? options.map((item) => `<option value="${esc(item.id)}">${esc(short(item.label, 44))}</option>`).join("") : '<option value="">Uyğun qeyd yoxdur</option>';
    });
    root.querySelector("[data-mail-link]")?.addEventListener("click", () => linkMessage(Number(root.querySelector("[data-mail-link]").dataset.mailLink)));
  }

  async function switchFolder(folder) {
    state.folder = folder;
    state.query = "";
    state.selected = null;
    state.selectedId = null;
    state.selectedIds.clear();
    await loadList();
  }

  async function openMessage(id) {
    state.selectedId = id;
    state.detailLoading = true;
    draw();
    try {
      const response = await api("message", { data: { id } });
      state.selected = response.message;
      state.selectedThread = response.thread || [];
      state.counts = response.counts || state.counts;
      updateUnreadBadge();
      const index = state.messages.findIndex((message) => message.id === id);
      if (index >= 0) state.messages[index].isRead = true;
    } catch (error) {
      toast(error.message || "Məktub açıla bilmədi.");
      state.selected = null;
      state.selectedId = null;
    } finally {
      state.detailLoading = false;
      draw();
    }
  }

  async function updateMessages(mode, ids) {
    if (!ids.length) return;
    try {
      await api("update", { method: "POST", data: { ids, mode } });
      audit(`MAIL_${mode.toUpperCase()}`, ids.join(","));
      state.selectedIds.clear();
      if (["archive", "trash", "spam", "restore", "inbox"].includes(mode) && ids.includes(state.selectedId)) {
        state.selected = null;
        state.selectedId = null;
      }
      await refreshAll();
      toast("Məktub əməliyyatı yadda saxlanıldı.");
    } catch (error) { toast(error.message || "Məktub əməliyyatı tamamlanmadı."); }
  }

  async function syncMailbox(scope = "recent") {
    if (state.syncing) return;
    state.syncing = true;
    draw();
    try {
      const response = await api("sync", { method: "POST", data: { scope } });
      audit(scope === "history" ? "MAIL_HISTORY_SYNC" : "MAIL_SYNC", "info@azplom.com");
      await refreshAll();
      const loaded = response.sync?.imported || 0;
      const suffix = response.sync?.hasMore ? " Daha köhnə məktublar üçün düyməni yenidən basın." : "";
      toast(`${loaded} ${scope === "history" ? "köhnə" : "yeni"} məktub sinxronlaşdırıldı.${suffix}`);
    } catch (error) { toast(error.message || "Sinxronlaşdırma tamamlanmadı."); }
    finally { state.syncing = false; draw(); }
  }

  function removeOverlay(selector) { document.querySelector(selector)?.remove(); }

  function requestEntityOptions() {
    return relatedOptions("REQUEST").map((item) => `<option value="${esc(item.id)}">${esc(short(item.label, 48))}</option>`).join("");
  }

  function openCompose(prefill = {}) {
    removeOverlay(".mail-compose-backdrop");
    const overlay = document.createElement("div");
    overlay.className = "mail-compose-backdrop";
    overlay.innerHTML = `<section class="mail-compose"><div class="mail-compose-header"><div><h2>${prefill.forward ? "Məktubu yönləndir" : prefill.replyToId ? "Cavab yaz" : "Yeni məktub"}</h2><p>${esc(state.config?.email || "info@azplom.com")} ünvanından təhlükəsiz göndəriş</p></div><button class="mail-close" data-compose-close>×</button></div><div class="mail-compose-form"><div class="mail-compose-row"><label>Kimə</label><input data-compose-to placeholder="email@company.com" value="${esc(prefill.to || "")}" autocomplete="email"></div><div class="mail-compose-extra"><button data-compose-cc>CC</button><button data-compose-bcc>BCC</button></div><div class="mail-compose-row" data-compose-cc-row hidden><label>CC</label><input data-compose-cc-input placeholder="email@company.com"></div><div class="mail-compose-row" data-compose-bcc-row hidden><label>BCC</label><input data-compose-bcc-input placeholder="email@company.com"></div><div class="mail-compose-row"><label>Mövzu</label><input data-compose-subject value="${esc(prefill.subject || "")}" placeholder="Məktubun mövzusu"></div><textarea class="mail-compose-body" data-compose-body placeholder="Məktubun məzmununu yazın...">${esc(prefill.body || "")}</textarea><div class="mail-compose-links"><label>ERP qeydinə bağla (istəyə bağlı)</label><select data-compose-link-type><option value="REQUEST">Sorğu</option><option value="CUSTOMER">Müştəri</option><option value="SUPPLIER">Təchizatçı</option><option value="INVOICE">Qaimə</option></select><select data-compose-link-entity><option value="">Bağlama</option>${requestEntityOptions()}</select></div><div class="mail-compose-bottom"><label class="mail-upload-label">📎 Qoşma əlavə et<input type="file" data-compose-files multiple></label><span class="mail-upload-note" data-compose-file-note>PDF, Excel, şəkil və digər fayllar · hər biri maks. 12 MB</span></div><div class="mail-compose-actions"><button class="secondary" data-compose-draft>Qaralama saxla</button><button class="primary mail-primary" data-compose-send>${prefill.forward ? "Yönləndir" : "Göndər"}</button></div></div></section>`;
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.append(overlay);
    overlay.querySelector("[data-compose-close]").onclick = () => overlay.remove();
    overlay.querySelector("[data-compose-cc]").onclick = () => { overlay.querySelector("[data-compose-cc-row]").hidden = false; overlay.querySelector("[data-compose-cc-input]").focus(); };
    overlay.querySelector("[data-compose-bcc]").onclick = () => { overlay.querySelector("[data-compose-bcc-row]").hidden = false; overlay.querySelector("[data-compose-bcc-input]").focus(); };
    overlay.querySelector("[data-compose-link-type]").onchange = (event) => {
      const entity = overlay.querySelector("[data-compose-link-entity]");
      const options = relatedOptions(event.target.value);
      entity.innerHTML = `<option value="">Bağlama</option>${options.map((item) => `<option value="${esc(item.id)}">${esc(short(item.label, 48))}</option>`).join("")}`;
    };
    overlay.querySelector("[data-compose-files]").onchange = (event) => {
      const files = [...event.target.files || []];
      overlay.querySelector("[data-compose-file-note]").textContent = files.length ? `${files.length} qoşma seçildi · ${files.map((file) => file.name).join(", ")}` : "PDF, Excel, şəkil və digər fayllar · hər biri maks. 12 MB";
    };
    overlay.querySelector("[data-compose-draft]").onclick = () => submitCompose(overlay, "draft", prefill.replyToId || 0);
    overlay.querySelector("[data-compose-send]").onclick = () => submitCompose(overlay, "send", prefill.replyToId || 0);
    setTimeout(() => overlay.querySelector("[data-compose-to]")?.focus(), 20);
  }

  async function submitCompose(overlay, action, replyToId) {
    const to = overlay.querySelector("[data-compose-to]").value.trim();
    const subject = overlay.querySelector("[data-compose-subject]").value.trim();
    const body = overlay.querySelector("[data-compose-body]").value;
    const cc = overlay.querySelector("[data-compose-cc-input]").value.trim();
    const bcc = overlay.querySelector("[data-compose-bcc-input]").value.trim();
    const entityType = overlay.querySelector("[data-compose-link-type]").value;
    const entityId = overlay.querySelector("[data-compose-link-entity]").value;
    const form = new FormData();
    form.append("to", to); form.append("cc", cc); form.append("bcc", bcc); form.append("subject", subject); form.append("body", body); form.append("replyToId", String(replyToId || ""));
    if (entityId) form.append("links", JSON.stringify([{ entityType, entityId, label: entityId }]));
    [...overlay.querySelector("[data-compose-files]").files || []].forEach((file) => form.append("attachments[]", file));
    const sendButton = overlay.querySelector(action === "send" ? "[data-compose-send]" : "[data-compose-draft]");
    sendButton.disabled = true;
    sendButton.textContent = action === "send" ? "Göndərilir…" : "Saxlanılır…";
    try {
      const response = await api(action, { method: "POST", formData: form });
      audit(action === "send" ? "MAIL_SEND" : "MAIL_DRAFT", response.message?.id || "");
      overlay.remove();
      await refreshAll();
      toast(action === "send" ? "Məktub göndərildi." : "Qaralama yadda saxlanıldı.");
    } catch (error) {
      toast(error.message || "Məktub əməliyyatı tamamlanmadı.");
      sendButton.disabled = false;
      sendButton.textContent = action === "send" ? "Göndər" : "Qaralama saxla";
    }
  }

  function replyTo(message) {
    if (!message) return;
    const subject = /^re:/i.test(message.subject || "") ? message.subject : `Re: ${message.subject || ""}`;
    openCompose({ to: message.from?.email || "", subject, replyToId: message.id });
  }

  function forward(message) {
    if (!message) return;
    const subject = /^fwd?:/i.test(message.subject || "") ? message.subject : `Fwd: ${message.subject || ""}`;
    const body = `\n\n---------- Yönləndirilmiş məktub ----------\nKimdən: ${message.from?.email || ""}\nTarix: ${fullDateText(message.receivedAt)}\nMövzu: ${message.subject || ""}\n\n${message.bodyText || ""}`;
    openCompose({ subject, body, forward: true });
  }

  async function linkMessage(id) {
    const root = document.querySelector("#root");
    const entityType = root.querySelector("[data-mail-link-type]").value;
    const entityId = root.querySelector("[data-mail-link-entity]").value;
    if (!entityId) return toast("Əlaqələndirmək üçün ERP qeydi seçin.");
    try {
      await api("link", { method: "POST", data: { id, entityType, entityId, label: entityId } });
      audit("MAIL_LINK", `${entityType}:${entityId}`);
      await openMessage(id);
      toast("Məktub ERP qeydinə bağlandı.");
    } catch (error) { toast(error.message || "Əlaqə yaradılmadı."); }
  }

  async function downloadAttachment(id, name) {
    const currentToken = token();
    if (!currentToken) return toast("Server girişi tələb olunur.");
    try {
      const url = new URL(API, window.location.href);
      url.searchParams.set("action", "download");
      url.searchParams.set("id", String(id));
      const response = await fetch(url, { headers: { Authorization: `Bearer ${currentToken}` }, cache: "no-store" });
      if (!response.ok) throw new Error("Qoşma endirilə bilmədi.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = name; anchor.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (error) { toast(error.message || "Qoşma endirilə bilmədi."); }
  }

  function openSettings() {
    removeOverlay(".mail-settings-backdrop");
    const config = state.config || {};
    const imap = config.imap || {};
    const smtp = config.smtp || {};
    const field = (label, key, value, options = "") => {
      const password = key.includes("password");
      const control = options ? `<select data-setting="${key}">${options}</select>` : password
        ? `<input data-setting="${key}" type="password" value="" autocomplete="new-password" placeholder="${value ? "Saxlanılıb — dəyişmək üçün yeni parol yazın" : "Mail hesabının parolu"}">`
        : `<input data-setting="${key}" value="${esc(value || "")}">`;
      return `<div class="mail-setting-field ${key === "displayName" || key === "email" ? "full" : ""}"><label>${label}</label>${control}</div>`;
    };
    const encryptionOptions = (value) => ["ssl", "tls", "none"].map((item) => `<option value="${item}" ${value === item ? "selected" : ""}>${item.toUpperCase()}</option>`).join("");
    const overlay = document.createElement("div");
    overlay.className = "mail-settings-backdrop";
    overlay.innerHTML = `<section class="mail-settings"><div class="mail-settings-header"><div><h2>Mail hesabını qoş</h2><p>Parametrlər yalnız server tərəfdə şifrəli saxlanır; brauzerə geri qaytarılmır.</p></div><button class="mail-close" data-settings-close>×</button></div><div class="mail-settings-grid"><div class="mail-setting-card full"><h3>Göndərən hesab</h3><div class="mail-setting-fields">${field("E-poçt ünvanı", "email", config.email || "info@azplom.com")}${field("Görünən ad", "displayName", config.displayName || "AzPlom")}</div></div><div class="mail-setting-card"><h3>Gələn məktublar · IMAP</h3><p>cPanel → Email Accounts → Connect Devices bölməsindəki dəqiq məlumatları daxil edin.</p><div class="mail-setting-fields">${field("Server", "imap.host", imap.host)}${field("Port", "imap.port", imap.port || 993)}${field("Şifrələmə", "imap.encryption", imap.encryption || "ssl", encryptionOptions(imap.encryption || "ssl"))}${field("İstifadəçi adı", "imap.username", imap.username || config.email || "info@azplom.com")}${field("Mail parolu", "imap.password", imap.passwordSaved ? "saved" : "")}</div></div><div class="mail-setting-card"><h3>Göndəriş · SMTP</h3><p>Göndəriş və cavablar üçün eyni mailbox hesabından istifadə edilə bilər.</p><div class="mail-setting-fields">${field("Server", "smtp.host", smtp.host)}${field("Port", "smtp.port", smtp.port || 465)}${field("Şifrələmə", "smtp.encryption", smtp.encryption || "ssl", encryptionOptions(smtp.encryption || "ssl"))}${field("İstifadəçi adı", "smtp.username", smtp.username || config.email || "info@azplom.com")}${field("Mail parolu", "smtp.password", smtp.passwordSaved ? "saved" : "")}</div></div></div><div class="mail-settings-actions"><span>Qeyd: cPanel giriş parolu ilə poçt hesabının parolu eyni olmaya bilər. Dəqiq host/port məlumatlarını təxmin etməyin.</span><div style="display:flex;gap:8px"><button class="secondary" data-settings-test>Bağlantını yoxla</button><button class="primary mail-primary" data-settings-save>Yadda saxla</button></div></div></section>`;
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.append(overlay);
    overlay.querySelector("[data-settings-close]").onclick = () => overlay.remove();
    const read = (key) => overlay.querySelector(`[data-setting="${key}"]`)?.value?.trim() || "";
    overlay.querySelector("[data-settings-save]").onclick = async () => {
      const button = overlay.querySelector("[data-settings-save]"); button.disabled = true; button.textContent = "Saxlanılır…";
      const payload = { email: read("email"), displayName: read("displayName"), imap: { host: read("imap.host"), port: read("imap.port"), encryption: read("imap.encryption"), username: read("imap.username"), password: read("imap.password") }, smtp: { host: read("smtp.host"), port: read("smtp.port"), encryption: read("smtp.encryption"), username: read("smtp.username"), password: read("smtp.password") } };
      try { const response = await api("settings", { method: "POST", data: payload }); state.config = response.config; audit("MAIL_SETTINGS", payload.email); overlay.remove(); await refreshAll(); toast("Mail parametrləri şifrəli şəkildə yadda saxlanıldı."); }
      catch (error) { toast(error.message || "Parametrlər yadda saxlanmadı."); button.disabled = false; button.textContent = "Yadda saxla"; }
    };
    overlay.querySelector("[data-settings-test]").onclick = async () => {
      try { const result = await api("probe", { method: "POST" }); toast(`IMAP: ${result.probe?.imap ? "hazır" : "xəta"} · SMTP: ${result.probe?.smtp ? "hazır" : "xəta"}`); }
      catch (error) { toast(error.message || "Bağlantı yoxlanmadı."); }
    };
  }

  function open() {
    state.open = true;
    state.error = "";
    setActive();
    draw();
    refreshAll();
  }

  function install() {
    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest(".nav button[data-page]") : null;
      if (!target) return;
      if (target.dataset.page === "mail") {
        event.preventDefault(); event.stopImmediatePropagation(); open();
      } else if (state.open) {
        state.open = false;
        state.selected = null;
        state.selectedId = null;
        setActive();
      }
    }, true);
    document.addEventListener("input", (event) => {
      if (!state.open || event.target?.id !== "globalSearch") return;
      event.stopImmediatePropagation();
      state.query = event.target.value;
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => loadList(), 280);
    }, true);
    updateUnreadBadge();
  }

  window.addEventListener("load", () => {
    install();
    if (window.location.hash === "#mail") open();
  });
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#mail") open();
  });
  window.mailCenter = { open, refresh: refreshAll, render: draw };
})();
