// -------------------- POPUP: Clipboard + Button-Handling --------------------

async function readFromClipboardIfEmpty(textarea, statusEl) {
  let txt = (textarea.value || "").trim();
  if (txt) return txt;

  if (!navigator.clipboard || !navigator.clipboard.readText) {
    statusEl.textContent = "Clipboard-API nicht verfügbar – bitte JLohn-Zeile einfügen (Ctrl+V).";
    return "";
  }

  try {
    statusEl.textContent = "Lese Zwischenablage …";
    txt = await navigator.clipboard.readText();
    txt = (txt || "").trim();

    if (txt) {
      textarea.value = txt;
      statusEl.textContent = "Zwischenablage übernommen.";
      return txt;
    } else {
      statusEl.textContent = "Zwischenablage ist leer – bitte JLohn-Zeile einfügen.";
      return "";
    }
  } catch (e) {
    console.error("Clipboard-Fehler:", e);
    statusEl.textContent =
      "Fehler beim Lesen der Zwischenablage – bitte JLohn-Zeile manuell einfügen (Ctrl+V).";
    return "";
  }
}

async function handleClipboardClick() {
  const textarea = document.getElementById("jlohnInput");
  const statusEl = document.getElementById("status");
  await readFromClipboardIfEmpty(textarea, statusEl);
}

async function handleFillClick() {
  const textarea = document.getElementById("jlohnInput");
  const statusEl = document.getElementById("status");

  let raw = (textarea.value || "").trim();
  if (!raw) raw = await readFromClipboardIfEmpty(textarea, statusEl);
  if (!raw) return;

  statusEl.textContent = "Sende Daten an aktuelle SV-Meldeportal-Seite …";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      statusEl.textContent = "Keine aktive Tab-ID gefunden.";
      return;
    }

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: runSvMeldeportalJlohnAutofillFromRaw,
        args: [raw]
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          statusEl.textContent = "Fehler beim Ausführen im Tab: " + chrome.runtime.lastError.message;
          return;
        }
        statusEl.textContent = "Felder im SV-Meldeportal wurden (sofern vorhanden) befüllt.";
      }
    );
  });
}

// Popup initialisieren
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnClipboard")?.addEventListener("click", handleClipboardClick);
  document.getElementById("btnFill")?.addEventListener("click", handleFillClick);
});


// -------------------- TAB: Autofill-Logik (nur neue JLohn-Version) --------------------
// Diese Funktion wird IM TAB ausgeführt, nicht im Popup.
function runSvMeldeportalJlohnAutofillFromRaw(raw) {
  (function () {
    const LOG_PREFIX = "[SV-Autofill]";
    const evOpts = { bubbles: true };

    function fail(msg, details) {
      console.error(LOG_PREFIX, msg, details || "");
      alert(msg + (details ? "\n\nDetails:\n" + details : ""));
      throw new Error(msg);
    }
    function info(...args) {
      console.log(LOG_PREFIX, ...args);
    }

    // 1) erste sinnvolle Zeile auswählen (Clipboard kann mehrzeilig sein)
    function extractJlohnLine(input) {
      if (input == null) return "";
      let s = String(input).replace(/^\uFEFF/, "").trim();
      if (!s) return "";
      const lines = s.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      return (lines.find(l => l.includes(";;")) || lines[0] || "").trim();
    }

    // 2) Tokenizer: leere Werte BEHALTEN (wichtig!)
    function splitTokensStrict(line) {
      if (line.includes(";;;")) {
        console.warn("[SV-Autofill] JLohn-Format: ';;;' gefunden. Wird als leeres Feld interpretiert.");
      }

      let tokens = line.split(";;").map(t => t.trim());

      // trailing leere Tokens entfernen
      while (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();

      // führende Semikolons entfernen, die durch ';;;' entstehen: ";0.00" -> "0.00"
      tokens = tokens.map(t => t.replace(/^;+/, "").trim());

      return tokens;
    }

    // 3) Zahl normalisieren (tausenderpunkte raus, punkt->komma)
    function normalizeNumberToPortal(val) {
      if (val == null) return "";
      let s = String(val).trim();
      if (s === "") return "";

      s = s.replace(/\s+/g, "");
      const isNegative = s.startsWith("-");
      if (isNegative) s = s.slice(1);

      if (s.includes(".") && s.includes(",")) {
        s = s.replace(/\./g, "");
      } else if (s.includes(".") && !s.includes(",")) {
        s = s.replace(/\./g, ",");
      }

      if (!/^\d+(?:,\d+)?$/.test(s)) return null;
      return (isNegative ? "-" : "") + s;
    }

    // NEU: 0-Werte erkennen (0, 0,0, 0,00 etc.) -> sollen NICHT befüllt werden
    function isZeroValue(val) {
      if (val == null) return false;
      const s = String(val).trim();
      if (s === "") return false;
      const n = Number(s.replace(",", "."));
      return Number.isFinite(n) && n === 0;
    }

    // 4) Maximale Ausprägung: neues JLohn-Format (OHNE Zwischensumme), inkl. Erstattung U1/U2
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

    const line = extractJlohnLine(raw);
    info("Verwendete Zeile:", line);

    if (!line) fail("Keine JLohn-Zeile gefunden. Bitte eine gültige JLohn-Zeile einfügen.");
    if (!line.includes(";;")) fail("Ungültiges Format: ';;' Trennzeichen nicht gefunden.");

    let tokens = splitTokensStrict(line);
    info("Tokens (vor Auffüllen):", tokens.length, tokens);

    // NEU: tolerant bzgl. fehlender End-Felder (16 statt 17) -> rechts auffüllen
    const expected = fieldOrder.length;

    if (tokens.length > expected) {
      fail(
        "Fehler: Zu viele Werte in JLohn-Zeile (neues Format ohne Zwischensumme).",
        `Erwartet maximal: ${expected}\nErhalten: ${tokens.length}`
      );
    }

    while (tokens.length < expected) {
      tokens.push("");
    }

    info("Tokens (nach Auffüllen):", tokens.length, tokens);

    // Inputs suchen
    const inputs = fieldOrder.map(name => document.querySelector(`input[name="${name}"]`));
    const missing = [];
    inputs.forEach((el, i) => { if (!el) missing.push(fieldOrder[i]); });

    // zwischensumme darf existieren, wird aber ignoriert
    const zw = document.querySelector(`input[name="zwischensumme"]`);
    if (zw) info("Hinweis: zwischensumme existiert im Formular, wird bewusst nicht befüllt.");

    if (missing.length) {
      fail(
        "Fehler: Nicht alle erwarteten Felder wurden im Formular gefunden. Bist du auf der Beitragsmaske?",
        missing.join(", ")
      );
    }

    // Validieren & normalisieren
    const normalized = tokens.map((t, idx) => {
      const n = normalizeNumberToPortal(t);
      if (n === null) return { ok: false, idx, field: fieldOrder[idx], raw: t };
      return { ok: true, value: n };
    });

    const invalids = normalized.filter(x => !x.ok);
    if (invalids.length) {
      fail(
        "Fehler: Mindestens ein Wert ist nicht numerisch interpretierbar.",
        invalids.map(x => `#${x.idx} ${x.field}: "${x.raw}"`).join("\n")
      );
    }

    // Befüllen: leere oder 0,00 NICHT schreiben
    for (let i = 0; i < fieldOrder.length; i++) {
      const el = inputs[i];
      const name = fieldOrder[i];
      const val = normalized[i].value; // "" oder "123,45" oder "0,00"

      // NEU: skip leere Werte und 0,00
      if (val === "" || isZeroValue(val)) {
        info(`Skip ${name} = ${JSON.stringify(val)}`);
        continue;
      }

      if (el.readOnly || el.hasAttribute("readonly") || el.disabled) {
        info(`${name} ist readonly/disabled – übersprungen.`);
        continue;
      }

      el.focus();
      el.value = val;
      el.dispatchEvent(new Event("input", evOpts));
      el.dispatchEvent(new Event("change", evOpts));
    }

    alert("SV-Meldeportal-Felder wurden aus der JLohn-Zeile (neues Format) befüllt.");
  })();
}
