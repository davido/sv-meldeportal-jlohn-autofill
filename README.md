# SV-Meldeportal JLohn Autofill – Browser‑Erweiterung

Dieses Projekt stellt eine **Firefox‑Browser‑Erweiterung** bereit, die automatisch die Beitragsfelder im **SV‑Meldeportal** anhand einer **JLohn‑Zeile** ausfüllt.

---

## ✨ Funktionen

- Öffnet ein Popup mit Eingabefeld für die JLohn‑Zeile  
- Optional: Lesen der JLohn‑Zeile **direkt aus der Zwischenablage**  
- Automatisches Matching der Werte zu den korrekten Formularfeldern im SV‑Meldeportal  
- Validierung der Anzahl der Werte  
- Automatische Events (`input`, `change`), damit Angular/Material‑Formulare korrekt reagieren  
- Praktisches Toolbar‑Icon für schnellen Zugriff  
- Komplett **offline**, keine Datenübertragung an Server

---

## 📦 Inhalt des Erweiterungs‑Ordners

- `manifest.json`  
- `popup.html`  
- `popup.js`  
- `icons/icon16.png`  
- `icons/icon32.png`  
- `icons/icon48.png`  

---

## 🔧 Installation (Firefox)

1. Lade das ZIP aus den **GitHub Releases** herunter.  
2. Entpacke das ZIP.  
3. Öffne in Firefox:  
   **`about:debugging#/runtime/this-firefox`**  
4. Klicke auf **„Temporäre Add-on laden“**.  
5. Wähle die Datei **`manifest.json`** im entpackten Ordner.  
6. Das Add-on erscheint nun in der Toolbar (ggf. Icon über „Anpassen…“ hinzufügen).

---

## 🚀 Nutzung

1. Auf eine SV‑Meldeportal‑Beitragsseite gehen.  
2. Toolbar‑Icon klicken → Popup öffnet sich.  
3. JLohn‑Zeile einfügen oder aus der Zwischenablage übernehmen.  
4. Button **„SV‑Meldeportal befüllen“** drücken.  
5. Alle relevanten Felder werden automatisch ausgefüllt.

---

## ⚖️ Lizenz

Dieses Projekt steht unter der **Apache License 2.0**.  
Siehe Datei `LICENSE` oder:  
https://www.apache.org/licenses/LICENSE-2.0
