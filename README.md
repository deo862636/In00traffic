# 📡 In00traffic

> **Network traffic capture for the Instagram signup page — for learning and testing on your own account.**
>
> ⚠️ This tool **only records** network traffic. It does **not** fill in forms, submit anything, solve CAPTCHAs, or enter OTP codes. **You** do all of those steps yourself, in your own browser, on your own device.

---

## ✨ What it does

| Step | Who does it? |
| --- | --- |
| Opens the signup page in Chromium with HAR recording | 🤖 This script |
| Records every request (URL, method, headers, timing) | 🤖 This script |
| Fills in the form | 🙋 **You** |
| Solves any CAPTCHA | 🙋 **You** |
| Clicks Submit | 🙋 **You** |
| Enters the OTP code | 🙋 **You** (or stop here — recommended) |

**Output:** `ig_capture.har`, `requests.jsonl`, `requests_summary.txt` in `./out/`

---

## 🚀 One-command setup (zero to complete)

Pick your device. **One command, it installs everything missing and starts the capture.**

### 📱 Termux (Android)

```bash
curl -fsSL https://raw.githubusercontent.com/deo862636/In00traffic/main/setup.sh | bash
```

Or, if you already cloned the repo:

```bash
bash setup.sh
```

### 🍎 macOS

```bash
curl -fsSL https://raw.githubusercontent.com/deo862636/In00traffic/main/setup.sh | bash
```

Needs: [Homebrew](https://brew.sh) (the script installs it if missing) — or just run `bash setup.sh` after cloning.

### 🐧 Linux (Ubuntu / Debian / PC)

```bash
curl -fsSL https://raw.githubusercontent.com/deo862636/In00traffic/main/setup.sh | bash
```

### 🪟 Windows

Use **WSL** (Windows Subsystem for Linux), then run the Linux command above. Or use Git Bash:

```bash
bash setup.sh
```

---

## 🧑‍💻 Manual setup (step by step)

### 1️⃣ Install Node.js (18+)

| Device | Command |
| --- | --- |
| Termux | `pkg install -y nodejs-lts` |
| macOS | `brew install node` |
| Linux | `sudo apt install -y nodejs npm` |
| Windows | Download from [nodejs.org](https://nodejs.org) |

Check it: `node --version` → should be `v18` or newer.

### 2️⃣ Install Chromium

| Device | Command |
| --- | --- |
| Termux | `pkg install -y chromium` |
| macOS | `brew install --cask chromium` (or let Playwright download it) |
| Linux | `sudo apt install -y chromium-browser` |

Or let the setup script download Playwright's Chromium for you — it does that automatically if no system Chromium is found.

### 3️⃣ Install the project

```bash
git clone https://github.com/deo862636/In00traffic.git
cd In00traffic
npm install playwright-core
npx playwright-core install chromium
```

### 4️⃣ Run the capture

```bash
node capture.js
```

A browser window opens. **You** fill in the form, solve any CAPTCHA, and click Submit yourself. When the confirmation-code screen appears, **stop** — close the browser. The HAR is saved.

---

## 📂 Project files

```
In00traffic/
├── 📄 README.md          ← you are here
├── 📜 capture.js         ← the HAR capture script (the only script)
├── 🛠️ setup.sh           ← one-command setup for Termux / macOS / Linux
├── 📦 package.json       ← playwright-core dependency
└── 🙈 .gitignore         ← keeps out/ and node_modules/ out of git
```

---

## 🔍 Reading your capture

1. Open Chrome DevTools → **Network** tab → **Import HAR** → pick `out/ig_capture.har`
2. Or read `out/requests_summary.txt` — it lists the requests matching `graphql`, `api/v1`, `accounts/`, `signup`, `challenge`, `recaptcha`
3. Or grep the raw log: `grep graphql out/requests.jsonl`

> **Honest note:** if no submit endpoint appears in *your* capture, then no submit endpoint was observed. A mention of `graphql` in page HTML is a hint, not proof of an endpoint. Do not invent a URL.

---

## 🔒 Privacy

- The HAR file contains session cookies. **Keep it private — do not share it.**
- Phone numbers and other identifiers are redacted in the summary where possible.
- Nothing in this repo sends your data anywhere. All capture is local.

---

## ❓ FAQ

**Q: Will this create an account for me?**
A: No. It only records traffic. You create the account yourself, if you choose to.

**Q: Will it solve the CAPTCHA?**
A: No. You solve it yourself in the browser window.

**Q: I got an OTP — should I type it in?**
A: Only on Instagram's own screen, on your own device, if you want to finish creating *your* account. Never paste an OTP into a script, a chat, or a third-party site.

**Q: It says "no submit endpoint observed"?**
A: That means your capture didn't contain one. That is a real result — report it as-is, don't guess a URL.

---

## 📜 Licence

MIT — see `LICENSE`.
