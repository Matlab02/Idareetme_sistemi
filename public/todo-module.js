(function () {
  "use strict";

  const STORAGE_KEY = "azplom-todo-filter";
  const FILTERS = {
    all: "Bütün tapşırıqlar",
    open: "Açıq",
    today: "Bu gün",
    overdue: "Gecikən",
    completed: "Tamamlanan"
  };
  let activeFilter = localStorage.getItem(STORAGE_KEY) || "open";
  let remoteDirectory = [];

  const escText = value => (typeof esc === "function" ? esc(value) : String(value ?? ""));
  const today = () => new Date().toISOString().slice(0, 10);
  const dueLabel = value => {
    if (!value) return "Tarix təyin edilməyib";
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat("az-AZ", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  };
  const requestLabel = id => id ? `Sorğu: ${id}` : "Ümumi əməliyyat";
  const USER_STORE = "erp-superadmin-v1";
  const todoStatus = status => status === "COMPLETED" ? "Tamamlandı" : "Açıq";
  const escapeXml = value => String(value ?? "").replace(/[&<>\"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

  function userDirectory() {
    let localUsers = [];
    try { localUsers = JSON.parse(localStorage.getItem(USER_STORE) || "null")?.users || []; } catch { localUsers = []; }
    const users = [...remoteDirectory, ...localUsers];
    try {
      const session = JSON.parse(sessionStorage.getItem("erp-auth-session") || "null");
      if (session?.username && !users.some(user => String(user.username).toLowerCase() === String(session.username).toLowerCase())) users.push({ id: session.id || session.username, name: session.name || session.username, username: session.username });
    } catch { /* Session user is optional. */ }
    const seen = new Set();
    return users.filter(user => user?.username && !seen.has(String(user.username).toLowerCase()) && seen.add(String(user.username).toLowerCase()));
  }

  async function refreshUserDirectory() {
    let session;
    try { session = JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch { session = null; }
    if (!session?.token) return userDirectory();
    try {
      const response = await fetch("api/erp-users.php", { headers: { Authorization: `Bearer ${session.token}` }, cache: "no-store" });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.users)) remoteDirectory = data.users.map(user => ({ id: user.id, username: user.username, name: user.name || user.username }));
    } catch { /* The local directory remains available if the connection is interrupted. */ }
    return userDirectory();
  }

  function recipientLabel(recipients) {
    if (!Array.isArray(recipients) || !recipients.length) return "Alıcı təyin edilməyib";
    if (recipients.includes("ALL")) return "Bütün istifadəçilər";
    const users = userDirectory();
    return recipients.map(username => users.find(user => user.username === username)?.name || username).join(", ");
  }

  function recipientOptions() {
    return `<option value="ALL">Bütün istifadəçilər</option>${userDirectory().map(user => `<option value="${escText(user.username)}">${escText(user.name || user.username)}</option>`).join("")}`;
  }

  function recipientCheckboxes() {
    return `<label class="todo-recipient-choice all"><input type="checkbox" name="recipients" value="ALL" checked onchange="window.todoHub.syncAllRecipients(this)"><span>Bütün istifadəçilər</span></label>${userDirectory().map(user => `<label class="todo-recipient-choice"><input type="checkbox" name="recipients" value="${escText(user.username)}" onchange="window.todoHub.selectRecipient(this)"><span>${escText(user.name || user.username)}</span><small>@${escText(user.username)}</small></label>`).join("")}`;
  }

  function selectedRecipients(form) {
    const values = [...new FormData(form).getAll("recipients")].map(value => String(value));
    return values.includes("ALL") ? ["ALL"] : [...new Set(values)];
  }

  function ensureTodos() {
    if (!Array.isArray(db.todos)) db.todos = [];
    return db.todos;
  }

  function isOverdue(todo) {
    return todo.status !== "COMPLETED" && Boolean(todo.dueDate) && todo.dueDate < today();
  }

  function filteredTodos() {
    const todos = ensureTodos();
    if (activeFilter === "completed") return todos.filter(todo => todo.status === "COMPLETED");
    if (activeFilter === "today") return todos.filter(todo => todo.status !== "COMPLETED" && todo.dueDate === today());
    if (activeFilter === "overdue") return todos.filter(isOverdue);
    if (activeFilter === "open") return todos.filter(todo => todo.status !== "COMPLETED");
    return todos;
  }

  function priorityClass(priority) {
    return ({ Təcili: "urgent", Yüksək: "high", Normal: "normal", Aşağı: "low" })[priority] || "normal";
  }

  function todoCard(todo) {
    const completed = todo.status === "COMPLETED";
    const overdue = isOverdue(todo);
    return `<article class="todo-card ${completed ? "is-complete" : ""}" data-todo-id="${escText(todo.id)}">
      <div class="todo-card-main">
        <div class="todo-card-topline">
          <span class="todo-priority ${priorityClass(todo.priority)}">${escText(todo.priority)}</span>
          <span class="todo-date ${overdue ? "is-overdue" : ""}">${overdue ? "Gecikib · " : ""}${dueLabel(todo.dueDate)}</span>
        </div>
        <h2>${escText(todo.title)}</h2>
        ${todo.note ? `<p>${escText(todo.note)}</p>` : ""}
        <div class="todo-meta"><span>${requestLabel(todo.requestId)}</span><span class="todo-recipient">Alıcı: ${escText(recipientLabel(todo.recipients))}</span><span>Yaradan: ${escText(todo.createdBy || "İstifadəçi")}</span></div>
      </div>
      <div class="todo-card-actions">
        <button type="button" class="todo-toggle ${completed ? "done" : ""}" onclick="window.todoHub.toggle('${escText(todo.id)}')" aria-label="${completed ? "Tapşırığı yenidən aç" : "Tapşırığı tamamla"}">
          <span aria-hidden="true">${completed ? "↺" : "✓"}</span>${completed ? "Yenidən aç" : "Tamamla"}
        </button>
        <button type="button" class="todo-delete" onclick="window.todoHub.confirmDelete('${escText(todo.id)}')" aria-label="Tapşırığı sil"><span aria-hidden="true">×</span>Sil</button>
      </div>
    </article>`;
  }

  function todoPage() {
    const todos = ensureTodos();
    const open = todos.filter(todo => todo.status !== "COMPLETED").length;
    const dueToday = todos.filter(todo => todo.status !== "COMPLETED" && todo.dueDate === today()).length;
    const overdue = todos.filter(isOverdue).length;
    const complete = todos.filter(todo => todo.status === "COMPLETED").length;
    const visible = filteredTodos();
    const filters = Object.entries(FILTERS).map(([key, label]) => `<button type="button" class="todo-filter ${activeFilter === key ? "active" : ""}" onclick="window.todoHub.filter('${key}')">${label}<span>${key === "all" ? todos.length : key === "open" ? open : key === "today" ? dueToday : key === "overdue" ? overdue : complete}</span></button>`).join("");

    return shell("To-do", "Komandanın növbəti işlərini, sorğu əlaqəsini və son tarixləri bir yerdən idarə edin.", `<div class="todo-head-actions"><button type="button" class="secondary" onclick="window.todoHub.exportExcel()">↓ Excel</button><button type="button" class="secondary" onclick="window.todoHub.exportPdf()">↓ PDF</button><button type="button" class="secondary todo-batch-trigger" onclick="window.todoHub.openBatch()">☷ Bir neçə tapşırıq</button><button type="button" class="primary todo-create" onclick="window.todoHub.open()">＋ Yeni tapşırıq</button></div>`) + `
      <section class="todo-summary" aria-label="Tapşırıq xülasəsi">
        <div class="todo-summary-card"><span>Açıq tapşırıqlar</span><strong>${open}</strong><small>İcra gözləyir</small></div>
        <div class="todo-summary-card today"><span>Bu gün</span><strong>${dueToday}</strong><small>Son tarix bu gündür</small></div>
        <div class="todo-summary-card overdue"><span>Gecikən</span><strong>${overdue}</strong><small>Diqqət tələb edir</small></div>
        <div class="todo-summary-card complete"><span>Tamamlanan</span><strong>${complete}</strong><small>Qeydə alınmış işlər</small></div>
      </section>
      <section class="todo-workspace">
        <div class="todo-filterbar" role="group" aria-label="Tapşırıq filtrləri">${filters}</div>
        <div class="todo-list" aria-live="polite">${visible.map(todoCard).join("") || `<div class="todo-empty"><div class="todo-empty-mark">✓</div><h2>${activeFilter === "completed" ? "Tamamlanan tapşırıq yoxdur" : "Bu filtrdə tapşırıq yoxdur"}</h2><p>${activeFilter === "completed" ? "İş tamamlandıqda burada görünəcək." : "İşi qeyd edin və komandaya aydın növbəti addım verin."}</p>${activeFilter !== "completed" ? `<button type="button" class="primary" onclick="window.todoHub.open()">＋ İlk tapşırığı yarat</button>` : ""}</div>`}</div>
      </section></div>`;
  }

  function installNavigation() {
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector('[data-page="todos"]')) return;
    const anchor = nav.querySelector('[data-page="reports"]');
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.page = "todos";
    item.className = "todo-nav-item";
    item.innerHTML = '<span aria-hidden="true">☑</span>&nbsp; To-do <span class="todo-nav-count" aria-label="Açıq tapşırıq sayı"></span>';
    item.addEventListener("click", () => { page = "todos"; filter = ""; render(); });
    if (anchor) nav.insertBefore(item, anchor);
    else nav.append(item);
  }

  function refreshTodoNav() {
    const count = document.querySelector(".todo-nav-count");
    if (count) count.textContent = ensureTodos().filter(todo => todo.status !== "COMPLETED").length || "";
  }

  async function openTodo() {
    await refreshUserDirectory();
    const requestOptions = (db.requests || []).map(request => `<option value="${escText(request.id)}">${escText(request.id)} · ${escText(request.customer)}</option>`).join("");
    modal(`<div class="todo-modal-heading"><span>İŞ PLANI</span><h2>Yeni tapşırıq</h2><p>İşin sahibini və konkret növbəti addımı qeyd edin.</p></div>
      <form id="todoForm" class="form todo-form" novalidate>
        <div class="field full"><label for="todoTitle">Tapşırığın adı</label><input id="todoTitle" name="title" maxlength="140" placeholder="Məsələn: Təchizatçıdan son qiyməti təsdiqlə" aria-describedby="todoFormError" required></div>
        <div class="field"><label for="todoRequest">Əlaqəli sorğu</label><select id="todoRequest" name="requestId"><option value="">Ümumi tapşırıq</option>${requestOptions}</select></div>
        <div class="field"><label for="todoPriority">Prioritet</label><select id="todoPriority" name="priority"><option>Təcili</option><option selected>Yüksək</option><option>Normal</option><option>Aşağı</option></select></div>
        <fieldset id="todoRecipients" class="field full todo-recipient-field"><legend>Göndəriləcək istifadəçilər</legend><div class="todo-recipient-list">${recipientCheckboxes()}</div><small>Bütün istifadəçiləri və ya konkret bir neçə nəfəri seçin.</small></fieldset>
        <div class="field"><label for="todoDate">Son tarix</label><input id="todoDate" name="dueDate" type="date"></div>
        <div class="field full"><label for="todoNote">Qeyd</label><textarea id="todoNote" name="note" maxlength="700" placeholder="Nəticə, əlaqə məlumatı və ya növbəti addım..."></textarea></div>
        <p id="todoFormError" class="todo-form-error" role="alert" aria-live="assertive"></p>
      </form>
      <div class="actions"><button type="button" class="secondary" onclick="closeModal()">Ləğv et</button><button type="button" class="primary" id="todoSave" onclick="window.todoHub.save()">Tapşırığı yarat</button></div>`);
    setTimeout(() => document.querySelector("#todoTitle")?.focus(), 0);
  }

  function requestOptions() {
    return (db.requests || []).map(request => `<option value="${escText(request.id)}">${escText(request.id)} · ${escText(request.customer)}</option>`).join("");
  }

  function syncAllRecipients(input) {
    if (!input.checked) return;
    document.querySelectorAll("#todoRecipients input[name=recipients]:not([value=ALL])").forEach(item => { item.checked = false; });
  }

  function selectRecipient(input) {
    if (input.checked) { const all = document.querySelector("#todoRecipients input[value=ALL]"); if (all) all.checked = false; }
  }

  function batchRow() {
    return `<tr data-batch-row><td><input aria-label="Tapşırığın adı" name="title" maxlength="140" placeholder="Tapşırığı yazın"></td><td><select aria-label="Əlaqəli sorğu" name="requestId"><option value="">Ümumi</option>${requestOptions()}</select></td><td><select aria-label="Göndəriləcək istifadəçi" name="recipient">${recipientOptions()}</select></td><td><select aria-label="Prioritet" name="priority"><option>Təcili</option><option>Yüksək</option><option selected>Normal</option><option>Aşağı</option></select></td><td><input aria-label="Son tarix" name="dueDate" type="date"></td><td><button type="button" class="todo-row-remove" aria-label="Bu sətri sil" onclick="window.todoHub.removeBatchRow(this)">×</button></td></tr>`;
  }

  function updateBatchCount() {
    const count = [...document.querySelectorAll("#todoBatchBody [name=title]")].filter(input => input.value.trim()).length;
    const button = document.querySelector("#todoBatchSave");
    if (button) button.textContent = count ? `${count} tapşırığı yarat` : "Tapşırıqları yarat";
  }

  async function openBatchTodo() {
    await refreshUserDirectory();
    modal(`<div class="todo-modal-heading"><span>TOPLU ƏLAVƏ</span><h2>Bir neçə tapşırıq</h2><p>Hər sətir ayrıca tapşırıq kimi yaradılacaq. Boş sətirlər nəzərə alınmır.</p></div>
      <form id="todoBatchForm" novalidate><div class="todo-batch-wrap"><table class="todo-batch-table"><thead><tr><th>Tapşırıq</th><th>Sorğu</th><th>Alıcı</th><th>Prioritet</th><th>Son tarix</th><th><span class="sr-only">Sətiri sil</span></th></tr></thead><tbody id="todoBatchBody">${batchRow()}${batchRow()}${batchRow()}</tbody></table></div><p id="todoBatchError" class="todo-form-error" role="alert" aria-live="assertive"></p></form>
      <div class="todo-batch-actions"><button type="button" class="secondary" onclick="window.todoHub.addBatchRow()">＋ Sətir əlavə et</button><div class="actions"><button type="button" class="secondary" onclick="closeModal()">Ləğv et</button><button type="button" class="primary todo-batch-save" id="todoBatchSave" onclick="window.todoHub.saveBatch()">Tapşırıqları yarat</button></div></div>`);
    document.querySelector("#todoBatchForm")?.addEventListener("input", updateBatchCount);
    setTimeout(() => document.querySelector("#todoBatchBody [name=title]")?.focus(), 0);
  }

  function addBatchRow() {
    document.querySelector("#todoBatchBody")?.insertAdjacentHTML("beforeend", batchRow());
    updateBatchCount();
  }

  function removeBatchRow(button) {
    const rows = document.querySelectorAll("#todoBatchBody [data-batch-row]");
    const row = button.closest("[data-batch-row]");
    if (!row) return;
    if (rows.length === 1) {
      row.querySelectorAll("input").forEach(input => { input.value = ""; });
      row.querySelectorAll("select").forEach(select => { select.selectedIndex = 0; });
    } else row.remove();
    updateBatchCount();
  }

  function saveBatchTodos() {
    const tasks = [...document.querySelectorAll("#todoBatchBody [data-batch-row]")].map(row => ({
      title: row.querySelector("[name=title]")?.value.trim() || "",
      requestId: row.querySelector("[name=requestId]")?.value || "",
      recipients: [row.querySelector("[name=recipient]")?.value || "ALL"],
      priority: row.querySelector("[name=priority]")?.value || "Normal",
      dueDate: row.querySelector("[name=dueDate]")?.value || ""
    })).filter(item => item.title);
    const error = document.querySelector("#todoBatchError");
    if (!tasks.length) {
      if (error) error.textContent = "Ən azı bir tapşırıq yazın.";
      document.querySelector("#todoBatchBody [name=title]")?.focus();
      return;
    }
    if (error) error.textContent = "";
    const button = document.querySelector("#todoBatchSave");
    if (button) { button.disabled = true; button.textContent = "Yaradılır…"; }
    const createdBy = typeof currentUserName === "function" ? currentUserName() : "İstifadəçi";
    const created = tasks.map((task, index) => ({ id: `TODO-${Date.now().toString().slice(-7)}-${index + 1}`, ...task, note: "", status: "OPEN", createdAt: new Date().toISOString(), createdBy }));
    ensureTodos().unshift(...created);
    audit("TODO_BATCH_CREATE", `${created.length} tapşırıq`);
    closeModal();
    render();
    toast(`${created.length} tapşırıq yaradıldı`);
  }

  function download(blob, filename) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function crc32(bytes) {
    let crc = -1;
    for (let index = 0; index < bytes.length; index++) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ -1) >>> 0;
  }

  function zip(entries) {
    const encoder = new TextEncoder(), chunks = [], central = [];
    let offset = 0;
    const add16 = (target, value) => target.push(value & 255, (value >>> 8) & 255);
    const add32 = (target, value) => target.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
    entries.forEach(([name, text]) => {
      const body = encoder.encode(text), filename = encoder.encode(name), sum = crc32(body), local = [];
      add32(local, 0x04034b50); add16(local, 20); add16(local, 0x0800); add16(local, 0); add16(local, 0); add16(local, 0); add32(local, sum); add32(local, body.length); add32(local, body.length); add16(local, filename.length); add16(local, 0); local.push(...filename, ...body); chunks.push(new Uint8Array(local));
      const record = [];
      add32(record, 0x02014b50); add16(record, 20); add16(record, 20); add16(record, 0x0800); add16(record, 0); add16(record, 0); add16(record, 0); add32(record, sum); add32(record, body.length); add32(record, body.length); add16(record, filename.length); add16(record, 0); add16(record, 0); add16(record, 0); add16(record, 0); add32(record, 0); add32(record, offset); record.push(...filename); central.push(new Uint8Array(record)); offset += local.length;
    });
    const centralSize = central.reduce((sum, item) => sum + item.length, 0), end = [];
    add32(end, 0x06054b50); add16(end, 0); add16(end, 0); add16(end, entries.length); add16(end, entries.length); add32(end, centralSize); add32(end, offset); add16(end, 0);
    return new Blob([...chunks, ...central, new Uint8Array(end)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function exportData() {
    return filteredTodos().map((todo, index) => [index + 1, todo.title, todo.requestId || "Ümumi", recipientLabel(todo.recipients), todo.priority, todo.dueDate || "—", todoStatus(todo.status), todo.note || "—", todo.createdBy || "İstifadəçi", todo.createdAt ? new Date(todo.createdAt).toLocaleString("az-AZ") : "—", todo.completedAt ? new Date(todo.completedAt).toLocaleString("az-AZ") : "—"]);
  }

  function exportExcel() {
    const rows = exportData();
    if (!rows.length) return toast("İxrac üçün bu filtrdə tapşırıq yoxdur.");
    const headers = ["№", "Tapşırıq", "Sorğu", "Alıcı", "Prioritet", "Son tarix", "Status", "Qeyd", "Yaradan", "Yaradılma vaxtı", "Tamamlanma vaxtı"];
    const columns = [7, 38, 20, 24, 13, 15, 14, 42, 18, 22, 22];
    const cell = (value, style) => `<c t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    const sheetRows = [headers, ...rows].map((row, index) => `<row r="${index + 1}">${row.map(value => cell(value, index === 0 ? 1 : 0)).join("")}</row>`).join("");
    const cols = columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
    const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="To-do" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF075B93"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
    download(zip([["[Content_Types].xml", types], ["_rels/.rels", rels], ["xl/workbook.xml", workbook], ["xl/_rels/workbook.xml.rels", workbookRels], ["xl/styles.xml", styles], ["xl/worksheets/sheet1.xml", sheet]]), `azplom-todo-${today()}.xlsx`);
    audit("TODO_EXPORT_XLSX", `${FILTERS[activeFilter]} · ${rows.length} tapşırıq`);
    save();
    toast("Excel faylı endirildi.");
  }

  function exportPdf() {
    const rows = exportData();
    if (!rows.length) return toast("İxrac üçün bu filtrdə tapşırıq yoxdur.");
    const popup = window.open("", "_blank", "popup,width=1200,height=800");
    if (!popup) return toast("PDF pəncərəsi bloklanıb. Brauzerdə popup icazəsini açın.");
    const tableRows = rows.map(row => `<tr><td>${escapeXml(row[0])}</td><td><b>${escapeXml(row[1])}</b>${row[7] !== "—" ? `<small>${escapeXml(row[7])}</small>` : ""}</td><td>${escapeXml(row[2])}</td><td>${escapeXml(row[3])}</td><td>${escapeXml(row[4])}</td><td>${escapeXml(row[5])}</td><td>${escapeXml(row[6])}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="az"><head><meta charset="utf-8"><title>AzPlom To-do</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#14243e;font-family:Arial,Helvetica,sans-serif}header{display:flex;justify-content:space-between;gap:18px;align-items:start;border-bottom:2px solid #075b93;padding-bottom:12px}header span{color:#0b78be;font-size:10px;font-weight:700;letter-spacing:.12em}h1{margin:5px 0;font-size:22px}p{margin:0;color:#687a94;font-size:11px}.meta{text-align:right;font-size:10px;color:#687a94}table{width:100%;margin-top:18px;border-collapse:collapse;font-size:10px}th{padding:8px;background:#075b93;color:#fff;text-align:left;font-size:9px;letter-spacing:.04em}td{padding:8px;border-bottom:1px solid #d8e6eb;vertical-align:top}td:first-child{width:28px;color:#687a94}td:nth-child(2){width:27%}td small{display:block;margin-top:3px;color:#687a94;font-weight:400}footer{margin-top:16px;color:#687a94;font-size:9px}</style></head><body><header><div><span>AZPLOM · İŞ PLANI</span><h1>To-do siyahısı</h1><p>${escapeXml(FILTERS[activeFilter])} filtri üzrə ${rows.length} tapşırıq</p></div><div class="meta">Yaradılıb: ${escapeXml(new Date().toLocaleString("az-AZ"))}</div></header><table><thead><tr><th>№</th><th>Tapşırıq</th><th>Sorğu</th><th>Alıcı</th><th>Prioritet</th><th>Son tarix</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table><footer>AzPlom Təchizat İdarəetmə Sistemi</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
    audit("TODO_EXPORT_PDF", `${FILTERS[activeFilter]} · ${rows.length} tapşırıq`);
    save();
  }

  function saveTodo() {
    const form = document.querySelector("#todoForm");
    if (!form) return;
    const values = Object.fromEntries(new FormData(form));
    const title = String(values.title || "").trim();
    const recipients = selectedRecipients(form);
    const error = document.querySelector("#todoFormError");
    const titleInput = document.querySelector("#todoTitle");
    if (!title) {
      titleInput?.setAttribute("aria-invalid", "true");
      if (error) error.textContent = "Tapşırığın adını yazın.";
      titleInput?.focus();
      return;
    }
    if (!recipients.length) {
      if (error) error.textContent = "Ən azı bir istifadəçi seçin və ya bütün istifadəçiləri işarələyin.";
      document.querySelector("#todoRecipients input")?.focus();
      return;
    }
    titleInput?.removeAttribute("aria-invalid");
    if (error) error.textContent = "";
    const button = document.querySelector("#todoSave");
    if (button) { button.disabled = true; button.textContent = "Yaradılır…"; }
    const todo = {
      id: `TODO-${Date.now().toString().slice(-7)}`,
      title,
      requestId: String(values.requestId || ""),
      priority: String(values.priority || "Normal"),
      recipients,
      dueDate: String(values.dueDate || ""),
      note: String(values.note || "").trim(),
      status: "OPEN",
      createdAt: new Date().toISOString(),
      createdBy: typeof currentUserName === "function" ? currentUserName() : "İstifadəçi"
    };
    ensureTodos().unshift(todo);
    audit("TODO_CREATE", todo.title);
    save();
    closeModal();
    render();
    toast("Tapşırıq yaradıldı");
  }

  function toggleTodo(id) {
    const todo = ensureTodos().find(item => item.id === id);
    if (!todo) return;
    const completed = todo.status === "COMPLETED";
    todo.status = completed ? "OPEN" : "COMPLETED";
    todo.completedAt = completed ? "" : new Date().toISOString();
    audit(completed ? "TODO_REOPEN" : "TODO_COMPLETE", todo.title);
    save();
    render();
    toast(completed ? "Tapşırıq yenidən açıldı" : "Tapşırıq tamamlandı");
  }

  function confirmDeleteTodo(id) {
    const todo = ensureTodos().find(item => item.id === id);
    if (!todo) return;
    modal(`<div class="todo-delete-dialog"><span>GERİ DÖNÜŞ YOXDUR</span><h2>Tapşırıq silinsin?</h2><p><b>${escText(todo.title)}</b> tapşırığı siyahıdan və To-do yaddaşından silinəcək. Audit qeydində yalnız silmə əməliyyatı qalacaq.</p></div><div class="actions"><button type="button" class="secondary" id="todoDeleteCancel" onclick="closeModal()">Ləğv et</button><button type="button" class="todo-delete-confirm" onclick="window.todoHub.delete('${escText(todo.id)}')">Tapşırığı sil</button></div>`);
    setTimeout(() => document.querySelector("#todoDeleteCancel")?.focus(), 0);
  }

  function deleteTodo(id) {
    const todos = ensureTodos();
    const index = todos.findIndex(item => item.id === id);
    if (index < 0) return;
    const [todo] = todos.splice(index, 1);
    audit("TODO_DELETE", todo.title);
    closeModal();
    render();
    toast("Tapşırıq silindi");
  }

  function setFilter(next) {
    activeFilter = FILTERS[next] ? next : "open";
    localStorage.setItem(STORAGE_KEY, activeFilter);
    render();
  }

  function installRender() {
    const previousRender = render;
    render = function () {
      installNavigation();
      if (page === "todos") {
        document.querySelector("#root").innerHTML = todoPage();
        nav();
        refreshTodoNav();
        document.title = "To-do · AzPlom";
        return;
      }
      previousRender();
      refreshTodoNav();
    };
  }

  function start() {
    ensureTodos();
    installNavigation();
    installRender();
    refreshTodoNav();
    window.todoHub = { open: openTodo, save: saveTodo, openBatch: openBatchTodo, addBatchRow, removeBatchRow, saveBatch: saveBatchTodos, syncAllRecipients, selectRecipient, toggle: toggleTodo, confirmDelete: confirmDeleteTodo, delete: deleteTodo, filter: setFilter, exportExcel, exportPdf };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
