# Store listing texts (Chrome Web Store / Edge Add-ons / Firefox AMO)

## Name

SV-Meldeportal JLohn Autofill

## Short description (Chrome/Edge)

Autofill SV-Meldeportal contribution fields from a JLohn export line. Offline-only.

## Short description (Firefox AMO)

Fill SV-Meldeportal contribution fields from JLohn export lines (popup + optional clipboard).

## Full description (all stores)

This extension helps you fill the contribution form in the German **SV-Meldeportal** quickly and reliably.

How it works:

1. Open the SV-Meldeportal contribution page.
2. Click the toolbar icon to open the popup.
3. Paste a JLohn line (positional format) or use the robust keyed format `field:value;;field:value`.
4. Click **Fill** — the extension inserts values and triggers the required events.

Key features:

- Supports positional JLohn lines (separated by `;;`) and a robust keyed format.
- Optional clipboard import (only after explicit user interaction).
- No server communication, no telemetry, no tracking — runs fully offline.

## Permissions justification (copy/paste for review)

- **activeTab**: Needed to access the currently active SV-Meldeportal tab when the user clicks “Fill”.
- **scripting**: Needed to inject the content script on demand into the active SV-Meldeportal tab.
- **clipboardRead**: Used only when the user clicks “Import from clipboard” to read the JLohn line.
- **host permissions (sv-meldeportal.de)**: Restricts script injection to the SV-Meldeportal domain.

## Privacy

- The extension does not collect or transmit data.
- All processing happens locally in the browser.
- Clipboard is accessed only after an explicit click.
