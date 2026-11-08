#!/usr/bin/env bash
# setup.sh — In00traffic one-command setup (Termux / macOS / Linux / Windows-WSL)
# Usage:
#   bash setup.sh                 # install + run the capture
#   bash setup.sh --install-only  # install only, do not run
#   curl -fsSL https://raw.githubusercontent.com/deo862636/In00traffic/main/setup.sh | bash
#
# Installs ONLY what is missing, skipping what already exists:
#   1. Node.js 18+ (Termux: pkg, macOS: brew, Linux: apt)
#   2. Chromium (Termux: pkg, macOS: brew cask, Linux: apt) — optional,
#      Playwright's Chromium is downloaded as a fallback.
#   3. playwright-core (npm, in this folder)
#   4. Playwright Chromium (only if no system Chromium was found)
# Then runs: node capture.js
# The capture script only RECORDS traffic. You fill the form and solve
# any CAPTCHA yourself in the browser window. It never submits anything.

set -u
cd "$(dirname "$0")"
INSTALL_ONLY=0
for a in "$@"; do if [ "$a" = "--install-only" ]; then INSTALL_ONLY=1; fi; done

say() { echo "[setup] $*"; }
have() { command -v "$1" >/dev/null 2>&1; }
is_termux() { [ -d /data/data/com.termux/files/usr ]; }
is_macos() { [ "$(uname -s)" = "Darwin" ]; }

say "🔧 In00traffic setup — installing anything missing."

# --- 1. Node.js -------------------------------------------------------------
if have node; then
  MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
  say "✅ Node already installed: $(node --version)"
  if [ "$MAJOR" -lt 18 ]; then say "⚠️ Node $MAJOR is too old (need 18+), upgrading..."; else MAJOR_OK=1; fi
  if [ "$MAJOR" -lt 18 ]; then
    if is_termux; then pkg install -y nodejs-lts
    elif is_macos; then brew install node
    else sudo apt-get install -y nodejs npm 2>/dev/null || true; fi
  fi
else
  say "📦 Installing Node.js..."
  if is_termux; then pkg update -y && pkg install -y nodejs-lts
  elif is_macos; then
    if ! have brew; then say "Installing Homebrew..."; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; fi
    brew install node
  else sudo apt-get update && sudo apt-get install -y nodejs npm; fi
  say "✅ Node installed: $(node --version 2>&1)"
fi

# --- 2. Chromium (optional — Playwright can download its own) ---------------
CHROMIUM_BIN=""
for p in /data/data/com.termux/files/usr/bin/chromium /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /Applications/Chromium.app/Contents/MacOS/Chromium; do
  if [ -x "$p" ]; then CHROMIUM_BIN="$p"; break; fi
done
if [ -n "$CHROMIUM_BIN" ]; then say "✅ Chromium already installed: $CHROMIUM_BIN"
else
  say "📦 Installing Chromium..."
  if is_termux; then pkg install -y chromium 2>&1 | tail -2 || true
  elif is_macos; then brew install --cask chromium 2>&1 | tail -2 || say "⚠️ brew Chromium failed — Playwright will download its own."
  else sudo apt-get install -y chromium-browser 2>&1 | tail -2 || sudo apt-get install -y chromium 2>&1 | tail -2 || true; fi
  for p in /data/data/com.termux/files/usr/bin/chromium /usr/bin/chromium /usr/bin/chromium-browser; do if [ -x "$p" ]; then CHROMIUM_BIN="$p"; break; fi; done
  if [ -n "$CHROMIUM_BIN" ]; then say "✅ Chromium installed: $CHROMIUM_BIN"; else say "ℹ️ No system Chromium — Playwright will download its own."; fi
fi

# --- 3. playwright-core -------------------------------------------------------
if [ -d node_modules/playwright-core ]; then say "✅ playwright-core already installed."
else
  say "📦 Installing playwright-core..."
  [ -f package.json ] || npm init -y >/dev/null 2>&1
  npm install playwright-core || { echo "❌ ERROR: npm install failed. Check your internet."; exit 1; }
fi

# --- 4. Playwright Chromium (only if no system Chromium) ----------------------
if [ -z "$CHROMIUM_BIN" ]; then
  if ls "$HOME/.cache/ms-playwright/chromium-"* >/dev/null 2>&1; then say "✅ Playwright Chromium already downloaded."
  else
    say "📦 Downloading Playwright Chromium (about 130 MB, one time)..."
    npx playwright-core install chromium || say "⚠️ Download failed — try running with a system Chromium installed."
  fi
else say "⏭️ Skipping Playwright Chromium download — system Chromium will be used."; fi

# --- 5. Check the capture script ----------------------------------------------
if [ ! -f capture.js ]; then echo "❌ ERROR: capture.js is missing from this folder."; exit 1; fi
node --check capture.js && say "✅ capture.js syntax OK."

if [ "$INSTALL_ONLY" = "1" ]; then say "✅ Install only — done. Run with: node capture.js"; exit 0; fi

say "🚀 Starting capture (headed browser — YOU fill the form)..."
say "   When the confirmation-code screen appears, STOP and close the browser."
node capture.js
EXIT=$?
if [ $EXIT -eq 0 ]; then say "✅ Done. Output in ./out/ (ig_capture.har, requests.jsonl, requests_summary.txt)"; else say "❌ Finished with exit $EXIT."; fi
exit $EXIT
