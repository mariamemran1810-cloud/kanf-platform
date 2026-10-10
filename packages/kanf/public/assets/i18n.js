/* تبديل اللغة (عربي/إنجليزي) + الثيم — يعمل على كل الصفحات */
(function () {
  const LANG_KEY = "kanf_lang";
  const THEME_KEY = "kanf_theme";

  function apply(lang) {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute("data-dir", dir);
    document.querySelectorAll("[data-ar]").forEach((el) => {
      const text = el.getAttribute(lang === "ar" ? "data-ar" : "data-en");
      if (text != null) el.textContent = text;
    });
    const ph = document.querySelectorAll("[data-ar-ph]");
    ph.forEach((el) => {
      const text = el.getAttribute(lang === "ar" ? "data-ar-ph" : "data-en-ph");
      if (text != null) el.setAttribute("placeholder", text);
    });
    document.querySelectorAll("[data-ar-title]").forEach((el) => {
      const text = el.getAttribute(lang === "ar" ? "data-ar-title" : "data-en-title");
      if (text != null) el.setAttribute("title", text);
    });
    const btn = document.getElementById("lang-btn");
    if (btn) btn.textContent = lang === "ar" ? "EN" : "ع";
    localStorage.setItem(LANG_KEY, lang);
    window.dispatchEvent(new CustomEvent("kanf:lang", { detail: lang }));
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-btn");
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
  }

  window.KanfLang = {
    get: () => localStorage.getItem(LANG_KEY) || "ar",
    set: (l) => apply(l),
    toggle: () => apply(window.KanfLang.get() === "ar" ? "en" : "ar"),
  };

  window.KanfTheme = {
    get: () => localStorage.getItem(THEME_KEY) || "light",
    set: (t) => applyTheme(t),
    toggle: () => applyTheme(window.KanfTheme.get() === "dark" ? "light" : "dark"),
  };

  document.addEventListener("DOMContentLoaded", () => {
    apply(window.KanfLang.get());
    applyTheme(window.KanfTheme.get());

    const langBtn = document.getElementById("lang-btn");
    if (langBtn) langBtn.addEventListener("click", () => window.KanfLang.toggle());

    const themeBtn = document.getElementById("theme-btn");
    if (themeBtn) themeBtn.addEventListener("click", () => window.KanfTheme.toggle());
  });

  // تُطبّق مبكراً حتى لا يظهر قفز في النصوص
  apply(window.KanfLang.get());
  applyTheme(window.KanfTheme.get());
})();
