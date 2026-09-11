/* Server-backed To-do workflow. Only ERP users can receive and act on tasks. */
(() => {
  "use strict";

  const filters = { all: "Bütün", pending: "Göndərilən", accepted: "Qəbul edilən", progress: "İcra edilən", completed: "Tamamlanan" };
  const statusMeta = {
    PENDING: { label: "Göndərildi", className: "pending", next: "ACCEPTED", action: "Qəbul etdim" },
    ACCEPTED: { label: "Qəbul edildi", className: "accepted", next: "IN_PROGRESS", action: "İcra edirəm" },
    IN_PROGRESS: { label: "İcra edilir", className: "progress", next: "COMPLETED", action: "Tamamla" },
    COMPLETED: { label: "Tamamlandı", className: "completed", next: "PENDING", action: "Yenidən aç" }
  };
  let activeFilter = localStorage.getItem("azplom-live-todo-filter") || "all";
  let todos = [];
  let directory = [];
  let loading = false;
  let initialized = false;
  const escText = value => (typeof esc === "function" ? esc(value) : String(value ?? ""));
  const session = () => { try { return JSON.parse(sessionStorage.getItem("erp-auth-session") || "null"); } catch { return null; } };
  const api = async (method = "GET", body) => {
    const current = session();
    if (!current?.token) throw new Error("Giriş sessiyası tapılmadı. Yenidən daxil olun.");
    const response = await fetch("api/todos.php", { method, headers: { Authorization: `Bearer ${current.token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "To-do əməliyyatı yerinə yetirilə bilmədi.");
    return data;
  };
  const status = todo => statusMeta[todo.status] || statusMeta.PENDING;
  const recipientLabel = todo => Array.isArray(todo.recipients) && todo.recipients.includes("ALL") ? "Bütün ERP istifadəçiləri" : (todo.recipients || []).join(", ");
  const dateLabel = value => value ? new Intl.DateTimeFormat("az-AZ", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T00:00:00`)) : "Tarix təyin edilməyib";

  const currentTodos = () => todos.filter(todo => activeFilter === "all" || activeFilter === "pending" && todo.status === "PENDING" || activeFilter === "accepted" && todo.status === "ACCEPTED" || activeFilter === "progress" && todo.status === "IN_PROGRESS" || activeFilter === "completed" && todo.status === "COMPLETED");
  const count = key => key === "all" ? todos.length : currentStatusCount(key);
  const currentStatusCount = key => ({ pending: "PENDING", accepted: "ACCEPTED", progress: "IN_PROGRESS", completed: "COMPLETED" })[key] ? todos.filter(todo => todo.status === ({ pending: "PENDING", accepted: "ACCEPTED", progress: "IN_PROGRESS", completed: "COMPLETED" })[key]).length : 0;

  function card(todo) {
    const meta = status(todo);
    const controls = [];
    if (todo.isRecipient) controls.push(`<button type="button" class="todo-live-action ${meta.className}" onclick="window.liveTodo.status('${escText(todo.id)}','${meta.next}')">${meta.action}</button>`);
    if (todo.isCreator) controls.push(`<button type="button" class="todo-live-delete" onclick="window.liveTodo.remove('${escText(todo.id)}')">Sil</button>`);
    return `<article class="todo-card todo-live-card ${meta.className}">
      <div class="todo-card-main"><div class="todo-card-topline"><span class="todo-priority ${todo.priority === "Təcili" ? "urgent" : todo.priority === "Yüksək" ? "high" : "normal"}">${escText(todo.priority)}</span><span class="todo-live-badge ${meta.className}">${meta.label}</span></div>
      <h2>${escText(todo.title)}</h2>${todo.note ? `<p>${escText(todo.note)}</p>` : ""}
      <div class="todo-meta"><span>${todo.requestId ? `Sorğu: ${escText(todo.requestId)}` : "Ümumi əməliyyat"}</span><span>Alıcı: ${escText(recipientLabel(todo))}</span><span>Yaradan: ${escText(todo.createdBy)}</span>${todo.acceptedBy ? `<span class="todo-live-accepted">Qəbul edən: ${escText(todo.acceptedBy)}</span>` : ""}<span>${dateLabel(todo.dueDate)}</span></div></div>
      <div class="todo-card-actions">${controls.join("") || "<span class=\"todo-live-readonly\">İzləmə rejimi</span>"}</div></article>`;
  }

  function pageContent() {
    const visible = currentTodos();
    const filterHtml = Object.entries(filters).map(([key, label]) => `<button type="button" class="todo-filter ${activeFilter === key ? "active" : ""}" onclick="window.liveTodo.filter('${key}')">${label}<span>${count(key)}</span></button>`).join("");
    const body = loading ? `<div class="todo-empty"><div class="todo-empty-mark">…</div><h2>Tapşırıqlar yenilənir</h2><p>ERP tapşırıqları serverdən alınır.</p></div>` : visible.map(card).join("") || `<div class="todo-empty"><div class="todo-empty-mark">✓</div><h2>Bu statusda tapşırıq yoxdur</h2><p>Yeni tapşırıq yaradın və onu ERP istifadəçisinə göndərin.</p><button type="button" class="primary" onclick="window.liveTodo.open()">＋ Yeni tapşırıq</button></div>`;
    return shell("To-do", "Yalnız ERP istifadəçiləri üçün tapşırıqlar, cavablar və icra mərhələləri.", `<div class="todo-head-actions"><button type="button" class="secondary" onclick="window.liveTodo.refresh()">↻ Yenilə</button><button type="button" class="secondary" onclick="window.liveTodo.print()">⎙ Çap et</button><button type="button" class="secondary" onclick="window.liveTodo.exportPdf()">↓ PDF</button><button type="button" class="secondary" onclick="window.liveTodo.exportExcel()">↓ Excel</button><button type="button" class="secondary todo-batch-trigger" onclick="window.liveTodo.openBatch()">☷ Bir neçə tapşırıq</button><button type="button" class="primary todo-create" onclick="window.liveTodo.open()">＋ Yeni tapşırıq</button></div>`) + `<section class="todo-summary"><div class="todo-summary-card"><span>Göndərilən</span><strong>${currentStatusCount("pending")}</strong><small>Qəbul gözləyir</small></div><div class="todo-summary-card today"><span>Qəbul edilən</span><strong>${currentStatusCount("accepted")}</strong><small>Sahibi təyin olunub</small></div><div class="todo-summary-card overdue"><span>İcra edilir</span><strong>${currentStatusCount("progress")}</strong><small>İş prosesindədir</small></div><div class="todo-summary-card complete"><span>Tamamlanan</span><strong>${currentStatusCount("completed")}</strong><small>Bağlanmış işlər</small></div></section><section class="todo-workspace"><div class="todo-filterbar" role="group" aria-label="Tapşırıq status filtrləri">${filterHtml}</div><div class="todo-list" aria-live="polite">${body}</div></section></div>`;
  }

  async function loadDirectory() {
    const current = session();
    if (!current?.token) return [];
    const response = await fetch("api/erp-users.php", { headers: { Authorization: `Bearer ${current.token}` }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    directory = response.ok && Array.isArray(data?.users) ? data.users : [];
    return directory;
  }
  async function refresh({ paint = true } = {}) {
    loading = true; if (paint && typeof render === "function" && page === "todos") render();
    try { const data = await api(); todos = Array.isArray(data?.todos) ? data.todos : []; db.todos = todos; }
    catch (error) { todos = []; toast(error.message || "Tapşırıqlar yüklənmədi."); }
    finally { loading = false; if (paint && typeof render === "function" && page === "todos") render(); }
  }
  async function open() {
    try { await loadDirectory(); } catch (error) { return toast("ERP istifadəçi siyahısı yüklənmədi."); }
    const choices = directory.map(user => `<label class="todo-recipient-choice"><input type="checkbox" name="recipients" value="${escText(user.username)}" onchange="window.liveTodo.singleRecipient(this)"><span>${escText(user.name)}</span><small>@${escText(user.username)}</small></label>`).join("");
    modal(`<div class="todo-modal-heading"><span>ERP İŞ PLANI</span><h2>Yeni tapşırıq</h2><p>Tapşırıq yalnız seçdiyiniz ERP istifadəçilərinə görünəcək.</p></div><form id="liveTodoForm" class="form" novalidate><div class="field full"><label for="liveTodoTitle">Tapşırığın adı</label><input id="liveTodoTitle" name="title" maxlength="220" required placeholder="Məsələn: Təchizatçı qiymətini təsdiqlə"></div><div class="field"><label for="liveTodoRequest">Əlaqəli sorğu</label><input id="liveTodoRequest" name="requestId" placeholder="SR-2026-00125"></div><div class="field"><label for="liveTodoPriority">Prioritet</label><select id="liveTodoPriority" name="priority"><option>Təcili</option><option>Yüksək</option><option selected>Normal</option><option>Aşağı</option></select></div><fieldset class="field full todo-recipient-field"><legend>Göndəriləcək ERP istifadəçiləri</legend><div class="todo-recipient-list"><label class="todo-recipient-choice all"><input type="checkbox" name="recipients" value="ALL" checked onchange="window.liveTodo.allRecipients(this)"><span>Bütün ERP istifadəçiləri</span></label>${choices}</div><small>Saytın digər adminləri bu siyahıda görünmür.</small></fieldset><div class="field"><label for="liveTodoDate">Son tarix</label><input id="liveTodoDate" name="dueDate" type="date"></div><div class="field full"><label for="liveTodoNote">Qeyd</label><textarea id="liveTodoNote" name="note" maxlength="3000" placeholder="Nəticə və ya növbəti addım..."></textarea></div><p id="liveTodoError" class="todo-form-error" role="alert"></p></form><div class="actions"><button type="button" class="secondary" onclick="closeModal()">Ləğv et</button><button type="button" class="primary" id="liveTodoSave" onclick="window.liveTodo.create()">Göndər</button></div>`);
    setTimeout(() => document.querySelector("#liveTodoTitle")?.focus(), 0);
  }
  function allRecipients(input) { if (input.checked) document.querySelectorAll('#liveTodoForm input[name="recipients"]:not([value="ALL"])').forEach(item => item.checked = false); }
  function singleRecipient(input) { if (input.checked) { const all = document.querySelector('#liveTodoForm input[name="recipients"][value="ALL"]'); if (all) all.checked = false; } }
  function selectedRecipients() { const values = [...new FormData(document.querySelector("#liveTodoForm")).getAll("recipients")].map(String); return values.includes("ALL") ? ["ALL"] : [...new Set(values)]; }
  async function create() {
    const form = document.querySelector("#liveTodoForm"), error = document.querySelector("#liveTodoError"), values = Object.fromEntries(new FormData(form)), recipients = selectedRecipients();
    if (!String(values.title || "").trim()) { error.textContent = "Tapşırığın adını yazın."; document.querySelector("#liveTodoTitle")?.focus(); return; }
    if (!recipients.length) { error.textContent = "Ən azı bir ERP istifadəçisi seçin."; return; }
    const button = document.querySelector("#liveTodoSave"); button.disabled = true; button.textContent = "Göndərilir…";
    try { const data = await api("POST", { action: "create", title: String(values.title).trim(), requestId: String(values.requestId || ""), priority: String(values.priority || "Normal"), dueDate: String(values.dueDate || ""), note: String(values.note || ""), recipients }); todos = data.todos || []; db.todos = todos; closeModal(); render(); toast("Tapşırıq ERP istifadəçilərinə göndərildi."); }
    catch (reason) { error.textContent = reason.message || "Tapşırıq göndərilə bilmədi."; button.disabled = false; button.textContent = "Göndər"; }
  }
  const requestOptions = () => (db.requests || []).map(request => `<option value="${escText(request.id)}">${escText(request.id)} · ${escText(request.customer)}</option>`).join("");
  const recipientOptions = () => `<option value="ALL">Bütün ERP istifadəçiləri</option>${directory.map(user => `<option value="${escText(user.username)}">${escText(user.name)} · @${escText(user.username)}</option>`).join("")}`;
  const batchRow = () => `<tr data-live-batch-row><td><input name="title" maxlength="220" aria-label="Tapşırığın adı" placeholder="Tapşırığı yazın"></td><td><select name="requestId" aria-label="Əlaqəli sorğu"><option value="">Ümumi</option>${requestOptions()}</select></td><td><select name="recipient" aria-label="Alıcı">${recipientOptions()}</select></td><td><select name="priority" aria-label="Prioritet"><option>Təcili</option><option>Yüksək</option><option selected>Normal</option><option>Aşağı</option></select></td><td><input name="dueDate" type="date" aria-label="Son tarix"></td><td><button type="button" class="todo-row-remove" aria-label="Sətiri sil" onclick="window.liveTodo.removeBatchRow(this)">×</button></td></tr>`;
  function updateBatchCount() {
    const count = [...document.querySelectorAll("#liveTodoBatchRows input[name=title]")].filter(input => input.value.trim()).length;
    const button = document.querySelector("#liveTodoBatchSave");
    if (button) button.textContent = count ? `${count} tapşırığı göndər` : "Tapşırıqları göndər";
  }
  async function openBatch() {
    try { await loadDirectory(); } catch { return toast("ERP istifadəçi siyahısı yüklənmədi."); }
    modal(`<div class="todo-modal-heading"><span>ERP İŞ PLANI</span><h2>Bir neçə tapşırıq</h2><p>Hər dolu sətir ayrıca tapşırıq kimi yaradılır. Alıcını hər sətirdə ayrıca seçə bilərsiniz.</p></div><form id="liveTodoBatchForm" novalidate><div class="todo-batch-wrap"><table class="todo-batch-table"><thead><tr><th>Tapşırıq</th><th>Sorğu</th><th>Alıcı</th><th>Prioritet</th><th>Son tarix</th><th><span class="sr-only">Sil</span></th></tr></thead><tbody id="liveTodoBatchRows">${batchRow()}${batchRow()}${batchRow()}</tbody></table></div><p id="liveTodoBatchError" class="todo-form-error" role="alert"></p></form><div class="todo-batch-actions"><button type="button" class="secondary" onclick="window.liveTodo.addBatchRow()">＋ Sətir əlavə et</button><div class="actions"><button type="button" class="secondary" onclick="closeModal()">Ləğv et</button><button type="button" class="primary todo-batch-save" id="liveTodoBatchSave" onclick="window.liveTodo.createBatch()">Tapşırıqları göndər</button></div></div>`);
    document.querySelector("#liveTodoBatchForm")?.addEventListener("input", updateBatchCount);
    setTimeout(() => document.querySelector("#liveTodoBatchRows input[name=title]")?.focus(), 0);
  }
  function addBatchRow() { document.querySelector("#liveTodoBatchRows")?.insertAdjacentHTML("beforeend", batchRow()); updateBatchCount(); }
  function removeBatchRow(button) {
    const row = button.closest("[data-live-batch-row]"), rows = document.querySelectorAll("#liveTodoBatchRows [data-live-batch-row]");
    if (!row) return;
    if (rows.length === 1) row.querySelectorAll("input").forEach(input => { input.value = ""; }); else row.remove();
    updateBatchCount();
  }
  async function createBatch() {
    const tasks = [...document.querySelectorAll("#liveTodoBatchRows [data-live-batch-row]")].map(row => ({ title: row.querySelector("[name=title]")?.value.trim() || "", requestId: row.querySelector("[name=requestId]")?.value || "", recipients: [row.querySelector("[name=recipient]")?.value || "ALL"], priority: row.querySelector("[name=priority]")?.value || "Normal", dueDate: row.querySelector("[name=dueDate]")?.value || "" })).filter(task => task.title);
    const error = document.querySelector("#liveTodoBatchError");
    if (!tasks.length) { if (error) error.textContent = "Ən azı bir tapşırıq yazın."; document.querySelector("#liveTodoBatchRows input[name=title]")?.focus(); return; }
    const button = document.querySelector("#liveTodoBatchSave"); button.disabled = true; button.textContent = "Göndərilir…";
    try { const data = await api("POST", { action: "create-batch", tasks }); todos = data.todos || []; db.todos = todos; closeModal(); render(); toast(`${tasks.length} tapşırıq ERP istifadəçilərinə göndərildi.`); }
    catch (reason) { if (error) error.textContent = reason.message || "Tapşırıqlar göndərilə bilmədi."; button.disabled = false; updateBatchCount(); }
  }
  const escapeExport = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
  const exportRows = () => currentTodos().map((todo, index) => ({
    number: index + 1,
    title: todo.title || "—",
    request: todo.requestId || "Ümumi əməliyyat",
    recipients: recipientLabel(todo),
    priority: todo.priority || "Normal",
    dueDate: dateLabel(todo.dueDate),
    state: status(todo).label,
    note: todo.note || "—",
    createdBy: todo.createdBy || "—",
    acceptedBy: todo.acceptedBy || "—",
    createdAt: todo.createdAt ? new Date(todo.createdAt).toLocaleString("az-AZ") : "—",
    completedAt: todo.completedAt ? new Date(todo.completedAt).toLocaleString("az-AZ") : "—"
  }));
  const exportStamp = () => new Date().toISOString().slice(0, 10);
  const recordExport = (action, total) => { if (typeof audit === "function") audit(action, `${filters[activeFilter]} · ${total} tapşırıq`); };
  function openPrintableList({ pdf = false } = {}) {
    const rows = exportRows();
    if (!rows.length) return toast("İxrac üçün bu filtrdə tapşırıq yoxdur.");
    const popup = window.open("", "_blank", "popup,width=1200,height=800");
    if (!popup) return toast("Çap pəncərəsi bloklanıb. Brauzerdə popup icazəsini açın.");
    const tableRows = rows.map(row => `<tr><td>${row.number}</td><td><b>${escapeExport(row.title)}</b>${row.note !== "—" ? `<small>${escapeExport(row.note)}</small>` : ""}</td><td>${escapeExport(row.request)}</td><td>${escapeExport(row.recipients)}</td><td>${escapeExport(row.priority)}</td><td>${escapeExport(row.dueDate)}</td><td>${escapeExport(row.state)}</td></tr>`).join("");
    const heading = pdf ? "To-do · PDF kimi yadda saxla" : "To-do siyahısı";
    popup.document.write(`<!doctype html><html lang="az"><head><meta charset="utf-8"><title>${heading}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#14243e;font-family:Arial,Helvetica,sans-serif}header{display:flex;justify-content:space-between;gap:18px;align-items:start;border-bottom:2px solid #075b93;padding-bottom:12px}header span{color:#0b78be;font-size:10px;font-weight:700;letter-spacing:.12em}h1{margin:5px 0;font-size:22px}p{margin:0;color:#687a94;font-size:11px}.meta{text-align:right;font-size:10px;color:#687a94}table{width:100%;margin-top:18px;border-collapse:collapse;font-size:10px}th{padding:8px;background:#075b93;color:#fff;text-align:left;font-size:9px;letter-spacing:.04em}td{padding:8px;border-bottom:1px solid #d8e6eb;vertical-align:top}td:first-child{width:28px;color:#687a94}td:nth-child(2){width:27%}td small{display:block;margin-top:3px;color:#687a94;font-weight:400}footer{margin-top:16px;color:#687a94;font-size:9px}</style></head><body><header><div><span>AZPLOM · İŞ PLANI</span><h1>To-do siyahısı</h1><p>${escapeExport(filters[activeFilter])} filtri üzrə ${rows.length} tapşırıq</p></div><div class="meta">Yaradılıb: ${escapeExport(new Date().toLocaleString("az-AZ"))}</div></header><table><thead><tr><th>№</th><th>Tapşırıq</th><th>Sorğu</th><th>Alıcı</th><th>Prioritet</th><th>Son tarix</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table><footer>AzPlom Təchizat İdarəetmə Sistemi</footer><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
    recordExport(pdf ? "TODO_EXPORT_PDF" : "TODO_PRINT", rows.length);
    if (pdf) toast("Çap pəncərəsində “PDF kimi yadda saxla” seçin.");
  }
  function printList() { openPrintableList(); }
  const xlsxColumn = index => { let value = ""; for (let number = index + 1; number; number = Math.floor((number - 1) / 26)) value = String.fromCharCode(65 + ((number - 1) % 26)) + value; return value; };
  function downloadFile(blob, filename) { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
  function zipWorkbook(entries) {
    const encoder = new TextEncoder(), chunks = [], central = []; let offset = 0;
    const add16 = (target, value) => target.push(value & 255, (value >>> 8) & 255), add32 = (target, value) => target.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
    entries.forEach(([name, text]) => { const content = encoder.encode(text), filename = encoder.encode(name), checksum = crc32(content), local = []; add32(local, 0x04034b50); add16(local, 20); add16(local, 0x0800); add16(local, 0); add16(local, 0); add16(local, 0); add32(local, checksum); add32(local, content.length); add32(local, content.length); add16(local, filename.length); add16(local, 0); local.push(...filename, ...content); chunks.push(new Uint8Array(local)); const record = []; add32(record, 0x02014b50); add16(record, 20); add16(record, 20); add16(record, 0x0800); add16(record, 0); add16(record, 0); add16(record, 0); add32(record, checksum); add32(record, content.length); add32(record, content.length); add16(record, filename.length); add16(record, 0); add16(record, 0); add16(record, 0); add16(record, 0); add32(record, 0); add32(record, offset); record.push(...filename); central.push(new Uint8Array(record)); offset += local.length; });
    const centralSize = central.reduce((sum, item) => sum + item.length, 0), end = []; add32(end, 0x06054b50); add16(end, 0); add16(end, 0); add16(end, entries.length); add16(end, entries.length); add32(end, centralSize); add32(end, offset); add16(end, 0);
    return new Blob([...chunks, ...central, new Uint8Array(end)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function exportExcel() {
    const rows = exportRows();
    if (!rows.length) return toast("İxrac üçün bu filtrdə tapşırıq yoxdur.");
    const headers = ["№", "Tapşırıq", "Sorğu", "Alıcı", "Prioritet", "Son tarix", "Status", "Qeyd", "Yaradan", "Qəbul edən", "Yaradılma vaxtı", "Tamamlanma vaxtı"];
    const values = rows.map(row => [row.number, row.title, row.request, row.recipients, row.priority, row.dueDate, row.state, row.note, row.createdBy, row.acceptedBy, row.createdAt, row.completedAt]);
    const widths = [7, 38, 22, 28, 14, 16, 16, 42, 18, 18, 22, 22];
    const cell = (column, row, value, header = false) => `<c r="${xlsxColumn(column)}${row}"${header ? ' s="1"' : ""} t="inlineStr"><is><t xml:space="preserve">${escapeExport(value)}</t></is></c>`;
    const sheetRows = [headers, ...values].map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, column) => cell(column, rowIndex + 1, value, rowIndex === 0)).join("")}</row>`).join("");
    const columns = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${columns}</cols><sheetData>${sheetRows}</sheetData></worksheet>`;
    const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="To-do" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF075B93"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`;
    downloadFile(zipWorkbook([["[Content_Types].xml", types], ["_rels/.rels", rels], ["xl/workbook.xml", workbook], ["xl/_rels/workbook.xml.rels", workbookRels], ["xl/styles.xml", styles], ["xl/worksheets/sheet1.xml", sheet]]), `azplom-todo-${exportStamp()}.xlsx`);
    recordExport("TODO_EXPORT_XLSX", rows.length);
    toast("Excel faylı endirildi.");
  }
  function exportPdf() { openPrintableList({ pdf: true }); }
  async function changeStatus(id, next) { try { const data = await api("POST", { action: "status", id, status: next }); todos = data.todos || []; db.todos = todos; render(); toast(`${statusMeta[next].label} olaraq qeydə alındı.`); } catch (error) { toast(error.message || "Status yenilənmədi."); } }
  async function remove(id) { const todo = todos.find(item => item.id === id); if (!todo) return; modal(`<div class="todo-delete-dialog"><span>GERİ DÖNÜŞ YOXDUR</span><h2>Tapşırıq silinsin?</h2><p><b>${escText(todo.title)}</b> tapşırığı yalnız siz yaratdığınız üçün silinə bilər.</p></div><div class="actions"><button type="button" class="secondary" id="liveTodoCancel" onclick="closeModal()">Ləğv et</button><button type="button" class="todo-delete-confirm" onclick="window.liveTodo.confirmRemove('${escText(id)}')">Tapşırığı sil</button></div>`); setTimeout(() => document.querySelector("#liveTodoCancel")?.focus(), 0); }
  async function confirmRemove(id) { try { const data = await api("POST", { action: "delete", id }); todos = data.todos || []; db.todos = todos; closeModal(); render(); toast("Tapşırıq silindi."); } catch (error) { toast(error.message || "Tapşırıq silinə bilmədi."); } }
  function setFilter(next) { activeFilter = filters[next] ? next : "all"; localStorage.setItem("azplom-live-todo-filter", activeFilter); render(); }
  function injectStyles() { if (document.querySelector("#todoLiveStyles")) return; const style = document.createElement("style"); style.id = "todoLiveStyles"; style.textContent = ".todo-live-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-size:11px;font-weight:800}.todo-live-badge.pending{background:#eef2f8;color:#63718a}.todo-live-badge.accepted{background:#e9f3ff;color:#1767ce}.todo-live-badge.progress{background:#fff3db;color:#a46b0a}.todo-live-badge.completed{background:#e7f8ef;color:#157752}.todo-live-action{border:0;border-radius:10px;padding:9px 12px;font:inherit;font-weight:800;cursor:pointer}.todo-live-action.pending{background:#1767ce;color:#fff}.todo-live-action.accepted{background:#f0eafd;color:#6738b8}.todo-live-action.progress{background:#e7f8ef;color:#157752}.todo-live-action.completed{background:#edf1f6;color:#526078}.todo-live-delete{border:1px solid #f0cbd2;border-radius:10px;padding:9px 12px;background:#fff;color:#c43d51;font:inherit;font-weight:800;cursor:pointer}.todo-live-accepted{color:#157752;font-weight:800}.todo-live-readonly{font-size:12px;color:var(--muted)}.todo-live-card{border-left:3px solid #d9e2ee}.todo-live-card.accepted{border-left-color:#58a5f0}.todo-live-card.progress{border-left-color:#e8b352}.todo-live-card.completed{border-left-color:#5bbf8b}"; document.head.append(style); }
  function install() {
    if (initialized) return; initialized = true; injectStyles(); const legacyRender = render;
    render = function () { if (page === "todos") { document.querySelector("#root").innerHTML = pageContent(); nav(); document.title = "To-do · AzPlom"; return; } legacyRender(); };
    const navItem = document.querySelector('[data-page="todos"]'); if (navItem) navItem.onclick = () => { page = "todos"; filter = ""; render(); void refresh(); };
    window.liveTodo = { open, create, openBatch, addBatchRow, removeBatchRow, createBatch, status: changeStatus, remove, confirmRemove, refresh, filter: setFilter, allRecipients, singleRecipient, print: printList, exportPdf, exportExcel };
    void refresh({ paint: false });
    window.addEventListener("erp-session-ready", () => { void refresh(); });
    window.addEventListener("focus", () => { if (page === "todos") void refresh(); });
    setInterval(() => { if (document.visibilityState === "visible" && page === "todos") void refresh(); }, 15000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true }); else install();
})();
