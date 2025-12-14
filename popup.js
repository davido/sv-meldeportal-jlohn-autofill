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
      let tokens = line.split(";;").map(t => t.trim());
      while (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();
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

    // 4) Nur neues JLohn-Format: OHNE Zwischensumme
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
      "beitragPflegeversFreiw"
    ];

    const line = extractJlohnLine(raw);
    info("Verwendete Zeile:", line);

    if (!line) fail("Keine JLohn-Zeile gefunden. Bitte eine gültige JLohn-Zeile einfügen.");
    if (!line.includes(";;")) fail("Ungültiges Format: ';;' Trennzeichen nicht gefunden.");

    const tokens = splitTokensStrict(line);
    info("Tokens:", tokens.length, tokens);

    // Strikt: nur neue Version (keine Zwischensumme) -> exakte Länge
    if (tokens.length !== fieldOrder.length) {
      fail(
        "Fehler: Anzahl Werte passt nicht zur erwarteten Feldanzahl (neues JLohn-Format ohne Zwischensumme).",
        `Erwartet: ${fieldOrder.length}\nErhalten: ${tokens.length}`
      );
    }

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

    // Befüllen
    for (let i = 0; i < fieldOrder.length; i++) {
      const el = inputs[i];
      const name = fieldOrder[i];
      const val = normalized[i].value;

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
