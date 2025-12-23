#!/usr/bin/env bash
set -euo pipefail

# release.sh — bump version (package.json), test, build, commit, tag, push
#
# Usage:
#   ./release.sh 2.6.0
#
# Notes:
# - Requires: node + npm, git
# - Updates ONLY package.json version
# - Creates annotated tag vX.Y.Z and pushes main + tag

VERSION="${1:-}"

if [[ -z "${VERSION}" ]]; then
  echo "Usage: $0 <version>   (e.g. $0 2.6.0)"
  exit 1
fi

if [[ ! "${VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Error: version must look like semver (e.g. 2.6.0 or 2.6.0-beta.1)"
  exit 1
fi

# Ensure we're in a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Error: not inside a git repository."
  exit 1
}

# Ensure clean working tree (prevents tagging random uncommitted changes)
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree not clean. Commit/stash changes first:"
  git status --porcelain
  exit 1
fi

# Ensure we're on main (optional but recommended)
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${BRANCH}" != "main" ]]; then
  echo "Error: you are on branch '${BRANCH}', expected 'main'."
  echo "Switch to main or adjust the script."
  exit 1
fi

# Ensure tag doesn't already exist
TAG="v${VERSION}"
if git rev-parse -q --verify "refs/tags/${TAG}" >/dev/null; then
  echo "Error: tag '${TAG}' already exists."
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

echo "==> Running tests"
npm test

echo "==> Running build"
npm run build

echo "==> Committing version bump"
git add package.json
git commit -m "chore: release ${TAG}"

echo "==> Creating annotated tag ${TAG}"
git tag -a "${TAG}" -m "Release ${TAG}"

echo "==> Pushing branch and tag"
git push origin main
git push origin "${TAG}"

echo "✅ Done: released ${TAG}"

