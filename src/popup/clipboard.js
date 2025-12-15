import { setStatus } from "./ui.js";

export async function readFromClipboardIfEmpty(textarea) {
  let txt = (textarea?.value || "").trim();
  if (txt) return txt;

  if (!navigator.clipboard?.readText) {
    setStatus("Clipboard API not available – please paste manually (Ctrl+V).", "error");
    return "";
  }

  try {
    setStatus("Reading clipboard …", "info");
    txt = ((await navigator.clipboard.readText()) || "").trim();

    if (txt) {
      textarea.value = txt;
      setStatus("Clipboard imported.", "ok");
      return txt;
    }

    setStatus("Clipboard is empty – please paste a JLohn line.", "error");
    return "";
  } catch (e) {
    console.error("Clipboard error:", e);
    setStatus("Clipboard read failed – please paste manually.", "error");
    return "";
  }
}
