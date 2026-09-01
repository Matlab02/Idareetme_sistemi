(function () {
  "use strict";

  const routeTitles = {
    dash: "Dashboard",
    requests: "Sorğular",
    customers: "Müştərilər",
    products: "Məhsullar",
    suppliers: "Təchizatçılar",
    purchase: "Alış",
    sales: "Satış",
    stock: "Anbar",
    documents: "Sənədlər",
    mail: "Poçt",
    ai: "AI Mərkəzi",
    reports: "Hesabatlar",
    settings: "Parametrlər"
  };

  function enhanceSearch() {
    const input = document.querySelector("#globalSearch");
    if (!input || input.dataset.enhanced) return;
    input.dataset.enhanced = "true";
    input.setAttribute("aria-label", "Bütün sistemdə axtar");
    const shell = document.createElement("div");
    shell.className = "search-shell";
    input.parentNode.insertBefore(shell, input);
    shell.append(input);
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "search-clear";
    clear.setAttribute("aria-label", "Axtarışı təmizlə");
    clear.textContent = "×";
    clear.hidden = !input.value;
    clear.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      clear.hidden = true;
    });
    input.addEventListener("input", () => { clear.hidden = !input.value; });
    shell.append(clear);
  }

  function enhanceNavigation() {
    const menu = document.querySelector("#menu");
    const side = document.querySelector(".side");
    if (!menu || !side || menu.dataset.enhanced) return;
    menu.dataset.enhanced = "true";
    menu.setAttribute("aria-label", "Naviqasiyanı aç");
    menu.setAttribute("aria-expanded", "false");
    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "mobile-nav-backdrop";
    backdrop.setAttribute("aria-label", "Naviqasiyanı bağla");
    document.body.append(backdrop);
    const close = () => {
      document.body.classList.remove("nav-open");
      menu.setAttribute("aria-expanded", "false");
    };
    menu.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      menu.setAttribute("aria-expanded", String(open));
    });
    backdrop.addEventListener("click", close);
    side.addEventListener("click", (event) => {
      if (event.target.closest("button[data-page]") && matchMedia("(max-width: 900px)").matches) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
        close();
        menu.focus();
      }
    });
  }

  function enhanceLiveRegions() {
    const observer = new MutationObserver(() => {
      document.querySelectorAll(".toast:not([role])").forEach((toast) => {
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
      });
      document.querySelectorAll(".modal-bg:not([data-a11y])").forEach((backdrop) => {
        backdrop.dataset.a11y = "true";
        const modal = backdrop.querySelector(".modal");
        if (!modal) return;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.setAttribute("tabindex", "-1");
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function updateTitle() {
    const active = document.querySelector(".nav button.active[data-page]")?.dataset.page;
    document.title = `${routeTitles[active] || "İdarəetmə"} · AzPlom`;
  }

  function start() {
    enhanceSearch();
    enhanceNavigation();
    enhanceLiveRegions();
    updateTitle();
    document.querySelector(".nav")?.addEventListener("click", () => setTimeout(updateTitle));
    window.addEventListener("hashchange", updateTitle);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
