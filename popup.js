
async function readFromClipboardIfEmpty(textarea, statusEl) {
  let txt = textarea.value.trim();
  if (txt) {
    return txt;
  }
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    statusEl.textContent = "Clipboard-API nicht verfügbar – bitte JLohn-Zeile einfügen.";
    return "";
  }
  try {
    statusEl.textContent = "Lese Zwischenablage …";
    txt = await navigator.clipboard.readText();
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
    statusEl.textContent = "Fehler beim Lesen der Zwischenablage – bitte JLohn-Zeile einfügen.";
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

  let raw = textarea.value.trim();
  if (!raw) {
    raw = await readFromClipboardIfEmpty(textarea, statusEl);
  }
  if (!raw) {
    return;
  }

  statusEl.textContent = "Sende Daten an aktuelle SV-Meldeportal-Seite …";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
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
      (results) => {
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

// Diese Funktion wird IM TAB ausgeführt, nicht im Popup.
function runSvMeldeportalJlohnAutofillFromRaw(raw) {
  (function () {
    console.log("=== AutoFill (Extension) Start ===");
    console.log("Raw input:", raw);

    const values = raw
      .split(";;")
      .map(v => v.trim())
      .filter(v => v !== "");

    console.log("Parsed values (" + values.length + "):", values);

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
      "zwischensumme",
      "beitragKrankenversFreiw",
      "beitragZusatz",
      "beitragPflegeversFreiw"
    ];

    console.log("Erwartete Felder (" + fieldOrder.length + "):", fieldOrder);

    if (values.length !== fieldOrder.length) {
      console.error("Anzahl Werte passt nicht zu Anzahl Felder!");
      alert(
        "Fehler: Anzahl Werte (" +
          values.length +
          ") ungleich Anzahl erwarteter Felder (" +
          fieldOrder.length +
          ").\nBitte JLohn-Zeile prüfen."
      );
      console.log("=== AutoFill Ende (Fehler: Anzahl) ===");
      return;
    }

    const inputs = fieldOrder.map(name =>
      document.querySelector('input[name="' + name + '"]')
    );

    const missingNames = [];
    const foundInputs = [];

    inputs.forEach((el, idx) => {
      if (!el) {
        missingNames.push(fieldOrder[idx]);
      } else {
        foundInputs.push(el);
      }
    });

    console.log(
      "Gefundene passende Input-Felder im DOM (" + foundInputs.length + "):",
      foundInputs
    );
    console.log(
      "Gefundene Feldnamen im DOM:",
      foundInputs.map(el => el.name)
    );

    if (missingNames.length > 0) {
      console.error("Nicht gefundene Felder im DOM:", missingNames);
      alert(
        "Fehler: Folgende Felder wurden im Formular nicht gefunden:\n" +
          missingNames.join(", ") +
          "\n\nBist du auf der richtigen Seite (Beitragsmaske)?"
      );
      console.log("=== AutoFill Ende (Fehler: Felder fehlen) ===");
      return;
    }

    const evOpts = { bubbles: true };

    fieldOrder.forEach((name, idx) => {
      const el = inputs[idx];
      if (!el) return;

      let val = values[idx];

      console.log("→ Verarbeite Feld #" + idx + " (" + name + ")");
      console.log("DOM-Element:", el);
      console.log("   Sollwert =", JSON.stringify(val));

      if (el.readOnly || el.hasAttribute("readonly")) {
        console.log("   Feld ist readonly – wird übersprungen.");
        return;
      }
      if (el.disabled) {
        console.log("   Feld ist disabled – wird übersprungen.");
        return;
      }

      if (typeof val === "string" && val.includes(".")) {
        val = val.replace(/\./g, ",");
      }

      const numericLike = /^-?\d+(?:[\.,]\d+)?$/;
      if (numericLike.test(val)) {
        val = val.trim();
      }

      el.focus();
      el.value = val;
      console.log("   Eingetragen! input.value =", JSON.stringify(el.value));
      el.dispatchEvent(new Event("input", evOpts));
      el.dispatchEvent(new Event("change", evOpts));
      console.log("   Events ausgelöst: input + change");
    });

    console.log("=== AutoFill (Extension) Ende ===");
    alert("SV-Meldeportal-Felder wurden aus JLohn-Zeile befüllt.");
  })();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnClipboard").addEventListener("click", handleClipboardClick);
  document.getElementById("btnFill").addEventListener("click", handleFillClick);
});
