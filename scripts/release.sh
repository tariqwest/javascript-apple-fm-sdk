#!/usr/bin/env bash
# Prepare and publish javascript-apple-fm-sdk to npm and GitHub Releases.
#
# Usage:
#   ./scripts/release.sh [patch|minor|major|current|<x.y.z>] [--yes] [--github-only]
#
# Examples:
#   ./scripts/release.sh current --yes   # publish package.json version as-is (first release)
#   ./scripts/release.sh patch --yes     # bump patch, publish, tag, GitHub release
#   RELEASE_YES=1 ./scripts/release.sh 0.2.0
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION_ARG="${1:-patch}"
YES="${RELEASE_YES:-0}"
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
  esac
done

if [[ "$VERSION_ARG" == "--yes" || "$VERSION_ARG" == "-y" ]]; then
  VERSION_ARG="patch"
fi

is_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]
}

if [[ "$VERSION_ARG" != "patch" && "$VERSION_ARG" != "minor" && "$VERSION_ARG" != "major" && "$VERSION_ARG" != "current" ]]; then
  if ! is_semver "$VERSION_ARG"; then
    echo "Usage: $0 [patch|minor|major|current|<x.y.z>] [--yes]" >&2
    exit 1
  fi
fi

require_gh() {
  if ! command -v gh >/dev/null 2>&1; then
    echo "Error: GitHub CLI (gh) is required. Install: https://cli.github.com/" >&2
    exit 1
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "Error: gh is not authenticated. Run: gh auth login" >&2
    exit 1
  fi
}

require_npm_auth() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "Error: npm is required" >&2
    exit 1
  fi
  if ! npm whoami --registry=https://registry.npmjs.org/ >/dev/null 2>&1; then
    echo "Error: not logged in to npm. Run: npm login" >&2
    echo "  (or set a usable auth token in ~/.npmrc for //registry.npmjs.org/:_authToken)" >&2
    exit 1
  fi
  echo "npm user: $(npm whoami --registry=https://registry.npmjs.org/)"
}

package_version() {
  node -p "require('./package.json').version"
}

package_name() {
  node -p "require('./package.json').name"
}

cleanup_release_artifacts() {
  local name
  name="$(package_name)"
  rm -f "${name}"-*.tgz
}

ensure_submodule() {
  if [[ ! -f reference/python-apple-fm-sdk/foundation-models-c/Sources/FoundationModelsCBindings/include/FoundationModels.h ]]; then
    echo "Initializing python-apple-fm-sdk submodule..."
    git submodule update --init --recursive
  fi
}

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "master" && "$BRANCH" != "main" ]]; then
  echo "Error: release from master/main only (current: $BRANCH)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: working tree is not clean" >&2
  git status --porcelain >&2
  exit 1
fi

require_gh

GITHUB_ONLY="${GITHUB_ONLY:-0}"
for arg in "$@"; do
  case "$arg" in
    --github-only) GITHUB_ONLY=1 ;;
  esac
done

if [[ "$GITHUB_ONLY" != "1" ]]; then
  require_npm_auth
else
  echo "GitHub-only mode: skipping npm auth/publish"
fi
ensure_submodule

NAME="$(package_name)"
CURRENT_VERSION="$(package_version)"

echo "Building release artifacts..."
bun run build:release

echo "Running unit tests..."
bun run test

echo "Dry-run pack (ignore-scripts; artifacts already built)..."
npm pack --dry-run --ignore-scripts

if [[ "$YES" != "1" ]]; then
  read -r -p "Publish ${NAME}@${VERSION_ARG} (from ${CURRENT_VERSION}) to npm and create a GitHub release? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

if [[ "$VERSION_ARG" == "current" ]]; then
  VERSION="$CURRENT_VERSION"
  echo "Using existing version ${VERSION} (no bump)"
elif is_semver "$VERSION_ARG"; then
  npm version "$VERSION_ARG" --no-git-tag-version
  VERSION="$(package_version)"
else
  npm version "$VERSION_ARG" --no-git-tag-version
  VERSION="$(package_version)"
fi

TAG="v${VERSION}"

# Commit version bump when package.json changed
if [[ -n "$(git status --porcelain package.json)" ]]; then
  git add package.json
  if [[ -n "$(git status --porcelain bun.lock 2>/dev/null || true)" ]]; then
    git add bun.lock
  fi
  git commit -m "chore: release ${TAG}"
else
  if git rev-parse "${TAG}" >/dev/null 2>&1; then
    echo "Error: tag ${TAG} already exists" >&2
    exit 1
  fi
  echo "No version bump commit needed (publishing ${VERSION} from HEAD)"
fi

if git rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "Error: tag ${TAG} already exists" >&2
  exit 1
fi

echo "Creating git tag ${TAG}..."
git tag "${TAG}"

echo "Packing release tarball..."
cleanup_release_artifacts
# prepack already satisfied by build:release
npm pack --ignore-scripts
TARBALL="${NAME}-${VERSION}.tgz"
if [[ ! -f "$TARBALL" ]]; then
  echo "Error: expected tarball ${TARBALL} not found after npm pack" >&2
  exit 1
fi
trap cleanup_release_artifacts EXIT

if [[ "$GITHUB_ONLY" != "1" ]]; then
  echo "Publishing to npm..."
  # Avoid re-running prepack/build:release during publish
  npm publish --access public --ignore-scripts
else
  echo "Skipping npm publish (GITHUB_ONLY=1)"
fi

echo "Pushing commit and tag to GitHub..."
git push origin HEAD
git push origin "${TAG}"

echo "Creating GitHub release ${TAG}..."
NOTES_FILE="$(mktemp)"
{
  echo "## javascript-apple-fm-sdk ${TAG}"
  echo
  echo "TypeScript/JavaScript bindings for Apple on-device Foundation Models."
  echo
  echo "### Install"
  echo
  echo '```bash'
  echo "npm install ${NAME}@${VERSION}"
  echo '```'
  echo
  echo "### Notes"
  echo
  echo "- macOS 26+ Apple Silicon only (ships prebuilt \`build/libFoundationModels.dylib\` + N-API addon)"
  echo "- Compatible with apple/python-apple-fm-sdk v0.2.1 + #18 (see \`reference/UPSTREAM.md\`)"
  echo
} >"$NOTES_FILE"

if gh release view "${TAG}" >/dev/null 2>&1; then
  echo "GitHub release ${TAG} already exists; uploading tarball asset..."
  gh release upload "${TAG}" "${TARBALL}" --clobber
else
  gh release create "${TAG}" \
    --title "${NAME} ${TAG}" \
    --notes-file "${NOTES_FILE}" \
    "${TARBALL}"
fi
rm -f "${NOTES_FILE}"

RELEASE_URL="$(gh release view "${TAG}" --json url --jq .url)"

cleanup_release_artifacts
trap - EXIT

echo ""
echo "Release complete:"
echo "  npm:    ${NAME}@${VERSION}"
echo "  github: ${RELEASE_URL}"
