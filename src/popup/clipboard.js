import { setStatus } from "./ui.js";

export async function readFromClipboardIfEmpty(textarea) {
  let txt = (textarea?.value || "").trim();
  if (txt) return txt;

  if (!navigator.clipboard?.readText) {
    setStatus("Zwischenablage nicht verfügbar – bitte manuell einfügen (Strg+V).", "error");
    return "";
  }

  try {
    setStatus("Lese Zwischenablage …", "info");
    txt = ((await navigator.clipboard.readText()) || "").trim();

    if (txt) {
      textarea.value = txt;
      setStatus("Zwischenablage übernommen.", "ok");
      return txt;
    }

    setStatus("Zwischenablage ist leer – bitte Feld-Input kopieren (feld:wert;;…).", "error");
    return "";
  } catch (e) {
    console.error("Clipboard-Fehler:", e);
    setStatus("Zugriff auf die Zwischenablage fehlgeschlagen – bitte manuell einfügen.", "error");
    return "";
  }
}
