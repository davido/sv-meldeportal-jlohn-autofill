export function setStatus(text, type = "info") {
  const el = document.getElementById("status");
  if (!el) return;

  el.textContent = text || "";
  el.classList.remove("ok", "warn", "error", "info");

  if (type === "ok") el.classList.add("ok");
  else if (type === "warn") el.classList.add("warn");
  else if (type === "error") el.classList.add("error");
  else el.classList.add("info");
}

export function clearStatus() {
  setStatus("", "info");
}

export function setBusy(isBusy) {
  // keyed-only popup buttons
  for (const id of ["btnClipboard", "btnFillKeyed"]) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!isBusy;
  }
}
