// ============================================================================
// SV-Meldeportal JLohn Autofill
// popup.js  (Popup UI + Tab Injection Script)
// Debug ON (Popup): localStorage.SV_AUTOFILL_DEBUG="1"   (Popup DevTools)
// Debug ON (Tab):   localStorage.SV_AUTOFILL_DEBUG="1"   (Seiten-DevTools)
// Default: DEBUG = false, keine alert(), Status nur im Popup.
// ============================================================================

/* ============================================================================
 * POPUP: Debug + Status UI
 * ========================================================================== */

const POPUP_DEBUG_DEFAULT = false;

function popupDebugEnabled() {
  try {
    return localStorage.getItem("SV_AUTOFILL_DEBUG") === "1" || POPUP_DEBUG_DEFAULT;
  } catch {
    return POPUP_DEBUG_DEFAULT;
  }
}

function popupDbg(...args) {
  if (!popupDebugEnabled()) return;
  console.log("[SV-Autofill][POPUP]", ...args);
}

function setStatus(text, type = "info") {
  const el = document.getElementById("status");
  if (!el) return;

  el.textContent = text || "";
  el.classList.remove("ok", "error", "info");

  if (type === "ok") el.classList.add("ok");
  else if (type === "error") el.classList.add("error");
  else el.classList.add("info");
}

function clearStatus() {
  setStatus("", "info");
}

function setBusy(isBusy) {
  const ids = ["btnClipboard", "btnFill", "btnTransform", "btnFillKeyed"];
  for (const id of ids) {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!isBusy;
  }
}

/* ============================================================================
 * POPUP: Clipboard
 * ========================================================================== */

async function readFromClipboardIfEmpty(textarea) {
  let txt = (textarea?.value || "").trim();
  if (txt) return txt;

  if (!navigator.clipboard || !navigator.clipboard.readText) {
    setStatus("Clipboard-API nicht verfügbar – bitte JLohn-Zeile einfügen (Ctrl+V).", "error");
    return "";
  }

  try {
    setStatus("Lese Zwischenablage …", "info");
    txt = await navigator.clipboard.readText();
    txt = (txt || "").trim();

    if (txt) {
      textarea.value = txt;
      setStatus("Zwischenablage übernommen.", "ok");
      return txt;
    }

    setStatus("Zwischenablage ist leer – bitte JLohn-Zeile einfügen.", "error");
    return "";
  } catch (e) {
    console.error("Clipboard-Fehler:", e);
    setStatus("Fehler beim Lesen der Zwischenablage – bitte manuell einfügen (Ctrl+V).", "error");
    return "";
  }
}

async function handleClipboardClick() {
  const textarea = document.getElementById("jlohnInput");
  await readFromClipboardIfEmpty(textarea);
}

/* ============================================================================
 * POPUP: Execute in active tab
 * ========================================================================== */

function execInActiveTab(raw, modeLabel) {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        resolve({ ok: false, message: "Keine aktive Tab-ID gefunden." });
        return;
      }

      popupDbg("executeScript start", { modeLabel, tabId: tab.id, rawLen: (raw || "").length });

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: runSvMeldeportalJlohnAutofillFromRaw,
          args: [raw]
        },
        (results) => {
          popupDbg("executeScript callback", { modeLabel, results });

          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            resolve({ ok: false, message: chrome.runtime.lastError.message || "executeScript Fehler" });
            return;
          }

          const r0 = results && results[0] && results[0].result;
          if (r0 && typeof r0 === "object") {
            resolve(r0);
            return;
          }

          resolve({ ok: true, message: "Script ausgeführt (Details siehe Tab-Konsole)." });
        }
      );
    });
  });
}

/* ============================================================================
 * POPUP: Button handlers
 * ========================================================================== */

// Positional -> SV Portal
async function handleFillClick() {
  clearStatus();
  setBusy(true);

  try {
    const textarea = document.getElementById("jlohnInput");
    let raw = (textarea?.value || "").trim();
    if (!raw) raw = await readFromClipboardIfEmpty(textarea);
    if (!raw) return;

    setStatus("Sende Positional-Daten an aktuelle SV-Meldeportal-Seite …", "info");
    const r = await execInActiveTab(raw, "Positional");

    if (r.ok) {
      setStatus(
        `Positional: OK – ${r.message || "Befüllt."}` +
          (typeof r.appliedCount === "number" ? ` (${r.appliedCount})` : ""),
        "ok"
      );

      // Optional: keyedExport automatisch in Keyed-Feld schreiben (wenn leer)
      if (r.keyedExport) {
        const keyed = document.getElementById("keyedInput");
        if (keyed && !keyed.value.trim()) keyed.value = r.keyedExport;
      }
    } else {
      setStatus(`Positional: Fehler – ${r.message || "unbekannt"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

// Positional -> Keyed transformieren
async function handleTransformClick() {
  clearStatus();

  const src = document.getElementById("jlohnInput");
  const dst = document.getElementById("keyedInput");

  const raw = (src?.value || "").trim();
  if (!raw) {
    setStatus("Keine Positional-Zeile vorhanden.", "error");
    return;
  }

  try {
    const keyed = transformPositionalToKeyed(raw);
    dst.value = keyed;
    setStatus("Transformiert: Positional → Keyed (nur befüllbare Werte, ohne 0,00).", "ok");
  } catch (e) {
    console.error(e);
    setStatus("Fehler beim Transformieren: " + (e?.message || String(e)), "error");
  }
}

// Keyed -> SV Portal
async function handleFillKeyedClick() {
  clearStatus();
  setBusy(true);

  try {
    const textarea = document.getElementById("keyedInput");
    const raw = (textarea?.value || "").trim();
    if (!raw) {
      setStatus("Kein Keyed-FeldInput vorhanden.", "error");
      return;
    }

    setStatus("Sende Keyed-Daten an aktuelle SV-Meldeportal-Seite …", "info");
    const r = await execInActiveTab(raw, "Keyed");

    if (r.ok) {
      setStatus(
        `Keyed: OK – ${r.message || "Befüllt."}` +
          (typeof r.appliedCount === "number" ? ` (${r.appliedCount})` : ""),
        "ok"
      );
    } else {
      setStatus(`Keyed: Fehler – ${r.message || "unbekannt"}`, "error");
    }
  } finally {
    setBusy(false);
  }
}

// Popup initialisieren
document.addEventListener("DOMContentLoaded", () => {
  popupDbg("popup loaded");

  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFill")?.addEventListener("click", handleFillClick);
  document.getElementById("btnTransform")?.addEventListener("click", handleTransformClick);
  document.getElementById("btnFillKeyed")?.addEventListener("click", handleFillKeyedClick);
});

/* ============================================================================
 * POPUP: Transform helper (Positional -> Keyed)
 * ========================================================================== */

function getFieldOrderPopup() {
  return [
    "beitrag1000",
    "beitragssatzAllgemein",
    "beitrag3000",
    "beitragssatzErmaessigt",
    "beitragZusatzKrankenvers",
    "beitrag0100",
    "beitrag0300",
    "beitrag0010",
    "beitrag0020",
    "beitrag0001",
    "beitragU1",
    "beitragU2",
    "beitrag0050",
    "beitragKrankenversFreiw",
    "beitragZusatz",
    "beitragPflegeversFreiw",
    "beitragErstattungKrankMutter"
  ];
}

function splitTokensStrictPopup(line) {
  let tokens = String(line || "").split(";;").map(t => t.trim());
  while (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();
  // ;;; -> token beginnt mit ';' -> wegtrimmen
  tokens = tokens.map(t => t.replace(/^;+/, "").trim());
  return tokens;
}

function normalizeNumberToPortalPopup(val) {
  if (val == null) return "";
  let s = String(val).trim();
  if (s === "") return "";
  s = s.replace(/\s+/g, "");

  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);

  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "");
  else if (s.includes(".") && !s.includes(",")) s = s.replace(/\./g, ",");

  if (!/^\d+(?:,\d+)?$/.test(s)) return null;
  return (neg ? "-" : "") + s;
}

function isZeroValuePopup(val) {
  if (val == null) return false;
  const s = String(val).trim();
  if (s === "") return false;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n === 0;
}

function transformPositionalToKeyed(raw) {
  const line = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!line.includes(";;")) throw new Error("Kein ';;'-Separator gefunden. Erwartet wird Positional-Format.");

  const fieldOrder = getFieldOrderPopup();
  let tokens = splitTokensStrictPopup(line);

  if (tokens.length > fieldOrder.length) {
    throw new Error(`Zu viele Werte (${tokens.length}), erwartet max ${fieldOrder.length}.`);
  }
  while (tokens.length < fieldOrder.length) tokens.push("");

  const pairs = [];
  for (let i = 0; i < fieldOrder.length; i++) {
    const rawVal = tokens[i];
    if (!rawVal) continue;

    const normalized = normalizeNumberToPortalPopup(rawVal);
    if (normalized === null) continue;
    if (normalized === "" || isZeroValuePopup(normalized)) continue;

    pairs.push(`${fieldOrder[i]}:${normalized}`);
  }

  if (!pairs.length) throw new Error("Keine befüllbaren Werte gefunden (nur 0,00 oder leer).");
  return pairs.join(";;");
}

/* ============================================================================
 * TAB: Autofill (Positional + Keyed)  ✅ SELF-CONTAINED
 * Debug ON (Tab): localStorage.SV_AUTOFILL_DEBUG="1"
 * Keine alert(); Konsole nur bei DEBUG.
 * ========================================================================== */

function runSvMeldeportalJlohnAutofillFromRaw(raw) {
  return (function () {
    const LOG = "[SV-Autofill]";
    const DEBUG_DEFAULT = false;
    const evOpts = { bubbles: true };

    function debugEnabled() {
      try {
        return localStorage.getItem("SV_AUTOFILL_DEBUG") === "1" || DEBUG_DEFAULT;
      } catch {
        return DEBUG_DEFAULT;
      }
    }
    const dbg = (...args) => { if (debugEnabled()) console.log(LOG, ...args); };

    function okResult(message, extra = {}) {
      return { ok: true, message, ...extra };
    }
    function errResult(message, details) {
      console.error(LOG, message, details || "");
      return { ok: false, message, details };
    }

    const fieldOrder = [
      "beitrag1000",
      "beitragssatzAllgemein",
      "beitrag3000",
      "beitragssatzErmaessigt",
      "beitragZusatzKrankenvers",
      "beitrag0100",
      "beitrag0300",
      "beitrag0010",
      "beitrag0020",
      "beitrag0001",
      "beitragU1",
      "beitragU2",
      "beitrag0050",
      "beitragKrankenversFreiw",
      "beitragZusatz",
      "beitragPflegeversFreiw",
      "beitragErstattungKrankMutter"
    ];

    dbg("START", { url: location.href, title: document.title, rawLen: (raw || "").length });

    function extractLine(input) {
      if (input == null) return "";
      const s0 = String(input).replace(/^\uFEFF/, "").trim();
      if (!s0) return "";
      const lines = s0.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      return (lines.find(l => l.includes(";;") || l.includes(":")) || lines[0] || "").trim();
    }

    function splitTokens(line) {
      if (line.includes(";;;")) dbg("JLohn-Format: ';;;' gefunden – leeres Feld.");
      let tokens = String(line).split(";;").map(t => t.trim());
      while (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();
      tokens = tokens.map(t => t.replace(/^;+/, "").trim());
      return tokens;
    }

    function normalize(val) {
      if (val == null) return "";
      let s = String(val).trim();
      if (s === "") return "";

      s = s.replace(/\s+/g, "");
      const neg = s.startsWith("-");
      if (neg) s = s.slice(1);

      if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "");
      else if (s.includes(".") && !s.includes(",")) s = s.replace(/\./g, ",");

      if (!/^\d+(?:,\d+)?$/.test(s)) return null;
      return (neg ? "-" : "") + s;
    }

    function isZero(val) {
      if (val == null) return false;
      const s = String(val).trim();
      if (s === "") return false;
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) && n === 0;
    }

    function parseKeyedToMap(line) {
      const map = new Map();
      const parts = String(line).split(";;").map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        const idx = p.indexOf(":");
        if (idx <= 0) continue;
        const key = p.slice(0, idx).trim();
        const value = p.slice(idx + 1).trim();
        if (!key) continue;
        map.set(key, value);
      }
      return map;
    }

    const line = extractLine(raw);
    dbg("Extracted line:", line);
    if (!line) return errResult("Keine Eingabe gefunden. Bitte Positional oder Keyed Daten einfügen.");

    const isKeyed = line.includes(":");
    dbg("Mode:", isKeyed ? "KEYED" : "POSITIONAL");

    let values = new Map();

    if (isKeyed) {
      values = parseKeyedToMap(line);
      dbg("Keyed keys:", Array.from(values.keys()));
      if (values.size === 0) return errResult("Keyed-Format erkannt, aber keine feld:wert Paare gefunden.");
    } else {
      if (!line.includes(";;")) return errResult("Ungültiges Format: ';;' Trennzeichen nicht gefunden.");

      const tokens = splitTokens(line);
      dbg("Tokens (vor Auffüllen):", tokens.length, tokens);

      if (tokens.length > fieldOrder.length) {
        return errResult("Zu viele Werte in Positional-Zeile.", `Erwartet max ${fieldOrder.length}, erhalten ${tokens.length}`);
      }

      const filled = tokens.slice();
      while (filled.length < fieldOrder.length) filled.push("");
      dbg("Tokens (nach Auffüllen):", filled.length, filled);

      for (let i = 0; i < fieldOrder.length; i++) {
        values.set(fieldOrder[i], filled[i] ?? "");
      }
    }

    const inputsByName = new Map();
    for (const f of fieldOrder) {
      inputsByName.set(f, document.querySelector(`input[name="${f}"]`));
    }

    const missing = fieldOrder.filter(f => !inputsByName.get(f));
    dbg("Missing fields:", missing);

    if (missing.length) {
      return errResult("Nicht alle erwarteten Felder im Formular gefunden. Bist du auf der Beitragsmaske?", missing.join(", "));
    }

    const applied = [];

    function setField(name, normalizedVal) {
      const el = inputsByName.get(name);
      if (!el) return;

      if (normalizedVal === "" || isZero(normalizedVal)) return;

      if (el.readOnly || el.hasAttribute("readonly") || el.disabled) {
        dbg("SKIP readonly/disabled", { name, id: el.id });
        return;
      }

      dbg("SET", { name, val: normalizedVal, id: el.id });

      el.focus();
      el.value = normalizedVal;
      el.dispatchEvent(new Event("input", evOpts));
      el.dispatchEvent(new Event("change", evOpts));
      el.dispatchEvent(new Event("blur", evOpts));

      applied.push({ name, val: normalizedVal });
    }

    if (isKeyed) {
      const unknownKeys = [];
      const dupKeys = [];
      const seen = new Set();

      for (const [name, rawVal] of values.entries()) {
        if (seen.has(name)) dupKeys.push(name);
        seen.add(name);

        if (!inputsByName.has(name)) {
          unknownKeys.push(name);
          continue;
        }

        const n = normalize(rawVal);
        if (n === null) {
          dbg("SKIP invalid number", { name, rawVal });
          continue;
        }

        setField(name, n);
      }

      if (unknownKeys.length && debugEnabled()) console.warn(LOG, "Unbekannte Keys ignoriert:", unknownKeys);
      if (dupKeys.length && debugEnabled()) console.warn(LOG, "Doppelte Keys (letzter gewinnt):", dupKeys);
    } else {
      for (const name of fieldOrder) {
        const rawVal = values.get(name) ?? "";
        const n = normalize(rawVal);
        if (n === null) return errResult("Nicht numerisch interpretierbarer Wert.", `${name}: "${rawVal}"`);
        setField(name, n);
      }
    }

    if (!applied.length) {
      dbg("Keine Felder befüllt.");
      return okResult("Keine Felder befüllt (nur 0,00/leer oder Felder nicht editierbar).", {
        appliedCount: 0,
        keyedExport: ""
      });
    }

    // Nur bei DEBUG in Konsole ausgeben (sonst kein console.table/noise)
    if (debugEnabled()) {
      console.log(LOG, `Befüllte Felder (${applied.length}):`);
      console.table(applied.map(x => ({ Feld: x.name, Wert: x.val })));

      const keyedLineDbg = applied.map(x => `${x.name}:${x.val}`).join(";;");
      console.log(LOG, "Keyed-Export:");
      console.log(keyedLineDbg);
    }

    const keyedLine = applied.map(x => `${x.name}:${x.val}`).join(";;");
    return okResult(`Befüllt: ${applied.length} Felder`, {
      appliedCount: applied.length,
      keyedExport: keyedLine
    });
  })();
}

