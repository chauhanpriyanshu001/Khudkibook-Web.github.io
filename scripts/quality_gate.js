#!/usr/bin/env node
/**
 * CI quality gate for the committed public/ tree.
 *
 * Fails (exit 1) when the site would present low-value pages to a crawler or an
 * AdSense reviewer:
 *
 *   - an indexable subject page with no textbook and no reviewed editorial copy
 *   - two indexable pages sharing one GTU course code
 *   - an indexable empty generated landing/semester page
 *   - a sitemap URL whose served page is missing, noindex, or low value
 *
 * Run after the cleanup passes (npm run adsense-fix) and before deploying:
 *   node scripts/quality_gate.js
 */

const fs = require('fs');
const path = require('path');
const {
    isSubjectPage,
    isLowValueSubjectPage,
    visibleWordCount,
    DEFAULT_SITE_URL
} = require('./lib/seo');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');
const DB_PATH = path.join(ROOT_DIR, 'data', 'site_db.json');

let SITE_URL = DEFAULT_SITE_URL;
try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    if (db && db.config && db.config.siteUrl) SITE_URL = db.config.siteUrl.replace(/\/+$/, '');
} catch (e) { /* default */ }

const SKIP_DIRS = new Set(['templates', 'data', 'assets', 'icons']);

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

const ROBOTS_RE = /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i;
const CANONICAL_RE = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i;

const violations = [];
const codeGroups = new Map();

for (const file of walk(PUBLIC_DIR)) {
    const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    const robots = attr(html, ROBOTS_RE) || '';
    if (/noindex/i.test(robots)) continue;

    const isSubject = isSubjectPage(html);
    const code = attr(html, /"courseCode"\s*:\s*"([^"]*)"/);

    if (isSubject) {
        if (isLowValueSubjectPage(html)) {
            violations.push(`low-value subject page (no book/editorial): ${rel}`);
        }
        if (code) {
            if (!codeGroups.has(code)) codeGroups.set(code, []);
            codeGroups.get(code).push(rel);
        }
        continue;
    }

    // Empty generated landing/semester pages must not be indexable.
    const isLanding = /homepage\.html$/i.test(rel);
    const isSemIndex = /\/sem\d+\/index\.html$/i.test(rel);
    if ((isLanding || isSemIndex) && visibleWordCount(html) < 120) {
        violations.push(`empty landing page still indexable: ${rel}`);
    }
}

for (const [code, pages] of codeGroups) {
    if (pages.length > 1) {
        violations.push(`duplicate indexable course code ${code}: ${pages.join(', ')}`);
    }
}

// Every sitemap URL must point at a served page that passes the same gate.
if (fs.existsSync(SITEMAP_PATH)) {
    const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    for (const loc of locs) {
        const rel = loc.startsWith(SITE_URL) ? loc.slice(SITE_URL.length) : null;
        if (rel === null) {
            violations.push(`sitemap URL on unexpected host: ${loc}`);
            continue;
        }
        const clean = rel.replace(/^\/+/, '');
        const direct = path.join(PUBLIC_DIR, `${clean}.html`);
        const index = path.join(PUBLIC_DIR, clean, 'index.html');
        const served = fs.existsSync(direct) ? direct : (fs.existsSync(index) ? index : null);
        if (!served) {
            violations.push(`sitemap URL has no served page: ${loc}`);
            continue;
        }
        const html = fs.readFileSync(served, 'utf8');
        const robots = attr(html, ROBOTS_RE) || '';
        if (/noindex/i.test(robots)) {
            violations.push(`sitemap URL points at a noindex page: ${loc}`);
        } else if (isLowValueSubjectPage(html)) {
            violations.push(`sitemap URL points at a low-value subject page: ${loc}`);
        }
    }
}

if (violations.length) {
    console.error(`Quality gate FAILED — ${violations.length} violation(s):`);
    for (const v of violations.slice(0, 60)) console.error(`  - ${v}`);
    if (violations.length > 60) console.error(`  ... and ${violations.length - 60} more`);
    process.exit(1);
}

console.log('Quality gate passed: no low-value indexable pages, duplicate codes, or bad sitemap URLs.');
