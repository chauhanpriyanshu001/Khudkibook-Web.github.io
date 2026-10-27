#!/usr/bin/env node
/**
 * Point every published GTU question-paper link at the host that actually
 * serves the archive.
 *
 * The archive lives at https://<host>/uploads/<session>/<extype>/<code>.pdf,
 * and <host> is NOT stable: https://gtu.ac.in/Download1.aspx 302-redirects to
 * whichever host currently serves it (old26.gtu.ac.in today), and the result
 * rows link to their PDFs relatively. Hardcoding either host in the generated
 * pages means the links rot the moment GTU moves its servers -- and every
 * paper on the site answers 404 while the UI still advertises "Paper".
 *
 * So this script discovers the live host instead of assuming it:
 *   1. GET https://gtu.ac.in/Download1.aspx and follow the redirect.
 *   2. Probe the host with a known paper path to confirm it serves PDFs.
 *   3. Rewrite every published link from the old host to the new one.
 *
 * Usage:
 *   node scripts/fix_gtu_paper_links.js            # detect host, rewrite
 *   node scripts/fix_gtu_paper_links.js --dry-run  # report only
 *   node scripts/fix_gtu_paper_links.js --host https://old26.gtu.ac.in
 *
 * Idempotent: running it twice changes nothing the second time.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DB_FILE = path.join(ROOT_DIR, 'data', 'site_db.json');

const DRY = process.argv.includes('--dry-run');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Every host the archive has been published under. The script rewrites links
// that point at any of them, so a move is a single run no matter which host
// the previous build baked in.
const KNOWN_HOSTS = [
    'https://gtu.ac.in',
    'https://old26.gtu.ac.in'
];

const DOWNLOAD_PAGE = 'https://gtu.ac.in/Download1.aspx';
// A paper that has been on the archive for years, used to prove the host
// really serves PDFs and not just the HTML form.
const PROBE_PATH = '/uploads/S2024/BE/3160617.pdf';

// Files that must not be rewritten: they are source, not output.
const SKIP_DIRS = new Set(['templates', 'assets', 'icons']);

function parseHostArg() {
    const i = process.argv.indexOf('--host');
    if (i === -1) return null;
    const raw = String(process.argv[++i] || '').trim();
    if (!raw) return null;
    return raw.replace(/\/+$/, '');
}

async function detectHost() {
    const forced = parseHostArg();
    if (forced) {
        const ok = await probe(forced);
        return ok ? forced : null;
    }

    // Follow the redirect chain the way a browser would: the host that ends up
    // serving the download page is the one serving its files.
    const res = await fetch(DOWNLOAD_PAGE, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
        redirect: 'follow'
    });
    if (!res.ok) throw new Error(`GET ${DOWNLOAD_PAGE} -> ${res.status}`);
    await res.text();

    const final = new URL(res.url || DOWNLOAD_PAGE);
    const candidate = final.origin;
    if (await probe(candidate)) return candidate;

    // The page redirected somewhere that does not serve the archive; fall back
    // to scanning the known hosts.
    for (const host of KNOWN_HOSTS) {
        if (await probe(host)) return host;
    }
    return null;
}

async function probe(host) {
    const url = `${host}${PROBE_PATH}`;
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            headers: { 'User-Agent': UA },
            redirect: 'follow'
        });
        return res.status === 200;
    } catch (e) {
        return false;
    }
}

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs, out);
        else out.push(abs);
    }
    return out;
}

/** Replace every known archive host with the live one. Returns [newText, count]. */
function rewrite(text, fromHosts, toHost) {
    let count = 0;
    let out = text;
    for (const host of fromHosts) {
        if (host === toHost) continue;
        const needle = `${host}/uploads/`;
        const parts = out.split(needle);
        if (parts.length > 1) {
            count += parts.length - 1;
            out = parts.join(`${toHost}/uploads/`);
        }
    }
    return [out, count];
}

function countOccurrences(text, hosts) {
    let n = 0;
    for (const host of hosts) {
        const needle = `${host}/uploads/`;
        const parts = text.split(needle);
        n += parts.length - 1;
    }
    return n;
}

async function main() {
    console.log('GTU paper link repair');
    console.log('='.repeat(60));

    const toHost = await detectHost();
    if (!toHost) {
        console.error('Could not find a host that serves the GTU paper archive.');
        console.error('Tried: ' + KNOWN_HOSTS.join(', '));
        console.error('Pass --host <origin> if you know where the archive lives now.');
        process.exit(1);
    }
    console.log(`Live archive host: ${toHost}`);

    const fromHosts = KNOWN_HOSTS.filter(h => h !== toHost);
    const stats = { html: 0, json: 0, db: 0, occurrences: 0, files: 0 };

    // 1. The generated pages.
    const files = walk(PUBLIC_DIR).filter(f => /\.(html|json)$/i.test(f));
    for (const file of files) {
        const before = fs.readFileSync(file, 'utf8');
        const hits = countOccurrences(before, fromHosts);
        if (!hits) continue;
        const [after] = rewrite(before, fromHosts, toHost);
        if (after === before) continue;
        stats.files++;
        stats.occurrences += hits;
        if (/\.html$/i.test(file)) stats.html++;
        else stats.json++;
        if (!DRY) fs.writeFileSync(file, after);
    }

    // 2. The source database, so the next `generate.js` run keeps the host.
    if (fs.existsSync(DB_FILE)) {
        const before = fs.readFileSync(DB_FILE, 'utf8');
        const hits = countOccurrences(before, fromHosts);
        if (hits) {
            const [after] = rewrite(before, fromHosts, toHost);
            stats.db = hits;
            stats.occurrences += hits;
            stats.files++;
            if (!DRY) fs.writeFileSync(DB_FILE, after);
        }
    }

    console.log(`\n${DRY ? '[dry-run] ' : ''}rewrote ${stats.occurrences} link(s) across ${stats.files} file(s)`);
    console.log(`  html pages      ${stats.html}`);
    console.log(`  json files      ${stats.json}`);
    console.log(`  site_db.json    ${stats.db}`);
    if (!stats.occurrences) console.log('  (nothing to do -- already pointing at the live host)');
}

main().catch(e => {
    console.error('FAILED:', e && e.message ? e.message : e);
    process.exit(1);
});
