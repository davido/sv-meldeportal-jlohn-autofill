# SV-Meldeportal JLohn Autofill

Cross-browser (Chrome, Edge, Firefox) extension that autofills contribution fields
in the German **SV-Meldeportal** from **keyed JLohn field data**
([JLohn](https://www.jlohn.de/wordpress/)).

The extension fills values into the official SV-Meldeportal form and triggers
the required browser events so the portal reacts correctly.

## Screenshots

Popup workflow (examples):

**Leeres Popup**

![Leeres Popup](screenshots/popup-empty.png)

**Zwischenablage importiert**

![Zwischenablage importiert](screenshots/popup-clipboard-imported.png)

**Erfolgreich befüllt**

![Erfolgreich befüllt](screenshots/popup-keyed-filled.png)

## Features

- Popup UI for **keyed field input**
  (`feld:wert;;feld:wert;;…`)
- Optional clipboard import (only after explicit user click)
- Automatically fills matching SV-Meldeportal form fields
- Skips `0,00` values (required for JLohn / AutoHotKey compatibility)
- Status message shows number of filled fields and number of skipped `0,00` values
- Autofill triggers `input`, `change`, and `blur` events
- Offline-only (no telemetry, no network calls)

## Input format

Example:

```

beitrag1000:511,00;;
beitragssatzAllgemein:17,89;;
beitrag3000:0,00;;
beitragU1:87,50;;

```

Notes:

- Decimal comma and decimal dot are both supported (`511,00` / `511.00`)
- `0,00` values are intentionally skipped but counted and reported

## Permissions (store review friendly)

activeTab  
Used to access the currently active SV-Meldeportal tab after clicking
**SV-Meldeportal befüllen**

scripting  
Used to inject the content script into the active tab after clicking
**SV-Meldeportal befüllen**

clipboardRead  
Used only after clicking **Aus Zwischenablage holen**

host_permissions  
Restricts execution to `sv-meldeportal.de`

Data handling:  
No data is transmitted. All parsing and form filling happens locally in the browser.

## Project structure

- src/popup/\* – popup UI logic
- src/content/\* – content script that fills the form
- src/shared/\* – pure helpers (number normalization, field list)
- tests/\* – unit tests (Vitest + JSDOM)
- .github/workflows/ci.yml – GitHub Actions CI
- docs/store-listing.md – store-ready listing texts

## Commands

### Install dependencies:

```
npm install
```

### Format code:

```
npm run format
npm run format:check
```

### Lint:

```
npm run lint
```

### Tests:

```
npm test
npm run test:watch
npm run test:coverage
```

### Coverage output is written to `coverage/`.

### Build (release)

```
npm run build
```

Build outputs:

```
dist/chrome/
dist/sv-meldeportal-jlohn-autofill-<version>-chrome-edge.zip

dist/firefox/
dist/sv-meldeportal-jlohn-autofill-<version>-firefox.zip

dist/sv-meldeportal-jlohn-autofill-<version>-full-project.zip
```

The version is taken **only from package.json**.

### Debugging

Enable debug logging by setting:

```
localStorage.SV_AUTOFILL_DEBUG = "1";
```

in the popup DevTools or page DevTools.

## Review FAQ

Does this extension collect or transmit personal data?

No. The extension does not send any data to servers.
All processing happens locally in the browser.

Why does it request clipboardRead?

Clipboard access is used only after the user explicitly clicks
**Aus Zwischenablage holen**.

Why activeTab and scripting?

They are required to inject and run the content script in the active
SV-Meldeportal tab after the user clicks **Befüllen**.

What sites can it run on?

Execution is restricted to `sv-meldeportal.de`
via host permissions.

Why are there multiple config files?

build.mjs builds the extension and creates ZIP artifacts.  
vitest.config.js configures unit tests and coverage.

## License

Apache License 2.0 – see LICENSE.
