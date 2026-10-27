#!/usr/bin/env node
/**
 * Collapse duplicate subject pages by GTU course code.
 *
 * The site renders one page per (branch, semester, subject). A common GTU
 * subject is listed in dozens of branches, so the same syllabus ends up on the
 * same course code in many folders -- `3700001` alone appeared 120 times. Search
 * engines and the AdSense reviewer see those as scaled, near-duplicate pages.
 *
 * This pass groups the *indexable* subject pages by `courseCode`, picks one
 * primary URL per code, then marks every other copy `noindex, follow` and points
 * its canonical at the primary. Pages that are already noindex (the GTU-code
 * twin of a slug page) are left alone. The primary stays indexable only if the
 * separate quality gate (scripts/fix_indexing.js) decides it is not low value.
 *
 * The map is written to data/subject_canonicals.json so a reviewer (or the next
 * generator pass) can see why a page canonicalises where it does.
 *
 * Idempotent. Usage:
 *   node scripts/dedupe_subjects.js [--dry] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const {
    cleanUrl,
    isSubjectPage,
    hasRealBook,
    hasOriginalEditorial,
    DEFAULT_SITE_URL
} = require('./lib/seo');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MAP_PATH = path.join(ROOT_DIR, 'data', 'subject_canonicals.json');

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

const SKIP_DIRS = new Set(['templates', 'data', 'assets', 'icons']);
const ROBOTS_NOINDEX = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs, out);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(abs);
    }
    return out;
}

function attr(html, re) {
    const m = re.exec(html);
    return m ? m[1] : null;
}

const CANONICAL_RE = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i;
const ROBOTS_RE = /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i;
const ROBOTS_TAG_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i;
const OG_URL_RE = /(<meta\s+property=["']og:url["']\s+content=["'])([^"']+)(["'])/i;
const TW_URL_RE = /(<meta\s+name=["']twitter:url["']\s+content=["'])([^"']+)(["'])/i;

function selfCanonical(relPosix) {
    let p = relPosix;
    if (/\/index\.html$/i.test(p)) p = p.slice(0, -'index.html'.length);
    else if (/\.html$/i.test(p)) p = p.slice(0, -'.html'.length);
    return cleanUrl('/' + p, DEFAULT_SITE_URL);
}

function isSlugFile(relPosix) {
    const base = path.posix.basename(relPosix, '.html');
    // Numeric / legacy-code twins are not good primaries.
    return !/^[0-9]/.test(base) && !/^C[0-9]/.test(base) && !/^DI[0-9]/.test(base);
}

function score(page) {
    let s = 0;
    if (page.editorial) s += 10000;
    if (page.realBook) s += 1000;
    if (isSlugFile(page.rel)) s += 100;
    // Prefer the shallowest URL (diploma tree) over BE/ME copies on a tie.
    s -= (page.rel.split('/').length - 1) * 10;
    return s;
}

const pages = [];
for (const file of walk(PUBLIC_DIR)) {
    const html = fs.readFileSync(file, 'utf8');
    if (!isSubjectPage(html)) continue;
    const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
    const robots = attr(html, ROBOTS_RE) || '';
    const code = attr(html, /"courseCode"\s*:\s*"([^"]*)"/);
    pages.push({
        file,
        html,
        rel,
        code: code || null,
        noindex: /noindex/i.test(robots),
        canonical: attr(html, CANONICAL_RE),
        realBook: hasRealBook(html),
        editorial: hasOriginalEditorial(html)
    });
}

const groups = new Map();
for (const page of pages) {
    if (page.noindex || !page.code) continue;
    if (!groups.has(page.code)) groups.set(page.code, []);
    groups.get(page.code).push(page);
}

const map = {};
const stats = { codes: 0, duplicates: 0, already: 0, changed: 0 };

for (const [code, list] of groups) {
    if (list.length < 2) continue;
    stats.codes++;
    list.sort((a, b) => score(b) - score(a) || a.rel.localeCompare(b.rel));
    const primary = list[0];
    const primaryUrl = primary.canonical
        ? cleanUrl(primary.canonical, DEFAULT_SITE_URL)
        : selfCanonical(primary.rel);
    map[code] = {
        primary: primaryUrl,
        primaryPage: primary.rel,
        duplicates: list.slice(1).map(p => p.rel)
    };

    for (const dup of list.slice(1)) {
        stats.duplicates++;
        if (dup.noindex && dup.canonical && cleanUrl(dup.canonical, DEFAULT_SITE_URL) === primaryUrl) {
            stats.already++;
            continue;
        }
        let html = dup.html;
        if (ROBOTS_TAG_RE.test(html)) {
            html = html.replace(ROBOTS_TAG_RE, `<meta name="robots" content="${ROBOTS_NOINDEX}" />`);
        } else {
            html = html.replace(/<head[^>]*>/i, (m) => `${m}\n    <meta name="robots" content="${ROBOTS_NOINDEX}" />`);
        }
        if (CANONICAL_RE.test(html)) {
            const old = attr(html, CANONICAL_RE);
            html = html.replace(CANONICAL_RE, (m, url) => m.replace(url, primaryUrl));
            html = html.replace(OG_URL_RE, (m, a, url, c) => (url === old ? `${a}${primaryUrl}${c}` : m));
            html = html.replace(TW_URL_RE, (m, a, url, c) => (url === old ? `${a}${primaryUrl}${c}` : m));
        }
        const changed = html !== dup.html;
        if (changed) {
            stats.changed++;
            if (!DRY) fs.writeFileSync(dup.file, html);
        }
        if (VERBOSE) console.log(`  ${dup.rel} -> ${primaryUrl}`);
    }
}

const mapOut = {
    generatedAt: new Date().toISOString(),
    note: 'One canonical URL per GTU course code. Non-primary subject pages are noindex+canonical to this URL.',
    codes: map
};
if (!DRY) {
    fs.mkdirSync(path.dirname(MAP_PATH), { recursive: true });
    fs.writeFileSync(MAP_PATH, JSON.stringify(mapOut, null, 2));
}

console.log(`${DRY ? '[dry] ' : ''}dedupe subject pages by course code`);
console.log(`  duplicate codes found : ${stats.codes}`);
console.log(`  duplicate pages       : ${stats.duplicates}`);
console.log(`  already canonicalised : ${stats.already}`);
console.log(`  rewritten             : ${stats.changed}`);
if (!DRY) console.log(`  map                   : ${path.relative(ROOT_DIR, MAP_PATH)}`);
