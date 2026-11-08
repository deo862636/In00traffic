#!/usr/bin/env bash
# setup.sh — In00traffic one-command setup (Termux / macOS / Linux / Windows-WSL)
# Beginner friendly: just run it, it does everything and tells you what it did.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/deo862636/In00traffic/main/setup.sh | bash
#   bash setup.sh                 # install + run the capture
#   bash setup.sh --install-only  # install only, do not run
#
# What it installs (only what is missing):
#   1. The project files themselves (clone the repo if you ran this with curl)
#   2. Node.js 18+ (Termux: pkg, macOS: brew, Linux: apt)
#   3. Chromium (Termux: pkg, macOS: brew cask, Linux: apt)
#   4. playwright-core (npm, inside the project folder)
#
# IMPORTANT — Termux / Android:
#   Playwright CANNOT download its own Chromium on Android
#   ("Unsupported platform: android"). So on Termux we NEVER run
#   `playwright install chromium` — we always use the system Chromium
#   from `pkg install chromium`, and we tell capture.js where it is.
#   If that step fails, the script stops and tells you exactly what to type.
#
# The capture script only RECORDS traffic. You fill the form and solve
# any CAPTCHA yourself in the browser window. It never submits anything.

set -u
INSTALL_ONLY=0
for a in "$@"; do if [ "$a" = "--install-only" ]; then INSTALL_ONLY=1; fi; done

say() { echo "[setup] $*"; }
have() { command -v "$1" >/dev/null 2>&1; }
is_termux() { [ -d /data/data/com.termux/files/usr ] || [ -n "${TERMUX_VERSION:-}" ]; }
is_macos() { [ "$(uname -s)" = "Darwin" ]; }
is_android() { is_termux || [ "$(uname -o 2>/dev/null)" = "Android" ]; }

say "🔧 In00traffic setup — installing anything missing."

# --- 0. Get the project files (needed when run with curl | bash) --------------
# When you run `curl ... | bash`, this script is the ONLY file on your phone.
# capture.js / package.json are not there yet, so fetch them first.
if [ ! -f capture.js ]; then
  say "📥 capture.js not found here — getting the project files..."
  if have git; then
    if [ -d In00traffic ]; then
      say "📂 Found an In00traffic folder — using it."
      cd In00traffic || exit 1
    else
      git clone https://github.com/deo862636/In00traffic.git || {
        echo "❌ ERROR: could not clone the repo. Check your internet and try again."
        exit 1
      }
      cd In00traffic || exit 1
    fi
  else
    # No git? Download the 3 files we need directly from GitHub.
    say "📥 No git found — downloading the files directly..."
    mkdir -p In00traffic && cd In00traffic || exit 1
    for f in capture.js package.json README.md; do
      curl -fsSL "https://raw.githubusercontent.com/deo862636/In00traffic/main/$f" -o "$f" || {
        echo "❌ ERROR: could not download $f. Check your internet and try again."
        exit 1
      }
    done
  fi
  say "✅ Project files ready in: $(pwd)"
else
  say "✅ Project files already here: $(pwd)"
fi

# --- 1. Node.js -------------------------------------------------------------
if have node; then
  MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
  say "✅ Node already installed: $(node --version)"
  if [ "$MAJOR" -lt 18 ]; then
    say "⚠️ Node $MAJOR is too old (need 18+), upgrading..."
    if is_termux; then pkg install -y nodejs-lts
    elif is_macos; then brew install node
    else sudo apt-get install -y nodejs npm 2>/dev/null || true; fi
    say "✅ Node now: $(node --version 2>&1)"
  fi
else
  say "📦 Installing Node.js..."
  if is_termux; then pkg update -y && pkg install -y nodejs-lts
  elif is_macos; then
    if ! have brew; then say "Installing Homebrew..."; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; fi
    brew install node
  else sudo apt-get update && sudo apt-get install -y nodejs npm; fi
  if have node; then say "✅ Node installed: $(node --version)"; else echo "❌ ERROR: Node install failed. Try installing Node yourself, then run this script again."; exit 1; fi
fi

# --- 2. Chromium (system browser — REQUIRED on Termux/Android) ---------------
# Find it the way a beginner would: `which chromium`.
find_chromium() {
  for c in chromium chromium-browser google-chrome google-chrome-stable; do
    if have "$c"; then command -v "$c"; return 0; fi
  done
  for p in "$PREFIX/bin/chromium" "$PREFIX/bin/chromium-browser" /data/data/com.termux/files/usr/bin/chromium /data/data/com.termux/files/usr/bin/chromium-browser /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome; do
    if [ -x "$p" ]; then echo "$p"; return 0; fi
  done
  return 1
}

CHROMIUM_BIN="$(find_chromium || true)"
if [ -n "$CHROMIUM_BIN" ]; then
  say "✅ Chromium found: $CHROMIUM_BIN"
else
  say "📦 Installing Chromium (this is the browser the capture uses)..."
  if is_termux; then
    pkg update -y && pkg install -y chromium
  elif is_macos; then
    brew install --cask chromium || say "⚠️ brew Chromium failed — install Chromium from https://www.chromium.org and run this script again."
  else
    sudo apt-get install -y chromium-browser 2>/dev/null || sudo apt-get install -y chromium 2>/dev/null || true
  fi
  CHROMIUM_BIN="$(find_chromium || true)"
  if [ -n "$CHROMIUM_BIN" ]; then
    say "✅ Chromium installed: $CHROMIUM_BIN"
  else
    echo ""
    echo "❌ ERROR: Chromium was not found after installing."
    echo "   On Termux, run this yourself and then run setup.sh again:"
    echo "     pkg install chromium"
    echo "     which chromium   (should print a path)"
    exit 1
  fi
fi
# Tell capture.js exactly which browser to use.
export CHROMIUM_PATH="$CHROMIUM_BIN"
say "📌 Using browser: $CHROMIUM_BIN"

# --- 3. playwright-core (inside THIS folder, not in your home folder) --------
if [ -d node_modules/playwright-core ]; then
  say "✅ playwright-core already installed."
else
  say "📦 Installing playwright-core (one time, inside this folder)..."
  [ -f package.json ] || npm init -y >/dev/null 2>&1
  npm install playwright-core || { echo "❌ ERROR: npm install failed. Check your internet and try again."; exit 1; }
  say "✅ playwright-core installed."
fi

# --- 4. Playwright's own Chromium — SKIPPED on Android, and only if needed ---
if is_android; then
  say "⏭️ Skipping Playwright Chromium download — Android is not supported by Playwright, system Chromium is used instead."
elif [ -n "$CHROMIUM_BIN" ]; then
  say "⏭️ Skipping Playwright Chromium download — system Chromium will be used."
else
  if ls "$HOME/.cache/ms-playwright/chromium-"* >/dev/null 2>&1; then say "✅ Playwright Chromium already downloaded."
  else
    say "📦 Downloading Playwright Chromium (about 130 MB, one time)..."
    npx playwright-core install chromium || say "⚠️ Download failed — make sure a system Chromium is installed and run this script again."
  fi
fi

# --- 5. Check the capture script ----------------------------------------------
if [ ! -f capture.js ]; then echo "❌ ERROR: capture.js is still missing from $(pwd). Re-clone the repo and try again."; exit 1; fi
node --check capture.js && say "✅ capture.js syntax OK."

if [ "$INSTALL_ONLY" = "1" ]; then say "✅ Install only — done. Run with: node capture.js"; exit 0; fi

say "🚀 Starting capture (headed browser — YOU fill the form)..."
say "   When the confirmation-code screen appears, STOP and close the browser."
CHROMIUM_PATH="$CHROMIUM_BIN" node capture.js
EXIT=$?
if [ $EXIT -eq 0 ]; then say "✅ Done. Output in ./out/ (ig_capture.har, requests.jsonl, requests_summary.txt)"; else say "❌ Finished with exit $EXIT. Read the error above — most Termux errors are fixed by: pkg install chromium"; fi
exit $EXIT
