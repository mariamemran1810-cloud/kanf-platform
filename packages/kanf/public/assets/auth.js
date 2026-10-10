/* ظ…ظ†ط·ظ‚ طµظپط­طھظٹ ط§ظ„ط¯ط®ظˆظ„ ظˆط§ظ„طھط³ط¬ظٹظ„ */
(function () {
  const path = location.pathname;
  const isSignup = path.includes("signup");

  const errBox = document.getElementById("err");
  const form = document.getElementById("form");

  function showError(key) {
    if (!errBox) return;
    const lang = window.KanfLang.get();
    const map = {
      errorRequired: { ar: "ط¬ظ…ظٹط¹ ط§ظ„ط­ظ‚ظˆظ„ ظ…ط·ظ„ظˆط¨ط©", en: "All fields are required" },
      errorCredentials: { ar: "ط¨ظٹط§ظ†ط§طھ ط§ظ„ط¯ط®ظˆظ„ ط؛ظٹط± طµط­ظٹط­ط©", en: "Invalid credentials" },
      errorSuspended: { ar: "ط§ظ„ط­ط³ط§ط¨ ظ…ظˆظ‚ظˆظپ â€” ط±ط§ط¬ط¹ ط§ظ„ظ…ط´ط±ظپ", en: "Account suspended â€” contact an admin" },
      errorExists: { ar: "ط§ظ„ط¨ط±ظٹط¯ ظ…ط³ط¬ظ‘ظ„ ظ…ط³ط¨ظ‚ط§ظ‹", en: "Email already registered" },
      passwordShort: { ar: "ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ظٹط¬ط¨ ط£ظ† طھظƒظˆظ† ظ¨ ط£ط­ط±ظپ ظپط£ظƒط«ط±", en: "Password must be at least 8 characters" },
      offline: { ar: "طھط¹ط°ظ‘ط± ط§ظ„ط§طھطµط§ظ„ ط¨ط§ظ„ط®ط§ط¯ظ…", en: "Cannot reach the server" },
    };
    errBox.textContent = map[key]?.[lang] ?? key;
    errBox.style.display = "block";
  }

  async function submit(e) {
    e.preventDefault();
    errBox.style.display = "none";
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.email || !data.password || (isSignup && !data.name)) return showError("errorRequired");

    const url = isSignup ? "/api/auth/signup" : "/api/auth/login";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return showError(body.error || "errorCredentials");
      location.href = "/dashboard";
    } catch {
      showError("offline");
    }
  }

  form?.addEventListener("submit", submit);

  document.querySelectorAll("[data-email]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const email = btn.getAttribute("data-email");
      const f = form;
      f.email.value = email;
      f.password.value = "Kanf#2026";
      f.password.focus();
    });
  });

  // ط¹ظ†ط¯ ط§ظ„ظ†ط´ط± ظƒظ…ظˆظ‚ط¹ ط«ط§ط¨طھ (GitHub Pages) ظ„ط§ ظٹظˆط¬ط¯ ط®ط§ط¯ظ… ط®ظ„ظپ ط§ظ„ظˆط§ط¬ظ‡ط©
  fetch("/api/health")
    .then((r) => r.json())
    .catch(() => {
      const lang = window.KanfLang.get();
      const box = document.createElement("div");
      box.className = "banner";
      box.style.margin = "0 0 16px";
      box.innerHTML =
        lang === "ar"
          ? 'ًںŒگ <div><b>ظ†ط³ط®ط© ط§ظ„ظ…ظˆظ‚ط¹ ط§ظ„ط«ط§ط¨طھط©.</b> ط§ظ„ظ…ظ†طµط© ظ†ظپط³ظ‡ط§ طھط¹ظ…ظ„ ط¹ظ„ظ‰ ط¬ظ‡ط§ط²ظƒ: <span class="mono" dir="ltr">bun run --cwd packages/kanf dev</span></div>'
          : 'ًںŒگ <div><b>Static site copy.</b> Run the platform locally: <span class="mono" dir="ltr">bun run --cwd packages/kanf dev</span></div>';
      const card = document.querySelector(".auth-card");
      if (card) card.insertBefore(box, card.querySelector("h2"));
    });

  // ط¥ظ† ظƒط§ظ† ظ…ط³ط¬ظ‘ظ„ ط§ظ„ط¯ط®ظˆظ„ ظ…ط³ط¨ظ‚ط§ظ‹طŒ ط§ظ†طھظ‚ظ„ ظ„ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ…
  fetch("/api/me")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d?.user) location.href = "/dashboard";
    })
    .catch(() => {});
})();
