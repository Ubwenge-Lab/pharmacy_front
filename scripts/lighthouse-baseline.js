#!/usr/bin/env node
/*
 * Lighthouse baseline harness — repeatable, authenticated Lighthouse runs.
 *
 *   npm run lighthouse:baseline -- --routes lighthouse/routes.example.json
 *   npm run lighthouse:baseline -- --routes lighthouse/routes.example.json --dry-run
 *
 * What it does, per invocation:
 *   1. Loads a route list (JSON file via --routes or LH_ROUTES).
 *   2. Logs in once per auth profile through the real /login UI (Puppeteer),
 *      so the app sets its own session cookies (accessToken, refreshToken,
 *      userRole, user). A pasted token is supported as a fallback.
 *   3. Runs Lighthouse N times (default 3) per route x device (mobile, desktop)
 *      in that logged-in browser, clearing the HTTP cache before every run.
 *   4. Fails any run whose final URL is not the requested route (the
 *      middleware redirects unauthenticated / wrong-role requests to "/").
 *   5. Writes, into a date-stamped folder:
 *        reports/<surface>__<device>__run<n>.report.{json,html}
 *        runs.csv      one row per run
 *        summary.csv   one row per surface x device (medians)
 *        meta.json     tool versions, base URL, git commit, timings
 *        index.html    dashboard, worst first, colour-coded against targets
 *
 * Exit codes: 0 = all runs passed, 1 = config / credentials / environment
 * problem (nothing measured), 2 = report written but at least one surface failed.
 *
 * See README.md, section "Lighthouse baseline harness".
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.lighthouse');

const DEFAULT_TARGETS = {
  // [good, poor]: <= good is green, > poor is red, between is amber.
  // Score is "higher is better", so it is inverted below.
  score: { good: 90, poor: 50, higherIsBetter: true },
  lcp: { good: 2500, poor: 4000 },
  cls: { good: 0.1, poor: 0.25 },
  tbt: { good: 200, poor: 600 },
  si: { good: 3400, poor: 5800 },
  fcp: { good: 1800, poor: 3000 },
  jsBytes: { good: 350 * 1024, poor: 1024 * 1024 },
  requests: { good: 50, poor: 100 },
};

// ---------------------------------------------------------------- utilities

function die(message, code = 1) {
  console.error(`\n[lighthouse-baseline] ERROR: ${message}\n`);
  process.exit(code);
}

function log(message) {
  console.log(`[lighthouse-baseline] ${message}`);
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) die(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--routes') args.routes = next();
    else if (a === '--out') args.out = next();
    else if (a === '--runs') args.runs = Number(next());
    else if (a === '--devices') args.devices = next().split(',').map((s) => s.trim());
    else if (a === '--only') args.only = next().split(',').map((s) => s.trim());
    else if (a === '--base-url') args.baseUrl = next();
    else if (a === '--dashboard-only') args.dashboardOnly = next();
    else if (a === '--help' || a === '-h') args.help = true;
    else die(`Unknown argument: ${a} (try --help)`);
  }
  return args;
}

const HELP = `
Usage: npm run lighthouse:baseline -- [options]

  --routes <file>         Route list JSON (or env LH_ROUTES). Required.
  --dry-run               Print the plan and equivalent CLI commands. Needs no credentials.
  --runs <n>              Runs per route x device (default: routes file "runs", else 3).
  --devices <list>        mobile,desktop (default: routes file "devices", else both).
  --only <surfaces>       Comma-separated surface names to run.
  --base-url <url>        Override the routes file baseUrl (or env LH_BASE_URL).
  --out <dir>             Output root (default: lighthouse-reports/). A date-stamped folder is created inside.
  --dashboard-only <dir>  Rebuild index.html / CSVs of an existing run folder from its JSON reports.

Credentials, per auth profile <P> (upper-case), from the environment or a gitignored .env.lighthouse:
  LH_<P>_EMAIL + LH_<P>_PASSWORD     preferred: logs in through the real login page
  LH_<P>_ACCESS_TOKEN                fallback: injected as the accessToken cookie (expires after ~30 min)
`;

/** Minimal KEY=VALUE loader for the gitignored .env.lighthouse. Never overrides real env vars. */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return false;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function median(values) {
  const v = values.filter((x) => typeof x === 'number' && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function gitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows, columns) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------ configuration

function loadRoutes(file, args) {
  if (!file) die('No route list. Pass --routes <file.json> or set LH_ROUTES. See lighthouse/routes.example.json.');
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) die(`Route list not found: ${abs}`);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    die(`Route list is not valid JSON (${abs}): ${e.message}`);
  }
  const baseUrl = (args.baseUrl || process.env.LH_BASE_URL || cfg.baseUrl || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(baseUrl)) die('No valid baseUrl. Set "baseUrl" in the routes file, LH_BASE_URL, or --base-url.');
  if (!Array.isArray(cfg.routes) || !cfg.routes.length) die(`"routes" must be a non-empty array in ${abs}`);

  const profiles = cfg.profiles || {};
  const seen = new Set();
  let routes = cfg.routes.map((r, i) => {
    if (!r.surface || !r.path) die(`routes[${i}] needs "surface" and "path"`);
    if (!r.path.startsWith('/')) die(`routes[${i}].path must start with "/" (got ${r.path})`);
    if (seen.has(r.surface)) die(`Duplicate surface name "${r.surface}"`);
    seen.add(r.surface);
    const auth = r.auth || 'none';
    if (auth !== 'none' && !profiles[auth]) die(`routes[${i}] uses auth profile "${auth}" which is not defined under "profiles"`);
    return { surface: r.surface, path: r.path, auth };
  });
  if (args.only) {
    const unknown = args.only.filter((s) => !seen.has(s));
    if (unknown.length) die(`--only names unknown surface(s): ${unknown.join(', ')}`);
    routes = routes.filter((r) => args.only.includes(r.surface));
  }

  const devices = args.devices || cfg.devices || ['mobile', 'desktop'];
  for (const d of devices) if (!['mobile', 'desktop'].includes(d)) die(`Unknown device "${d}" (use mobile, desktop)`);
  const runs = args.runs || cfg.runs || 3;
  if (!Number.isInteger(runs) || runs < 1) die(`runs must be a positive integer (got ${runs})`);

  const targets = { ...DEFAULT_TARGETS };
  for (const [k, v] of Object.entries(cfg.targets || {})) targets[k] = { ...targets[k], ...v };

  return { file: abs, baseUrl, profiles, routes, devices, runs, targets };
}

function profileEnv(name) {
  const P = name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return {
    emailVar: `LH_${P}_EMAIL`,
    passwordVar: `LH_${P}_PASSWORD`,
    tokenVar: `LH_${P}_ACCESS_TOKEN`,
    refreshVar: `LH_${P}_REFRESH_TOKEN`,
  };
}

/** Resolve credentials for every profile in use. Exits non-zero naming the missing variables. */
function resolveCredentials(cfg) {
  const used = [...new Set(cfg.routes.map((r) => r.auth).filter((a) => a !== 'none'))];
  const creds = {};
  const missing = [];
  for (const name of used) {
    const e = profileEnv(name);
    const email = process.env[e.emailVar];
    const password = process.env[e.passwordVar];
    const token = process.env[e.tokenVar];
    if (email && password) {
      creds[name] = { mode: 'login', email, password, loginPath: cfg.profiles[name].loginPath || '/login' };
    } else if (token) {
      const claims = decodeJwt(token);
      if (!claims) die(`${e.tokenVar} is not a decodable JWT.`);
      if (claims.exp && claims.exp * 1000 < Date.now()) {
        die(`${e.tokenVar} expired at ${new Date(claims.exp * 1000).toISOString()}. Log in again and copy a fresh accessToken cookie (see README: "Refreshing an expired token").`);
      }
      creds[name] = { mode: 'token', token, refreshToken: process.env[e.refreshVar], claims };
    } else {
      missing.push(`profile "${name}": set ${e.emailVar} + ${e.passwordVar} (or ${e.tokenVar})`);
    }
  }
  if (missing.length) {
    die(`Missing credentials:\n  - ${missing.join('\n  - ')}\nPut them in .env.lighthouse (gitignored) or export them. See .env.lighthouse.example.`);
  }
  return creds;
}

// ------------------------------------------------------------------ dry run

function dryRun(cfg, outDir) {
  log(`DRY RUN — nothing will be executed. Routes file: ${cfg.file}`);
  log(`Base URL: ${cfg.baseUrl}`);
  log(`Devices: ${cfg.devices.join(', ')} | runs per page: ${cfg.runs} | output: ${outDir}`);
  const used = [...new Set(cfg.routes.map((r) => r.auth).filter((a) => a !== 'none'))];
  for (const name of used) {
    const e = profileEnv(name);
    const has = (v) => (process.env[v] ? 'set' : 'not set');
    log(`Auth profile "${name}": logs in at ${cfg.profiles[name].loginPath || '/login'} via Puppeteer using ${e.emailVar} (${has(e.emailVar)}) + ${e.passwordVar} (${has(e.passwordVar)}); fallback ${e.tokenVar} (${has(e.tokenVar)})`);
  }
  console.log('\nEquivalent Lighthouse CLI commands (the script runs these through the Node API inside the logged-in browser):\n');
  let n = 0;
  for (const r of cfg.routes) {
    for (const device of cfg.devices) {
      for (let run = 1; run <= cfg.runs; run++) {
        n++;
        const base = `${slug(r.surface)}__${device}__run${run}`;
        const preset = device === 'desktop' ? ' --preset=desktop' : '';
        const session = r.auth === 'none'
          ? ''
          : ` --disable-storage-reset   # session: cookies from UI login as "${r.auth}" ($${profileEnv(r.auth).emailVar})`;
        console.log(`npx lighthouse "${cfg.baseUrl}${r.path}" --output=json --output=html --output-path="${path.join(outDir, 'reports', base)}" --chrome-flags="--headless=new"${preset} --only-categories=performance${session}`);
      }
    }
  }
  console.log(`\n${n} Lighthouse runs planned across ${cfg.routes.length} surface(s).`);
}

// --------------------------------------------------------------- the runner

async function checkReachable(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (res.status >= 500) die(`Environment unreachable: ${url} returned HTTP ${res.status}.`);
  } catch (e) {
    die(`Environment unreachable: ${url} (${e.cause?.code || e.message}). Check LH_BASE_URL / VPN / that the app is running.`);
  }
}

async function readCookie(context, baseUrl, name) {
  const page = await context.newPage();
  try {
    const cookies = await page.cookies(baseUrl);
    return cookies.find((c) => c.name === name)?.value;
  } finally {
    await page.close();
  }
}

async function login(context, cfg, profileName, cred) {
  const base = new URL(cfg.baseUrl);
  if (cred.mode === 'token') {
    const page = await context.newPage();
    const cookies = [{ name: 'accessToken', value: cred.token, domain: base.hostname, path: '/' }];
    if (cred.refreshToken) cookies.push({ name: 'refreshToken', value: cred.refreshToken, domain: base.hostname, path: '/' });
    if (cred.claims?.role) cookies.push({ name: 'userRole', value: cred.claims.role, domain: base.hostname, path: '/' });
    await page.setCookie(...cookies);
    await page.close();
    return { exp: cred.claims?.exp ? cred.claims.exp * 1000 : null };
  }

  const profile = cfg.profiles[profileName];
  const sel = {
    email: profile.emailSelector || 'input[type="email"]',
    password: profile.passwordSelector || 'input[type="password"]',
    submit: profile.submitSelector || 'button[type="submit"]',
  };
  const page = await context.newPage();
  try {
    await page.goto(cfg.baseUrl + cred.loginPath, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector(sel.email, { timeout: 30000 });
    await page.type(sel.email, cred.email);
    await page.type(sel.password, cred.password);
    await page.click(sel.submit);
    const deadline = Date.now() + 45000;
    let token;
    while (Date.now() < deadline) {
      const cookies = await page.cookies(cfg.baseUrl);
      token = cookies.find((c) => c.name === 'accessToken')?.value;
      if (token && !new URL(page.url()).pathname.startsWith(cred.loginPath)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!token) {
      die(`Login failed for profile "${profileName}": no accessToken cookie after submitting ${cred.loginPath}. Check ${profileEnv(profileName).emailVar}/${profileEnv(profileName).passwordVar} and that the backend is up.`);
    }
    // Let the post-login redirect settle so every cookie the app sets is present.
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 20000 }).catch(() => {});
    const claims = decodeJwt(token);
    log(`  logged in as profile "${profileName}" (role ${claims?.role ?? '?'}), landed on ${new URL(page.url()).pathname}`);
    return { exp: claims?.exp ? claims.exp * 1000 : null };
  } finally {
    await page.close();
  }
}

function extractMetrics(lhr) {
  const a = lhr.audits;
  const num = (id) => (a[id] && typeof a[id].numericValue === 'number' ? a[id].numericValue : null);
  let jsBytes = null;
  let requests = null;
  const summary = a['resource-summary']?.details?.items;
  if (Array.isArray(summary)) {
    jsBytes = summary.find((i) => i.resourceType === 'script')?.transferSize ?? null;
    requests = summary.find((i) => i.resourceType === 'total')?.requestCount ?? null;
  }
  const net = a['network-requests']?.details?.items;
  if (Array.isArray(net)) {
    if (requests === null) requests = net.length;
    if (jsBytes === null) jsBytes = net.filter((i) => i.resourceType === 'Script').reduce((s, i) => s + (i.transferSize || 0), 0);
  }
  const perf = lhr.categories?.performance?.score;
  return {
    topFixes: extractTopFixes(lhr),
    score: typeof perf === 'number' ? Math.round(perf * 100) : null,
    lcp: num('largest-contentful-paint'),
    inp: null, // Navigation-mode Lighthouse cannot measure INP; TBT is the lab proxy.
    cls: num('cumulative-layout-shift'),
    tbt: num('total-blocking-time'),
    si: num('speed-index'),
    fcp: num('first-contentful-paint'),
    jsBytes,
    requests,
  };
}

/**
 * The three failing audits with the biggest estimated time savings, e.g.
 * "Reduce unused JavaScript (Est savings of 158 KiB, ~900 ms LCP)". Turns the
 * dashboard from a scoreboard into a to-do list.
 */
function extractTopFixes(lhr, limit = 3) {
  const refs = lhr.categories?.performance?.auditRefs || [];
  const metricIds = new Set(refs.filter((r) => r.group === 'metrics').map((r) => r.id));
  const fixes = [];
  for (const ref of refs) {
    const a = lhr.audits?.[ref.id];
    if (!a || metricIds.has(ref.id) || a.score === null || a.score >= 0.9) continue;
    const s = a.metricSavings || {};
    const ms = Math.max(s.LCP || 0, s.FCP || 0, s.TBT || 0, a.details?.overallSavingsMs || 0);
    if (ms < 50) continue;
    const metric = ['LCP', 'FCP', 'TBT'].find((m) => (s[m] || 0) === ms) || 'load';
    fixes.push({ ms, label: `${a.title}${a.displayValue ? ` (${a.displayValue})` : ''} — ~${Math.round(ms / 10) * 10} ms ${metric}` });
  }
  return fixes.sort((x, y) => y.ms - x.ms).slice(0, limit).map((f) => f.label).join('; ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (args.dashboardOnly) {
    const dir = path.resolve(process.cwd(), args.dashboardOnly);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'runs.json'), 'utf8'));
    for (const r of rows) {
      if (r.topFixes === undefined && r.reportJson) {
        r.topFixes = extractTopFixes(JSON.parse(fs.readFileSync(path.join(dir, r.reportJson), 'utf8')));
      }
    }
    writeOutputs(dir, meta, rows);
    log(`Dashboard rebuilt: ${path.join(dir, 'index.html')}`);
    return;
  }

  const envLoaded = loadEnvFile(ENV_FILE);
  const cfg = loadRoutes(args.routes || process.env.LH_ROUTES, args);
  const outRoot = path.resolve(process.cwd(), args.out || process.env.LH_OUT || 'lighthouse-reports');
  const started = new Date();
  const outDir = path.join(outRoot, stamp(started));

  if (args.dryRun) {
    dryRun(cfg, outDir);
    return;
  }

  if (envLoaded) log('Loaded credentials from .env.lighthouse');
  const creds = resolveCredentials(cfg);
  await checkReachable(cfg.baseUrl);

  const lighthouse = (await import('lighthouse')).default;
  const desktopConfig = (await import('lighthouse/core/config/desktop-config.js')).default;
  const puppeteer = (await import('puppeteer')).default;
  const { ReportGenerator } = await import('lighthouse/report/generator/report-generator.js');
  const lhVersion = JSON.parse(fs.readFileSync(require.resolve('lighthouse/package.json'), 'utf8')).version;

  const chromeFlags = ['--headless=new', '--no-first-run', '--no-default-browser-check'];
  const launchOpts = { headless: true, args: chromeFlags, defaultViewport: null };
  if (process.env.LH_CHROME_PATH) launchOpts.executablePath = process.env.LH_CHROME_PATH;
  else launchOpts.channel = 'chrome';

  let browser;
  try {
    browser = await puppeteer.launch(launchOpts);
  } catch (e) {
    die(`Could not launch Chrome (${e.message.split('\n')[0]}). Install Google Chrome or set LH_CHROME_PATH.`);
  }
  const chromeVersion = await browser.version();
  fs.mkdirSync(path.join(outDir, 'reports'), { recursive: true });
  log(`Lighthouse ${lhVersion} | ${chromeVersion} | ${cfg.baseUrl}`);
  log(`Output: ${outDir}`);

  const sessions = {}; // profile -> { context, exp }
  const rows = [];
  const total = cfg.routes.length * cfg.devices.length * cfg.runs;
  let done = 0;

  async function getContext(profileName) {
    if (profileName === 'none') {
      // Fresh context per call: public pages are measured with no session at all.
      return browser.createBrowserContext();
    }
    let s = sessions[profileName];
    const expiringSoon = s?.exp && s.exp - Date.now() < 5 * 60 * 1000;
    if (s && expiringSoon) {
      if (creds[profileName].mode === 'token') {
        die(`The pasted token for profile "${profileName}" expires in under 5 minutes. Refresh it and re-run (README: "Refreshing an expired token").`);
      }
      log(`  session for "${profileName}" expires soon — logging in again`);
      await s.context.close();
      s = null;
    }
    if (!s) {
      const context = await browser.createBrowserContext();
      const { exp } = await login(context, cfg, profileName, creds[profileName]);
      s = sessions[profileName] = { context, exp };
    }
    return s.context;
  }

  try {
    for (const route of cfg.routes) {
      const url = cfg.baseUrl + route.path;
      for (const device of cfg.devices) {
        // Fail fast: one plain navigation to prove the protected route really loads.
        let preflightError = null;
        if (route.auth !== 'none') {
          const ctx = await getContext(route.auth);
          const page = await ctx.newPage();
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
            await new Promise((r) => setTimeout(r, 1500)); // allow client-side auth redirects
            const landed = new URL(page.url()).pathname;
            if (landed !== route.path) {
              preflightError = `redirected to ${landed} — session missing, expired, or wrong role for this route`;
            }
          } catch (e) {
            preflightError = `navigation failed: ${e.message.split('\n')[0]}`;
          } finally {
            await page.close();
          }
        }

        for (let run = 1; run <= cfg.runs; run++) {
          done++;
          const base = `${slug(route.surface)}__${device}__run${run}`;
          const row = {
            surface: route.surface,
            device,
            run,
            status: 'ok',
            error: '',
            url,
            finalUrl: '',
            auth: route.auth,
            ...extractMetrics({ audits: {}, categories: {} }),
            lighthouseVersion: lhVersion,
            chromeVersion,
            fetchTime: '',
            reportHtml: '',
            reportJson: '',
          };
          if (preflightError) {
            Object.assign(row, { status: 'FAILED', error: preflightError });
            rows.push(row);
            log(`[${done}/${total}] ${route.surface} ${device} run ${run}: FAILED (${preflightError})`);
            continue;
          }

          const ctx = await getContext(route.auth);
          const page = await ctx.newPage();
          try {
            // disableStorageReset keeps the session cookies, but it also keeps
            // the HTTP cache — clear it so every run is a cold load.
            const cdp = await page.createCDPSession();
            await cdp.send('Network.clearBrowserCache');
            await cdp.detach();

            const flags = { output: ['json'], logLevel: 'error', disableStorageReset: true, onlyCategories: ['performance'] };
            const config = device === 'desktop' ? desktopConfig : undefined;
            const result = await lighthouse(url, flags, config, page);
            if (!result?.lhr) throw new Error('Lighthouse returned no result');
            const lhr = result.lhr;
            if (lhr.runtimeError) throw new Error(`${lhr.runtimeError.code}: ${lhr.runtimeError.message}`);
            // Never persist secrets that might have been configured as headers.
            if (lhr.configSettings) lhr.configSettings.extraHeaders = null;

            fs.writeFileSync(path.join(outDir, 'reports', `${base}.report.json`), JSON.stringify(lhr, null, 2));
            fs.writeFileSync(path.join(outDir, 'reports', `${base}.report.html`), ReportGenerator.generateReport(lhr, 'html'));

            const finalUrl = lhr.finalDisplayedUrl || lhr.finalUrl || '';
            Object.assign(row, extractMetrics(lhr), {
              finalUrl,
              fetchTime: lhr.fetchTime,
              reportHtml: `reports/${base}.report.html`,
              reportJson: `reports/${base}.report.json`,
            });
            const landed = finalUrl ? new URL(finalUrl).pathname : '';
            // A protected page can stay on its URL but render an empty/error
            // state when its API calls are rejected — that would score
            // *better* than the real page, so treat it as a failure too.
            const rejected = route.auth === 'none'
              ? []
              : (lhr.audits['network-requests']?.details?.items || []).filter((i) => i.statusCode === 401 || i.statusCode === 403);
            if (landed !== route.path) {
              Object.assign(row, { status: 'FAILED', error: `landed on ${landed || '?'} instead of ${route.path}`, score: null });
            } else if (rejected.length) {
              const urls = [...new Set(rejected.map((i) => `${i.statusCode} ${new URL(i.url).pathname}`))].slice(0, 3).join(', ');
              Object.assign(row, { status: 'FAILED', error: `API rejected the session (${urls})`, score: null });
            }
          } catch (e) {
            Object.assign(row, { status: 'FAILED', error: e.message.split('\n')[0] });
          } finally {
            await page.close().catch(() => {});
            if (route.auth === 'none') await ctx.close().catch(() => {});
          }
          rows.push(row);
          const m = row.status === 'ok'
            ? `score ${row.score}, LCP ${Math.round(row.lcp)}ms, TBT ${Math.round(row.tbt)}ms, CLS ${row.cls?.toFixed(3)}`
            : `FAILED (${row.error})`;
          log(`[${done}/${total}] ${route.surface} ${device} run ${run}: ${m}`);
        }
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const meta = {
    generatedAt: new Date().toISOString(),
    startedAt: started.toISOString(),
    baseUrl: cfg.baseUrl,
    routesFile: path.relative(ROOT, cfg.file).replace(/\\/g, '/'),
    runsPerPage: cfg.runs,
    devices: cfg.devices,
    lighthouseVersion: lhVersion,
    chromeVersion,
    chromeFlags,
    nodeVersion: process.version,
    gitCommit: gitSha(),
    targets: cfg.targets,
  };
  writeOutputs(outDir, meta, rows);

  const failed = rows.filter((r) => r.status !== 'ok');
  log(`Dashboard: ${path.join(outDir, 'index.html')}`);
  if (failed.length) {
    const surfaces = [...new Set(failed.map((r) => `${r.surface} (${r.device})`))];
    die(`${failed.length} of ${rows.length} runs FAILED: ${surfaces.join(', ')}. Report written, but this is not a valid baseline for those surfaces.`, 2);
  }
  log(`All ${rows.length} runs passed.`);
}

// ------------------------------------------------------------------ outputs

const RUN_COLUMNS = ['surface', 'device', 'run', 'status', 'score', 'lcp', 'inp', 'cls', 'tbt', 'si', 'fcp', 'jsBytes', 'requests',
  'topFixes', 'url', 'finalUrl', 'auth', 'lighthouseVersion', 'chromeVersion', 'fetchTime', 'reportHtml', 'reportJson', 'error'];
const SUMMARY_COLUMNS = ['surface', 'device', 'status', 'runsOk', 'runsTotal', 'score', 'lcp', 'inp', 'cls', 'tbt', 'si', 'fcp', 'jsBytes', 'requests',
  'scoreMin', 'scoreMax', 'topFixes', 'url', 'lighthouseVersion', 'representativeReport', 'error'];
const METRICS = ['score', 'lcp', 'cls', 'tbt', 'si', 'fcp', 'jsBytes', 'requests'];

function summarise(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.surface}\u0000${r.device}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const out = [];
  for (const runs of groups.values()) {
    const ok = runs.filter((r) => r.status === 'ok');
    const s = {
      surface: runs[0].surface,
      device: runs[0].device,
      url: runs[0].url,
      lighthouseVersion: runs[0].lighthouseVersion,
      runsOk: ok.length,
      runsTotal: runs.length,
      status: ok.length === runs.length ? 'ok' : ok.length ? 'PARTIAL' : 'FAILED',
      error: [...new Set(runs.filter((r) => r.error).map((r) => r.error))].join('; '),
      inp: null,
      runs,
    };
    for (const m of METRICS) s[m] = median(ok.map((r) => r[m]));
    const scores = ok.map((r) => r.score).filter((x) => x !== null);
    s.scoreMin = scores.length ? Math.min(...scores) : null;
    s.scoreMax = scores.length ? Math.max(...scores) : null;
    const rep = ok.slice().sort((a, b) => Math.abs(a.score - s.score) - Math.abs(b.score - s.score))[0];
    s.representativeReport = rep?.reportHtml || '';
    s.topFixes = rep?.topFixes || '';
    out.push(s);
  }
  // Worst first: failures, then partials, then ascending median score.
  const rank = { FAILED: 0, PARTIAL: 1, ok: 2 };
  out.sort((a, b) => rank[a.status] - rank[b.status] || (a.score ?? -1) - (b.score ?? -1) || a.surface.localeCompare(b.surface));
  return out;
}

function roundRow(r) {
  const o = { ...r };
  for (const k of ['lcp', 'tbt', 'si', 'fcp', 'jsBytes', 'requests']) if (typeof o[k] === 'number') o[k] = Math.round(o[k]);
  if (typeof o.cls === 'number') o.cls = Number(o.cls.toFixed(4));
  if (o.inp === null || o.inp === undefined) o.inp = 'n/a (lab)';
  return o;
}

function writeOutputs(dir, meta, rows) {
  const summary = summarise(rows);
  fs.writeFileSync(path.join(dir, 'runs.json'), JSON.stringify(rows, null, 2));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  fs.writeFileSync(path.join(dir, 'runs.csv'), toCsv(rows.map(roundRow), RUN_COLUMNS));
  fs.writeFileSync(path.join(dir, 'summary.csv'), toCsv(summary.map(roundRow), SUMMARY_COLUMNS));
  fs.writeFileSync(path.join(dir, 'index.html'), renderDashboard(meta, summary, rows));
}

function grade(metric, value, targets) {
  const t = targets[metric];
  if (!t || value === null || value === undefined) return '';
  if (t.higherIsBetter) return value >= t.good ? 'good' : value >= t.poor ? 'warn' : 'bad';
  return value <= t.good ? 'good' : value <= t.poor ? 'warn' : 'bad';
}

function fmt(metric, v) {
  if (v === null || v === undefined) return '—';
  switch (metric) {
    case 'score': return String(Math.round(v));
    case 'cls': return v.toFixed(3);
    case 'lcp': case 'si': case 'fcp': return `${(v / 1000).toFixed(2)} s`;
    case 'tbt': return `${Math.round(v)} ms`;
    case 'jsBytes': return `${Math.round(v / 1024)} KB`;
    case 'requests': return String(Math.round(v));
    default: return String(v);
  }
}

function targetLabel(metric, t) {
  if (!t) return '';
  const op = t.higherIsBetter ? '≥' : '≤';
  return `${op} ${fmt(metric, t.good)}`;
}

function renderDashboard(meta, summary, rows) {
  const t = meta.targets;
  const cols = [
    ['score', 'Score'], ['lcp', 'LCP'], ['inp', 'INP'], ['cls', 'CLS'], ['tbt', 'TBT'],
    ['si', 'Speed Index'], ['fcp', 'FCP'], ['jsBytes', 'JS'], ['requests', 'Requests'],
  ];
  const passing = summary.filter((s) => s.status === 'ok' && grade('score', s.score, t) === 'good').length;
  const failedCount = summary.filter((s) => s.status !== 'ok').length;

  const cell = (metric, v) => {
    if (metric === 'inp') return '<td class="num muted" title="INP needs real interactions; Lighthouse navigation runs cannot measure it. TBT is the lab proxy.">n/a</td>';
    const g = grade(metric, v, t);
    return `<td class="num ${g}"${g ? ` data-grade="${g}"` : ''}>${escapeHtml(fmt(metric, v))}</td>`;
  };

  const body = summary.map((s) => {
    const runLinks = s.runs.map((r) => r.reportHtml
      ? `<a href="${escapeHtml(r.reportHtml)}" title="Run ${r.run}: score ${r.score ?? 'n/a'}">${r.run}</a> <a class="muted" href="${escapeHtml(r.reportJson)}">json</a>`
      : `<span class="bad-text" title="${escapeHtml(r.error)}">${r.run}✕</span>`).join(' · ');
    const status = s.status === 'ok'
      ? `<span class="pill ${grade('score', s.score, t)}">${s.scoreMin === s.scoreMax ? 'stable' : `${s.scoreMin}–${s.scoreMax}`}</span>`
      : `<span class="pill bad" title="${escapeHtml(s.error)}">${s.status}</span>`;
    const err = s.status !== 'ok' ? `<div class="err">${escapeHtml(s.error)}</div>` : '';
    return `<tr class="${s.status !== 'ok' ? 'failed' : ''}">
  <td><div class="surface">${escapeHtml(s.surface)}</div><div class="path"><a href="${escapeHtml(s.url)}">${escapeHtml(new URL(s.url).pathname)}</a></div>${err}</td>
  <td>${escapeHtml(s.device)}</td>
  <td>${status}</td>
  ${cols.map(([m]) => cell(m, s[m])).join('\n  ')}
  <td class="fixes">${s.topFixes ? `<ol>${s.topFixes.split('; ').map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ol>` : '<span class="muted">—</span>'}</td>
  <td class="runs">${runLinks}</td>
</tr>`;
  }).join('\n');

  const perRun = rows.slice().sort((a, b) => a.surface.localeCompare(b.surface) || a.device.localeCompare(b.device) || a.run - b.run).map((r) => `<tr>
  <td>${escapeHtml(r.surface)}</td><td>${escapeHtml(r.device)}</td><td class="num">${r.run}</td>
  <td>${r.status === 'ok' ? 'ok' : `<span class="bad-text" title="${escapeHtml(r.error)}">FAILED</span>`}</td>
  ${cols.map(([m]) => cell(m, r[m])).join('')}
  <td>${r.reportHtml ? `<a href="${escapeHtml(r.reportHtml)}">html</a> · <a href="${escapeHtml(r.reportJson)}">json</a>` : '—'}</td>
</tr>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lighthouse Baseline</title>
<style>
:root {
  --bg: #f7f7f5; --surface: #ffffff; --text: #1b1d1f; --muted: #6b7076; --border: #e3e4e1;
  --good-bg: #e3f4ea; --good-fg: #106b3a; --warn-bg: #fdf1d8; --warn-fg: #8a5a00; --bad-bg: #fbe4e2; --bad-fg: #a8231a;
  --accent: #1d5fd1; --row-fail: #fff6f5;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #131517; --surface: #1b1e21; --text: #e8eaec; --muted: #9aa1a8; --border: #2c3035;
    --good-bg: #133524; --good-fg: #7fdba5; --warn-bg: #3a2d10; --warn-fg: #f3c56b; --bad-bg: #42191a; --bad-fg: #ff9d94;
    --accent: #7aa9ff; --row-fail: #241718;
  }
}
:root[data-theme="dark"] {
  --bg: #131517; --surface: #1b1e21; --text: #e8eaec; --muted: #9aa1a8; --border: #2c3035;
  --good-bg: #133524; --good-fg: #7fdba5; --warn-bg: #3a2d10; --warn-fg: #f3c56b; --bad-bg: #42191a; --bad-fg: #ff9d94;
  --accent: #7aa9ff; --row-fail: #241718;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1400px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 16px; margin: 32px 0 8px; }
a { color: var(--accent); }
.muted { color: var(--muted); }
.meta { color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 4px 18px; margin-bottom: 16px; }
.kpis { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; min-width: 150px; }
.kpi b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; white-space: nowrap; }
th { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); background: var(--surface); position: sticky; top: 0; }
th small { display: block; text-transform: none; letter-spacing: 0; font-weight: 400; }
td.num, th.num { text-align: right; }
td.good { background: var(--good-bg); color: var(--good-fg); }
td.warn { background: var(--warn-bg); color: var(--warn-fg); }
td.bad { background: var(--bad-bg); color: var(--bad-fg); font-weight: 600; }
tr.failed > td:first-child { box-shadow: inset 3px 0 0 var(--bad-fg); }
tr.failed { background: var(--row-fail); }
.surface { font-weight: 600; }
.path { font-size: 12px; }
.err { font-size: 12px; color: var(--bad-fg); white-space: normal; max-width: 320px; }
.bad-text { color: var(--bad-fg); font-weight: 600; }
.pill { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 12px; border: 1px solid var(--border); }
.pill.good { background: var(--good-bg); color: var(--good-fg); }
.pill.warn { background: var(--warn-bg); color: var(--warn-fg); }
.pill.bad { background: var(--bad-bg); color: var(--bad-fg); }
.runs { font-size: 12px; }
td.fixes { white-space: normal; min-width: 280px; max-width: 380px; font-size: 12px; }
td.fixes ol { margin: 0; padding-left: 16px; }
.legend { font-size: 12px; color: var(--muted); margin-top: 8px; }
.legend span { display: inline-block; padding: 0 6px; border-radius: 4px; margin-right: 6px; }
details summary { cursor: pointer; margin: 32px 0 8px; font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>Lighthouse baseline</h1>
<div class="meta">
  <span>${escapeHtml(meta.baseUrl)}</span>
  <span>Generated ${escapeHtml(meta.generatedAt.replace('T', ' ').slice(0, 16))} UTC</span>
  <span>Lighthouse ${escapeHtml(meta.lighthouseVersion)}</span>
  <span>${escapeHtml(meta.chromeVersion)}</span>
  <span>Median of ${meta.runsPerPage} runs</span>
  <span>Commit ${escapeHtml(meta.gitCommit)}</span>
  <span>Routes: ${escapeHtml(meta.routesFile)}</span>
</div>
<div class="kpis">
  <div class="kpi"><b>${summary.length}</b>surface × device</div>
  <div class="kpi"><b>${passing}</b>meet score target (${escapeHtml(targetLabel('score', t.score))})</div>
  <div class="kpi"><b>${failedCount}</b>failed / not measured</div>
  <div class="kpi"><b>${rows.length}</b>Lighthouse runs</div>
</div>
<div class="wrap">
<table>
<thead><tr>
  <th>Surface</th><th>Device</th><th>Spread</th>
  ${cols.map(([m, label]) => `<th class="num">${label}<small>${m === 'inp' ? 'field only' : escapeHtml(targetLabel(m, t[m]))}</small></th>`).join('')}
  <th>Top fixes<small>biggest estimated savings, median run</small></th>
  <th>Reports (run · json)</th>
</tr></thead>
<tbody>
${body}
</tbody>
</table>
</div>
<p class="legend">Sorted worst first: failed runs, then lowest median score. Values are medians of successful runs; colours compare against target —
<span class="good" style="background:var(--good-bg);color:var(--good-fg)">meets target</span>
<span style="background:var(--warn-bg);color:var(--warn-fg)">needs improvement</span>
<span style="background:var(--bad-bg);color:var(--bad-fg)">poor</span>.
"Spread" is the min–max score across runs. INP cannot be measured in a lab navigation; use TBT as its proxy.
Mobile uses Lighthouse's default throttled Moto G profile; desktop uses <code>--preset=desktop</code>.</p>
<details>
<summary>Every individual run (${rows.length})</summary>
<div class="wrap">
<table>
<thead><tr><th>Surface</th><th>Device</th><th class="num">Run</th><th>Status</th>${cols.map(([, label]) => `<th class="num">${label}</th>`).join('')}<th>Report</th></tr></thead>
<tbody>
${perRun}
</tbody>
</table>
</div>
</details>
</main>
</body>
</html>
`;
}

main().catch((e) => die(e.stack || e.message));
