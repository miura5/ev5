#!/usr/bin/env sh
# Makes sure `node` is at least the major version in .nvmrc, the one CI uses, so a builder can run the full precheck. `npm run precheck` runs this first.
# On a Claude Code cloud sandbox (CLAUDE_CODE_REMOTE=true) an older Node is replaced: the newest release of that major
# comes from nodejs.org, its SHA-256 is checked, it is unpacked into /opt/node<major> and the node, npm and npx on PATH
# point at it, so later commands and builders in the same sandbox use it. Anywhere else it only says what to install.
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WANT=$(tr -d ' v\n' < "$ROOT/.nvmrc")
HAVE=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
[ "$HAVE" -ge "$WANT" ] && exit 0

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  echo "This needs Node $WANT or newer (.nvmrc); this machine has $(node -v 2>/dev/null || echo none). Install it (nvm use reads .nvmrc)." >&2
  exit 1
fi
case "$(uname -m)" in x86_64) ARCH=x64 ;; aarch64 | arm64) ARCH=arm64 ;; *) echo "setup-node: unknown arch $(uname -m)" >&2; exit 1 ;; esac
VER=$(curl -fsSL https://nodejs.org/dist/index.json | node -e '
  let s = ""; process.stdin.on("data", d => (s += d)).on("end", () => {
    const r = JSON.parse(s).find(x => x.version.startsWith(`v${process.argv[1]}.`));
    if (!r) process.exit(1);
    console.log(r.version);
  });' "$WANT")
NAME="node-$VER-linux-$ARCH"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
curl -fsSL -o "$TMP/$NAME.tar.xz" "https://nodejs.org/dist/$VER/$NAME.tar.xz"
curl -fsSL "https://nodejs.org/dist/$VER/SHASUMS256.txt" | grep " $NAME.tar.xz\$" > "$TMP/sum"
(cd "$TMP" && sha256sum -c sum > /dev/null) || { echo "setup-node: checksum mismatch for $NAME" >&2; exit 1; }
DEST=/opt/node$WANT
BIN=$(dirname "$(command -v node)")
rm -rf "$DEST" && mkdir -p "$DEST"
tar -xJf "$TMP/$NAME.tar.xz" -C "$DEST" --strip-components=1
for t in node npm npx; do ln -sf "$DEST/bin/$t" "$BIN/$t"; done
echo "setup-node: Node $VER from $DEST is now the node on PATH ($BIN)"
