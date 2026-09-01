/* Live persistence bridge for the static ERP panel. Falls back to localStorage during local development. */
(()=>{
  const endpoint='api/erp-state.php',sessionKey='erp-auth-session';
  const token=()=>{try{return JSON.parse(sessionStorage.getItem(sessionKey)||'null')?.token||''}catch{return''}};
  const headers=()=>{const t=token();return t?{Authorization:`Bearer ${t}`}:null};
  const hydrate=async()=>{const h=headers();if(!h)return;try{const res=await fetch(endpoint,{headers:h,cache:'no-store'});if(!res.ok)return;const data=await res.json();if(data?.state&&typeof db!=='undefined'){db=data.state;localStorage.setItem('erp-prototype-v2',JSON.stringify(db));if(typeof render==='function')render()}}catch{}}
  window.erpPersist=state=>{const h=headers();if(!h)return;fetch(endpoint,{method:'POST',headers:{...h,'Content-Type':'application/json'},body:JSON.stringify({state})}).catch(()=>{})};
  document.addEventListener('DOMContentLoaded',hydrate);
})();
