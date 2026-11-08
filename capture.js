// capture.js — Instagram signup NETWORK CAPTURE (testing / learning only)
// ---------------------------------------------------------------------------
// What this does:
//   Opens the Instagram signup page in Chromium with HAR recording ON.
//   YOU fill in the form yourself, YOU solve any CAPTCHA yourself, and
//   YOU submit it yourself, in the browser window you can see.
//   This script only RECORDS the network traffic (request URLs, methods,
//   headers, timing) to a HAR file + a readable summary, and STOPS
//   when the confirmation-code screen appears. It never enters an OTP.
//
// What this does NOT do:
//   - It does NOT fill in any field for you.
//   - It does NOT submit the form.
//   - It does NOT solve a CAPTCHA (checkbox or image grid).
//   - It does NOT invent a password, date of birth, name, or username.
//   - It does NOT enter an OTP code or create an account.
//
// Why: the signup step, the CAPTCHA, and the OTP belong to you, on your
// own device, with your own account and your own number. A script that
// does those steps for you is automation against Instagram's terms.
// This tool is for analysing traffic YOU captured, nothing more.
//
// Usage:
//   node capture.js
//   node capture.js --out out
//   CHROMIUM_PATH=/path/to/chromium node capture.js
//   node capture.js --chromium /path/to/chromium
//
// Browser: Playwright CANNOT download its own Chromium on Android/Termux
// ("Unsupported platform: android"), so on Termux we MUST use the system
// Chromium from `pkg install chromium`. setup.sh finds it and sets
// CHROMIUM_PATH for you. If you run capture.js by hand on Termux and it
// says "no Chromium found", run: pkg install chromium && which chromium
// and then: CHROMIUM_PATH=$(which chromium) node capture.js
//
// Then, in the browser window:
//   1. Fill in the signup form yourself.
//   2. Solve the CAPTCHA yourself if one appears.
//   3. Click Submit yourself.
//   4. When the "Enter the confirmation code" screen appears, STOP.
//      Do NOT type the code into this script. Close the browser or
//      press Ctrl+C in the terminal. The HAR is saved on close.
//
// Output (in --out, default ./out):
//   ig_capture.har        Full HAR - open in Chrome DevTools > Network > Import
//   requests.jsonl        One JSON object per request/response
//   requests_summary.txt  Human-readable list of the interesting requests
//
// Privacy: the HAR contains session cookies. Keep it private, do not share it.

// FIX FOR TERMUX / ANDROID — must run BEFORE requiring playwright-core.
// On Termux, Node reports process.platform === 'android', and Playwright's
// registry code throws "Unsupported platform: android" when it tries to
// work out its default cache folder. Setting these two env vars makes
// Playwright use a normal folder instead, and it never hits that throw:
//   PLAYWRIGHT_BROWSERS_PATH — where Playwright keeps its browser registry
//   PWTEST_SERVER_REGISTRY   — where its browser-server registry lives
// setup.sh exports both for you; this block is the safety net if you run
// capture.js by hand. Proven: without them, require('playwright-core')
// throws on Android; with them, it loads fine.
const fs = require('fs');
const path = require('path');
const os = require('os');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), '.cache', 'ms-playwright');
}
if (!process.env.PWTEST_SERVER_REGISTRY) {
  process.env.PWTEST_SERVER_REGISTRY = path.join(os.homedir(), '.cache', 'ms-playwright', 'b');
}
for (const d of [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.PWTEST_SERVER_REGISTRY]) {
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* ignore */ }
}

const { chromium } = require('playwright-core');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
let outDir = './out';
let chromiumPath = process.env.CHROMIUM_PATH || '';
let headlessFlag = null; // null = auto-detect
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outDir = args[++i];
  if (args[i] === '--chromium') chromiumPath = args[++i];
  if (args[i] === '--headed') headlessFlag = false;
  if (args[i] === '--headless') headlessFlag = true;
  if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: node capture.js [--out <dir>] [--chromium <path>] [--headed|--headless]\n\nOpens Instagram signup in Chromium with HAR recording.\nYOU fill the form, solve any CAPTCHA, and submit it yourself.\nThe script only records network traffic and stops at the OTP screen.\n\nOn Termux/Android, set CHROMIUM_PATH to your system Chromium:\n  CHROMIUM_PATH=$(which chromium) node capture.js\n\nDisplay: a headed browser needs a screen ($DISPLAY). Termux has no\nscreen, so without one the script runs HEADLESS automatically.\nHeadless captures the page load only — nobody can fill the form in\nan invisible browser. To fill the form yourself on Termux, run\nsetup.sh first (it starts a virtual display + VNC you can view),\nthen: DISPLAY=:99 node capture.js --headed');
    process.exit(0);
  }
}

// HEADED vs HEADLESS — auto-detect, because this is the error that bites
// on Termux again and again: a headed browser needs an X server / $DISPLAY,
// and Termux is a terminal with no screen. Chromium then dies with
// "Missing X server or $DISPLAY" / "The platform failed to initialize".
// So: headed only when a display actually exists (or --headed forces it);
// otherwise headless, which always works on Termux.
const isAndroid = process.platform === 'android' || !!process.env.TERMUX_VERSION || fs.existsSync('/data/data/com.termux/files/usr');
const hasDisplay = !!process.env.DISPLAY;
const headless = headlessFlag !== null ? headlessFlag : !hasDisplay;
if (headless) {
  console.log('🖥️  No display found' + (isAndroid ? ' (Termux has no screen)' : '') + ' — running HEADLESS.');
  console.log('   Headless captures the page load only. To fill the form');
  console.log('   yourself in a visible browser, run setup.sh (it starts');
  console.log('   a virtual display + VNC), then run with --headed.');
} else {
  console.log('🖥️  Display found (' + process.env.DISPLAY + ') — running HEADED, you fill the form yourself.');
}

// Find a system Chromium, the same way `which chromium` does.
// Playwright's own browser download does NOT work on Android, so a
// system Chromium is required there — never silently fall back to a
// download that will fail with "Unsupported platform: android".
function findChromium() {
  if (chromiumPath && fs.existsSync(chromiumPath)) return chromiumPath;
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const p = execSync(`command -v ${name}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      if (p) return p;
    } catch { /* not found, try next */ }
  }
  const candidates = [
    process.env.PREFIX ? `${process.env.PREFIX}/bin/chromium` : '',
    process.env.PREFIX ? `${process.env.PREFIX}/bin/chromium-browser` : '',
    '/data/data/com.termux/files/usr/bin/chromium',
    '/data/data/com.termux/files/usr/bin/chromium-browser',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  ];
  for (const p of candidates) if (p && fs.existsSync(p)) return p;
  return '';
}
const foundChromium = findChromium();
if (!foundChromium && isAndroid) {
  console.error('');
  console.error('❌ ERROR: No system Chromium found, and Playwright cannot download');
  console.error('   its own Chromium on Android ("Unsupported platform: android").');
  console.error('');
  console.error('   Fix it with these 2 commands, then run this script again:');
  console.error('     pkg install chromium');
  console.error('     CHROMIUM_PATH=$(which chromium) node capture.js');
  console.error('');
  process.exit(1);
}
if (foundChromium) console.log('Using browser:', foundChromium);
fs.mkdirSync(outDir, { recursive: true });

function redactHeaders(h) {
  const out = { ...h };
  for (const k of Object.keys(out)) {
    if (/cookie|authorization|x-csrftoken|set-cookie/i.test(k)) out[k] = '[REDACTED]';
  }
  return out;
}

(async () => {
  const requests = [];
  const log = fs.createWriteStream(path.join(outDir, 'requests.jsonl'), { flags: 'w' });

  let browser;
  try {
    browser = await chromium.launch({
      headless, // headed only when a display exists; headless on Termux (no $DISPLAY)
      executablePath: foundChromium || undefined, // system Chromium on Termux/Android; Playwright's own elsewhere
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
  } catch (e) {
    if (/Missing X server|DISPLAY|platform failed to initialize/i.test(e.message)) {
      console.error('');
      console.error('❌ ERROR: Headed browser needs a screen, and this machine has none.');
      console.error('   Termux has no $DISPLAY, so Chromium cannot draw a window and exits.');
      console.error('   The inotify / dbus lines in the log are harmless warnings, not the cause.');
      console.error('');
      console.error('   Fix it one of these ways:');
      console.error('     1. Run headless (page-load capture only):  node capture.js --headless');
      console.error('     2. Run setup.sh — it starts a virtual display + VNC,');
      console.error('        then run:  DISPLAY=:99 node capture.js --headed');
      console.error('');
      process.exit(1);
    }
    throw e;
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    recordHar: { path: path.join(outDir, 'ig_capture.har'), content: 'embed' },
  });
  const page = await context.newPage();

  page.on('request', (req) => {
    const e = { t: new Date().toISOString(), phase: 'request', method: req.method(), url: req.url(), headers: redactHeaders(req.headers()) };
    requests.push(e); log.write(JSON.stringify(e) + '\n');
  });
  page.on('response', (res) => {
    const e = { t: new Date().toISOString(), phase: 'response', method: res.request().method(), url: res.url(), status: res.status() };
    requests.push(e); log.write(JSON.stringify(e) + '\n');
  });

  console.log('Opening https://www.instagram.com/accounts/signup/phone ...');
  await page.goto('https://www.instagram.com/accounts/signup/phone', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Final URL:', page.url());

  if (headless) {
    // Headless: nobody can see the browser, so nobody can fill the form.
    // Waiting 10 minutes for an OTP screen that can never appear would
    // just hang. Capture the page load (15 s for the network to settle),
    // save it, and say so plainly.
    console.log('');
    console.log('Headless mode: waiting 15 s for the page to finish loading, then saving.');
    await page.waitForTimeout(15000).catch(() => {});
    console.log('Page load captured. The signup SUBMIT was not captured —');
    console.log('nobody could fill the form in an invisible browser.');
    console.log('To capture the submit, run setup.sh (virtual display + VNC)');
    console.log('and then run: DISPLAY=:99 node capture.js --headed');
  } else {
    console.log('');
    console.log('>>> YOUR TURN <<<');
    console.log('1. Fill in the signup form YOURSELF in this browser window.');
    console.log('2. Solve any CAPTCHA YOURSELF if one appears.');
    console.log('3. Click Submit YOURSELF.');
    console.log('4. When the "Enter the confirmation code" screen appears, STOP.');
    console.log('   Do NOT type the code anywhere here. Just close the browser.');
    console.log('   The HAR + request log are saved when the browser closes.');
    console.log('');

    // Wait until the OTP screen appears, or the user closes the browser.
    // The script never clicks anything itself.
    try {
      await page.locator('text=Enter the confirmation code').first().waitFor({ timeout: 600000 });
      console.log('OTP screen reached. STOPPING - no code entered, nothing submitted by this script.');
    } catch {
      console.log('Browser closed or timed out (10 min). Saving what was captured.');
    }
  }

  const interesting = requests.filter((r) => r.url && /graphql|api\/v1|accounts\/|signup|challenge|recaptcha/i.test(r.url));
  const summary = [
    `Instagram signup capture - ${new Date().toISOString()}`,
    `Final URL: ${page.url()}`,
    ``,
    `Requests matching graphql / api / signup / challenge / recaptcha:`,
    ...interesting.filter((r) => r.phase === 'request').map((r) => `  ${r.method} ${r.url}`),
    ``,
    `Note: no submit endpoint is confirmed here unless it appears in the`,
    `list above from YOUR capture. A mention of graphql in page HTML is`,
    `not proof of a submit endpoint.`,
    ``,
    `Full log: requests.jsonl (${requests.length} entries)`,
    `Full HAR: ig_capture.har`,
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'requests_summary.txt'), summary);
  console.log('\n' + summary);

  log.end();
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
