#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      VERSION="$arg"
      ;;
  esac
done

if [[ -z "${VERSION}" ]]; then
  echo "Usage: $0 <version> [--dry-run]"
  echo "Example: $0 2.7.1 --dry-run"
  exit 1
fi

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: version must look like semver (e.g. 2.7.0 or 2.7.0-beta.1)"
  exit 1
fi

log() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    echo "$*"
  fi
}

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: not inside a git repository."
  exit 1
}

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${BRANCH}" != "main" ]]; then
  echo "Error: you are on branch '${BRANCH}', expected 'main'."
  exit 1
fi

TAG="v${VERSION}"

if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Error: tag '${TAG}' already exists locally."
  exit 1
fi
if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  echo "Error: tag '${TAG}' already exists on origin."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree not clean. Commit/stash changes first:"
  git status --porcelain
  exit 1
fi

log "==> Checking formatting (format:check)"
npm run format:check

log "==> Running tests"
npm test

if ! $DRY_RUN; then
  log "==> Setting package.json version to ${VERSION}"
  node -e "
  const fs=require('fs');
  const p='package.json';
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  j.version='${VERSION}';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  "
else
  log "==> Would set package.json version to ${VERSION}"
fi

log "==> Running build"
npm run build

if ! $DRY_RUN && ! git diff --quiet -- package.json; then
  log "==> Committing version bump"
  git add package.json
  git commit -m "chore: release ${TAG}"
else
  log "==> Would commit version bump (if changed)"
fi

run git push origin main
run git tag -a "${TAG}" -m "Release ${TAG}"
run git push origin "${TAG}"

if $DRY_RUN; then
  echo "✅ Dry run completed – no changes were made."
else
  echo "✅ Done: released ${TAG}"
fi

