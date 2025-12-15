export function setStatus(text, type = "info") {
  const el = document.getElementById("status");
  if (!el) return;

  el.textContent = text || "";
  el.classList.remove("ok", "error", "info");
  el.classList.add(type === "ok" ? "ok" : type === "error" ? "error" : "info");
}

export function clearStatus() {
  setStatus("", "info");
}

export function setBusy(isBusy) {
  for (const id of ["btnClipboard", "btnFill", "btnTransform", "btnFillKeyed"]) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!isBusy;
  }
}
