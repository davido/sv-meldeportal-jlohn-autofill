#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
if [[ -z "${VERSION}" ]]; then
  echo "Usage: $0 <version>   (e.g. $0 2.6.0)"
  exit 1
fi

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: version must look like semver (e.g. 2.6.0 or 2.6.0-beta.1)"
  exit 1
fi

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

# Ensure clean tree BEFORE we change version
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree not clean. Commit/stash changes first:"
  git status --porcelain
  exit 1
fi

echo "==> Setting package.json version to ${VERSION}"
node -e "
const fs=require('fs');
const p='package.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
j.version='${VERSION}';
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
"

# If version was already the same, package.json may be unchanged
if git diff --quiet -- package.json; then
  echo "==> package.json already at version ${VERSION} (no change)"
else
  echo "==> package.json updated"
fi

echo "==> Running tests"
npm test

echo "==> Running build"
npm run build

# Commit only if we changed package.json
if git diff --quiet -- package.json; then
  echo "==> Skipping commit (no changes to package.json)"
else
  echo "==> Committing version bump"
  git add package.json
  git commit -m "chore: release ${TAG}"
fi

# Push main first (may include earlier commits)
echo "==> Pushing main"
git push origin main

echo "==> Creating annotated tag ${TAG}"
git tag -a "${TAG}" -m "Release ${TAG}"

echo "==> Pushing tag ${TAG}"
git push origin "${TAG}"

echo "✅ Done: released ${TAG}"

