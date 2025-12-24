# Store listing texts (Chrome Web Store / Edge Add-ons / Firefox AMO)

## Name

SV-Meldeportal JLohn Autofill

## Short description (Chrome/Edge)

Autofill SV-Meldeportal contribution fields from a JLohn export line. Offline-only.

## Short description (Firefox AMO)

Fill SV-Meldeportal contribution fields from JLohn export lines (popup + optional clipboard).

## Full description (all stores)

This extension helps you fill the contribution form in the German **SV-Meldeportal** quickly and reliably.

### How it works:

1. Open the SV-Meldeportal contribution page.
2. Click the toolbar icon to open the popup.
3. Paste a JLohn line (positional format) or use the robust keyed format `field:value;;field:value`.
4. Click **Fill** — the extension inserts values and triggers the required events.

### Key features:

- Autofills SV-Meldeportal contribution fields from keyed JLohn input (field:value;;field:value)
- Optional clipboard import (only after explicit user interaction)
- Skips 0,00 values automatically (JLohn / AutoHotKey compatible)
- Triggers required form events (input, change, blur)
- Debug mode can be enabled via popup checkbox
- No server communication — runs fully offline

### Technical highlights:

- Content script is injected on demand
- Internal guard prevents duplicate execution if injected multiple times
- Deterministic, idempotent autofill behavior

## Permissions justification (copy/paste for review)

#### activeTab

Required to access the currently active SV-Meldeportal tab after the user clicks
“SV-Meldeportal befüllen”.

#### scripting

Required to inject the content script on demand into the active SV-Meldeportal tab.

#### clipboardRead

Used only when the user clicks “Aus Zwischenablage holen” to read the JLohn input.
Clipboard access is never automatic.

#### storage

Used only to store the Debug checkbox state (chrome.storage.local).
No form data or personal information is stored.

#### host permissions (sv-meldeportal.de)

Restricts script execution strictly to the SV-Meldeportal domain.

## Privacy

- The extension does not collect, store, or transmit personal data
- No server communication, telemetry, or tracking
- All processing happens locally in the browser
- Clipboard access requires explicit user interaction
- Debug settings are stored locally and contain no sensitive information
