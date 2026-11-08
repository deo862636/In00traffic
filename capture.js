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

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let outDir = './out';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outDir = args[++i];
  if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: node capture.js [--out <dir>]\n\nOpens Instagram signup in Chromium with HAR recording.\nYOU fill the form, solve any CAPTCHA, and submit it yourself.\nThe script only records network traffic and stops at the OTP screen.');
    process.exit(0);
  }
}
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

  const browser = await chromium.launch({
    headless: false, // headed on purpose: YOU need to see the browser to fill it in
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
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
