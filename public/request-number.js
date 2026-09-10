/* Optional manual SR / PR number on request creation. */
(() => {
  "use strict";
  const safeNumber = value => String(value || "").trim().toUpperCase();
  const generatedNumber = () => `SR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

  window.openRequest = (prefill = {}) => {
    modal(`<h2>Yeni sorğu</h2><p class="muted">Sorğunu yaradın; sonradan eyni sorğuya yeni məhsul əlavə edə bilərsiniz.</p><form id="requestForm" class="form"><div class="field"><label>Sorğu / PR nömrəsi</label><input name="requestNumber" value="${esc(prefill.requestNumber || "")}" placeholder="Boş buraxın — avtomatik yaradılacaq"></div><div class="field"><label>Müştəri</label><input name="customer" required value="${esc(prefill.customer || "")}" placeholder="ABC Construction"></div><div class="field"><label>Prioritet</label><select name="priority"><option>Normal</option><option>Yüksək</option><option>Təcili</option></select></div><div class="field full"><label>Məhsullar — hər sətir: ad | miqdar | vahid | alış | satış</label><textarea name="items" required placeholder="Bolt M12 | 5000 | ədəd | 0.13 | 0.18">${esc(prefill.items || "")}</textarea></div><div class="field full"><label>Qeyd</label><textarea name="note">${esc(prefill.note || "")}</textarea></div><div class="field"><label>Başlanğıc status</label><select name="status"><option value="NEW">Yeni</option><option value="PRICING">Qiymət hazırlanır</option></select></div></form><div class="actions"><button class="secondary" onclick="closeModal()">Ləğv et</button><button class="primary" onclick="saveRequest()">Sorğunu yarat</button></div>`);
  };

  window.saveRequest = () => {
    const values = Object.fromEntries(new FormData($("#requestForm")));
    const items = values.items.split("\n").filter(Boolean).map(line => {
      const [name, quantity, unit, cost, sale] = line.split("|").map(value => value.trim());
      return { name, qty: Number(quantity), unit: unit || "ədəd", cost: Number(cost) || 0, sale: Number(sale) || 0 };
    });
    if (!values.customer || !items.length || items.some(item => !item.name || !item.qty)) return toast("Müştəri və düzgün məhsul sətirləri məcburidir.");

    const manualNumber = safeNumber(values.requestNumber);
    if (manualNumber && !/^[A-Z0-9][A-Z0-9._/-]{0,49}$/.test(manualNumber)) return toast("Sorğu / PR nömrəsində yalnız hərf, rəqəm, -, _, / və . istifadə edin.");
    const id = manualNumber || generatedNumber();
    if (db.requests.some(request => String(request.id).toUpperCase() === id)) return toast("Bu sorğu / PR nömrəsi artıq istifadə olunub.");

    db.requests.unshift({ id, customer: values.customer, items, status: values.status, priority: values.priority, note: values.note, created: "İndi", timeline: [manualNumber ? "Sorğu əl ilə verilmiş nömrə ilə yaradıldı" : "Sorğu yaradıldı"] });
    if (!db.customers.includes(values.customer)) db.customers.push(values.customer);
    audit("CREATE", id); save(); closeModal(); page = "requests"; render(); toast(`${id} yaradıldı`);
  };
})();
