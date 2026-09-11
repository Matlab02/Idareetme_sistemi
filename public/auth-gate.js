/* One login entry for the ERP. Only SUPERADMIN and ADMIN accounts are supported. */
(()=>{
  const STORE='erp-superadmin-v1',SESSION='erp-auth-session',ADMIN_HASH='bf773b03170fb8601ce0b3e87564d15e205c648ddd40893baa2db793305eb839';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[x]));
  const hash=async value=>{const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')};
  const apiLogin=async(username,password)=>{try{const res=await fetch('api/auth.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const data=await res.json();if(res.ok&&data?.token)return data}catch{}return null};
  const installLiveBridge = () => {
    const endpoint = "api/erp-state.php";
    const token = () => { try { return JSON.parse(sessionStorage.getItem(SESSION) || "null")?.token || ""; } catch { return ""; } };
    const headers = () => { const value = token(); return value ? { Authorization: `Bearer ${value}` } : null; };
    let latestState = "";
    let persistPending = 0;
    let persistQueue = Promise.resolve();
    const bundledRequestIds = new Set(["SR-2026-00123", "SR-2026-00124", "SR-2026-00125"]);
    const stateFingerprint = (state) => {
      try { return JSON.stringify(state); } catch { return ""; }
    };

    // State refreshes may happen when a native file selector closes.  Keep an
    // already-open request detail view open instead of falling back to Dashboard.
    const renderCurrentView = () => {
      const match = location.hash.match(/^#request=(.+)$/);
      const requestId = match ? decodeURIComponent(match[1]) : "";
      const exists = requestId && Array.isArray(db?.requests) && db.requests.some((request) => request.id === requestId);
      const isViewingRequest = typeof page !== "undefined" && page === "request-detail" && Boolean(document.querySelector("#backRequests"));
      // A user may be editing an official document spreadsheet. Do not replace
      // their unsaved cells when another user updates the shared ERP state.
      if (typeof page !== "undefined" && page === "official-document") return;
      if (exists && isViewingRequest && typeof window.openRequestWorkspace === "function") {
        window.openRequestWorkspace(requestId);
        return;
      }
      if (typeof render === "function") render();
    };

    const loadState = async () => {
      const currentHeaders = headers();
      if (!currentHeaders) return { ok: false, reason: "NO_SESSION" };
      if (persistPending) return { ok: true, deferred: true, reason: "PERSIST_PENDING" };
      try {
        const res = await fetch(`${endpoint}?_=${Date.now()}`, { headers: currentHeaders, cache: "no-store" });
        const data = await res.json();
        if (!res.ok) return { ok: false, error: data?.error || "STATE_LOAD_FAILED" };
        if (data?.state && typeof db !== "undefined") {
          const nextState = stateFingerprint(data.state);
          if (nextState && nextState === latestState) return { ok: true, unchanged: true };
          // A native file picker temporarily moves focus away from the page.
          // Do not hydrate over an open request workspace at that moment: it
          // would rebuild the form before its change event can save the file.
          // The next list/detail visit refreshes the shared state safely.
          const editingRequest = typeof page !== "undefined" && page === "request-detail" && Boolean(document.querySelector("#backRequests"));
          const editingOfficialDocument = typeof page !== "undefined" && page === "official-document";
          if (editingRequest || editingOfficialDocument) return { ok: true, deferred: true };
          db = data.state;
          window.db = db;
          latestState = nextState;
          localStorage.setItem("erp-prototype-v2", JSON.stringify(db));
          renderCurrentView();
          window.dispatchEvent(new Event("erp-state-loaded"));
          return { ok: true, updated: true };
        }
        return { ok: true, empty: true };
      } catch { return { ok: false, error: "NETWORK_ERROR" }; }
    };

    window.erpLoadState = loadState;
    window.erpReconcileLocalState = async () => {
      const currentHeaders = headers();
      const localRequests = Array.isArray(typeof db !== "undefined" ? db?.requests : null) ? db.requests : [];
      if (!currentHeaders || !localRequests.length) return { ok: true, added: 0 };
      try {
        const response = await fetch(`${endpoint}?_=${Date.now()}`, { headers: currentHeaders, cache: "no-store" });
        const remote = await response.json().catch(() => ({}));
        if (!response.ok || !remote?.state || !Array.isArray(remote.state.requests)) return { ok: false, added: 0 };
        const knownIds = new Set(remote.state.requests.map((request) => String(request?.id || "")));
        const missing = localRequests.filter((request) => request?.id && !bundledRequestIds.has(request.id) && !knownIds.has(String(request.id)));
        if (!missing.length) return { ok: true, added: 0 };
        const state = { ...remote.state, requests: [...missing, ...remote.state.requests] };
        const saved = await fetch(endpoint, { method: "POST", headers: { ...currentHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
        if (!saved.ok) return { ok: false, added: 0 };
        latestState = "";
        return { ok: true, added: missing.length };
      } catch { return { ok: false, added: 0 }; }
    };
    window.erpPersist = (state) => {
      const currentHeaders = headers();
      if (!currentHeaders) return Promise.resolve({ ok: false, reason: "NO_SESSION" });
      const snapshot = typeof structuredClone === "function" ? structuredClone(state) : JSON.parse(JSON.stringify(state));
      persistPending += 1;
      persistQueue = persistQueue.catch(() => undefined).then(async () => {
        try {
          const res = await fetch(endpoint, { method: "POST", headers: { ...currentHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ state: snapshot }) });
          const data = await res.json().catch(() => ({}));
          // The following refresh compares the actual state rather than a timestamp.
          // This prevents same-second edits by different users from being missed.
          latestState = "";
          return { ok: res.ok, ...data };
        } catch { return { ok: false, error: "NETWORK_ERROR" }; }
        finally { persistPending = Math.max(0, persistPending - 1); }
      });
      return persistQueue;
    };
    window.addEventListener("focus", () => { void loadState(); });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void loadState(); });
    setInterval(() => { if (document.visibilityState === "visible") void loadState(); }, 2000);
  };
  installLiveBridge();
  const read=()=>{let s;try{s=JSON.parse(localStorage.getItem(STORE)||'null')}catch{}if(!s||!Array.isArray(s.users))s={users:[{id:'u-superadmin',name:'Sami',username:'Sami',role:'SUPERADMIN',passwordHash:ADMIN_HASH,createdAt:'29.08.2026'}],activity:[]};s.users.forEach(u=>{if(u.role!=='SUPERADMIN')u.role='ADMIN'});if(!s.users.some(u=>u.username?.toLowerCase()==='sami'))s.users.unshift({id:'u-superadmin',name:'Sami',username:'Sami',role:'SUPERADMIN',passwordHash:ADMIN_HASH,createdAt:'29.08.2026'});localStorage.setItem(STORE,JSON.stringify(s));return s};
  const styles=()=>{if(document.getElementById('authGateStyles'))return;const s=document.createElement('style');s.id='authGateStyles';s.textContent='.auth-gate{min-height:100vh;display:grid;place-items:center;padding:25px;background:radial-gradient(circle at 8% 0%,#e4efff 0,transparent 38%),radial-gradient(circle at 92% 100%,#eee7ff 0,transparent 35%),var(--bg)}.auth-card{width:min(430px,100%);padding:36px;border:1px solid #fff;border-radius:23px;background:#fffffff2;box-shadow:0 18px 55px #1527461a}.auth-mark{width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg,#276fe9,#6742bb);color:#fff;font-weight:800;font-size:21px}.auth-card .eyebrow{margin-top:24px}.auth-card h1{margin:6px 0 8px}.auth-card p{color:var(--muted);line-height:1.55;margin:0 0 22px}.auth-field{display:grid;gap:7px;margin-bottom:14px}.auth-field label{font-size:12px;font-weight:700;color:#526078}.auth-field input{padding:12px;border:1px solid #d9e2ee;border-radius:10px;font:inherit}.auth-field input:focus{outline:0;border-color:#7ea8f4;box-shadow:0 0 0 3px #dceaff}.auth-error{min-height:19px;color:#c43d51;font-size:12px;font-weight:650;margin-bottom:9px}.auth-submit{width:100%;padding:12px;border:0;border-radius:10px;background:var(--ink);color:#fff;font-weight:750}.auth-caption{font-size:11px!important;text-align:center;margin:16px 0 0!important;color:#8a97aa!important}.auth-logout{margin-left:8px}.super-nav-item{color:#7042be!important;background:#faf7ff!important}.dark .auth-gate{background:radial-gradient(circle at 8% 0%,#1d3255 0,transparent 38%),var(--bg)}.dark .auth-card{background:#142035;border-color:#2c3a51}.dark .auth-field input{background:#18263d;color:var(--ink);border-color:#35445d}';document.head?.append(s)};
  const loadModern=()=>{if(document.querySelector('link[data-modern-runtime]'))return;const boot=document.createElement('style');boot.dataset.brandBoot='1';boot.textContent='.brand .logo,.auth-mark{background:#fff!important;overflow:hidden!important;color:transparent!important}.brand .logo{width:44px!important;height:44px!important;flex:0 0 44px!important;aspect-ratio:1/1!important}.auth-mark{width:46px!important;height:46px!important}.brand .logo img,.auth-mark img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;padding:4px}';document.head?.append(boot);const link=document.createElement('link');link.rel='stylesheet';link.dataset.modernRuntime='1';link.href='modern-ui.css?v=5';document.head?.append(link);const brand=document.createElement('link');brand.rel='stylesheet';brand.dataset.brandRuntime='1';brand.href='brand-overrides.css?v=3';document.head?.append(brand);if(!document.querySelector('link[href*="design-system.css"]')){const system=document.createElement('link');system.rel='stylesheet';system.dataset.designSystemRuntime='1';system.href='design-system.css?v=figma1';document.head?.append(system)}};
  const refreshBrand=who=>{document.querySelectorAll('.brand').forEach(brand=>{const logo=brand.querySelector('.logo');if(logo&&!logo.querySelector('img')){logo.classList.add('brand-logo');logo.innerHTML='<img src="https://azplom.com/assets/logo.png" alt="AzPlom loqosu">'}const title=brand.querySelector('b');if(title)title.textContent='AzPlom';const sub=brand.querySelector('small');if(sub)sub.textContent='Azplomun gələcəyi sənsən';let user=brand.querySelector('.brand-user');if(!user){user=document.createElement('span');user.className='brand-user';sub?.after(user)}user.textContent=who?.username?`${who.username}`:'İstifadəçi adı'});document.querySelectorAll('.auth-mark').forEach(mark=>{mark.classList.add('brand-logo');mark.innerHTML='<img src="https://azplom.com/assets/logo.png" alt="AzPlom loqosu">'})};
  const gate=()=>{if(document.getElementById('authGate'))return;const el=document.createElement('section');el.id='authGate';el.className='auth-gate';el.innerHTML='<div class="auth-card"><div class="auth-mark">T</div><div class="eyebrow">AZPLOM · İDARƏETMƏ SİSTEMİ</div><h1>Giriş</h1><p>Superadmin və admin hesabınızla bütün idarəetmə sisteminə daxil olun.</p><form id="authForm"><div class="auth-field"><label for="authUser">İstifadəçi adı</label><input id="authUser" name="username" autocomplete="username" required></div><div class="auth-field"><label for="authPass">Şifrə</label><input id="authPass" name="password" type="password" autocomplete="current-password" required></div><div id="authError" class="auth-error" role="alert"></div><button class="auth-submit" type="submit">Sistemə daxil ol</button></form><p class="auth-caption">Hesab və şifrə bərpası yalnız Superadmin panelindən edilir.</p></div>';document.body.prepend(el)};
  const session=()=>{try{const raw=sessionStorage.getItem(SESSION),legacy=sessionStorage.getItem('erp-superadmin-session');if(raw==='1'||legacy==='1')return{id:'u-superadmin',username:'Sami',role:'SUPERADMIN',name:'Sami'};return JSON.parse(raw||'null')}catch{return null}};
  const setNav=who=>{const nav=document.querySelector('.nav');if(!nav)return;let item=nav.querySelector('[data-page="superusers"]');if(who?.role==='SUPERADMIN'){if(!item){item=document.createElement('button');item.type='button';item.dataset.page='superusers';item.className='super-nav-item';item.textContent='♙  İstifadəçilər';nav.append(item);item.addEventListener('click',()=>{document.querySelectorAll('.nav button[data-page]').forEach(b=>b.classList.toggle('active',b===item));if(typeof window.superusers==='function')document.querySelector('#root').innerHTML=window.superusers()})}}else if(item)item.remove();const avatar=document.querySelector('.avatar');if(avatar)avatar.textContent=who?.role==='SUPERADMIN'?'SA':'AD';const existing=document.querySelector('.auth-logout');if(!existing){const btn=document.createElement('button');btn.type='button';btn.className='ghost auth-logout';btn.textContent='Çıxış';btn.addEventListener('click',()=>{sessionStorage.removeItem(SESSION);sessionStorage.removeItem('erp-superadmin-session');location.reload()});document.querySelector('.top')?.append(btn)}};
  const setTopLink=who=>{let link=document.querySelector('.super-top-link');if(who?.role==='SUPERADMIN'){if(!link){link=document.createElement('button');link.type='button';link.className='ghost super-top-link';link.textContent='♙ İstifadəçilər';link.addEventListener('click',()=>{if(typeof window.superusers==='function')document.querySelector('#root').innerHTML=window.superusers()});document.querySelector('.top')?.prepend(link)}}else if(link)link.remove()};
  const show=()=>{const who=session();const app=document.querySelector('.app'),g=document.getElementById('authGate');refreshBrand(who);if(!who){if(app)app.style.display='none';if(g)g.style.display='grid';return}if(app)app.style.display='';if(g)g.style.display='none';setNav(who);setTopLink(who);refreshBrand(who);if(typeof window.render==='function')window.render();if(location.hash==='#superadmin'&&who.role==='SUPERADMIN'&&typeof window.superusers==='function')document.querySelector('#root').innerHTML=window.superusers()};
  document.addEventListener('DOMContentLoaded',()=>{loadModern();styles();gate();read();if(typeof window.superusers!=='function'){const module=document.createElement('script');module.src='superadmin-users.js?v=sa-users9';document.head.append(module)}const form=document.getElementById('authForm');form.addEventListener('submit',async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(form)),username=String(v.username||'').trim(),password=String(v.password||''),api=await apiLogin(username,password);if(api){sessionStorage.setItem(SESSION,JSON.stringify({id:api.uid||username,username:api.username||username,role:username.toLowerCase()==='sami'?'SUPERADMIN':'ADMIN',name:api.username||username,token:api.token}));const reconciliation=await window.erpReconcileLocalState?.();show();window.dispatchEvent(new Event('erp-session-ready'));await window.erpLoadState?.();if(reconciliation?.added)toast(`${reconciliation.added} lokal sorğu server bazasına köçürüldü.`);return}const localOnly=['localhost','127.0.0.1'].includes(location.hostname)||location.protocol==='file:';if(!localOnly){document.getElementById('authError').textContent='Server girişi təsdiqlənmədi. İstifadəçi adı və şifrəni yoxlayın.';return}const s=read(),u=s.users.find(x=>x.username?.toLowerCase()===username.toLowerCase());if(!u||await hash(password)!==u.passwordHash){document.getElementById('authError').textContent='İstifadəçi adı və ya şifrə yanlışdır.';return}sessionStorage.setItem(SESSION,JSON.stringify({id:u.id,username:u.username,role:u.role,name:u.name}));show()});show();if(session()?.token)void(async()=>{const reconciliation=await window.erpReconcileLocalState?.();await window.erpLoadState?.();if(reconciliation?.added)toast(`${reconciliation.added} lokal sorğu server bazasına köçürüldü.`)})()});
})();
