# RELEASE.md

This document describes how to create a new release of **sv-meldeportal-jlohn-autofill**.

The project uses a small release helper script (`release.sh`) that:

- updates the version in `package.json`
- runs tests and build
- commits the version bump
- creates an annotated git tag (`vX.Y.Z`)
- pushes `main` and the tag to `origin`

> **Single source of truth:** The version is maintained **only** in `package.json`.

---

## Prerequisites

- Node.js + npm installed
- Git configured with access to `origin`
- You are on branch `main`
- Working tree is clean

Quick check:

```bash
git status -sb
```

## Make the script executable (one-time)

```bash
chmod +x release.sh
```

## Run a release (example: 1.0.0)

```bash
./release.sh 2.7.0
```

### What it does

- sets package.json.version to 2.7.0
- runs npm test
- runs npm run build
- commits the version bump: chore: release v2.7.0
- creates annotated tag: v2.7.0
- pushes main
- pushes tag v2.7.0

## Verify the release

### Confirm tag exists locally

```bash
git tag --list "v*"
```

### Confirm tag exists on origin

```bash
git ls-remote --tags origin | grep "refs/tags/v"
```

### Verify build artifacts

```bash
ls -lh dist/

Expected files include:

dist/sv-meldeportal-jlohn-autofill-<version>-chrome-edge.zip
dist/sv-meldeportal-jlohn-autofill-<version>-firefox.zip
dist/sv-meldeportal-jlohn-autofill-<version>-full-project.zip
```

## If something went wrong: delete a tag (local + remote)

Example for v1.1.0:

### Delete locally

```bash
git tag -d v1.1.0
```

### Delete on origin

```bash
git push origin --delete v2.7.0
# (equivalent)
# git push origin :refs/tags/v2.7.0
```

### Optional: delete GitHub Release (manual)

If a GitHub Release was created for that tag, delete it in GitHub UI:

```
Releases → select release → Delete.
```

Then run the release again:

```bash
./release.sh 1.0.0
```

## Firefox (unsigned) local testing

To test locally without signing:

- Open about:debugging#/runtime/this-firefox
- Click Load Temporary Add-on…
- Select dist/firefox/manifest.json
- Test on the SV-Meldeportal page
- Reload extension with Reload when you change code

## Store uploads (high level)

### Firefox Add-ons (AMO)

- Upload the firefox zip:

```bash
dist/sv-meldeportal-jlohn-autofill-<version>-firefox.zip
```

### Chrome Web Store

- Chrome Web Store

```bash
dist/sv-meldeportal-jlohn-autofill-<version>-chrome-edge.zip
```

## Debugging notes (release-related)

- Debug output is controlled by the Debug checkbox in the popup UI.
- Debug logs appear in the page console (SV-Meldeportal tab), not only in popup DevTools.
- The content script has an internal guard to avoid duplicate onMessage listeners if injected multiple times.

## Recommended release checklist

- `git status -sb` is clean
- ./release.sh X.Y.Z succeeds
- Tag exists on origin
- GitHub Actions (tag workflow) ran successfully
- Upload correct zip(s) to AMO / Chrome Web Store
