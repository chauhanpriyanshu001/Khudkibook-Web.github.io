#!/usr/bin/env node
/**
 * One-off migration: bring the already-committed pages in public/ in line with
 * the indexing rules in scripts/lib/seo.js.
 *
 * The site is deployed from committed HTML, not built on CI, so fixing the
 * generators alone would not change a single live URL until someone next ran
 * `node scripts/generate.js` -- and that only covers the pages it owns, not the
 * hand-written top-level pages or the blog. This rewrites every committed page
 * in place:
 *
 *   1. canonical / og:url / twitter:url  -> the clean, non-redirecting URL
 *   2. robots meta                      -> noindex, follow on empty stubs
 *   3. same-site links                  -> clean form, dropping a 301 per link
 *
 * Safe to re-run: every rewrite is idempotent, and a file whose content does not
 * change is not rewritten (mtime preserved, so git sees no phantom churn).
 *
 * Usage: node scripts/fix_indexing.js [--dry] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { cleanUrl, cleanInternalLinks, isThinPlaceholder, DEFAULT_SITE_URL } = require('./lib/seo');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

// Same directories gen_sitemap.js ignores: templates are the source of every
// page, not pages themselves, and the rest hold no HTML.
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

const ROBOTS_DEFAULT = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const ROBOTS_THIN = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

const reCanonical = /(<link\s+rel=["']canonical["']\s+href=["'])([^"']+)(["'])/i;
const reOgUrl = /(<meta\s+property=["']og:url["']\s+content=["'])([^"']+)(["'])/i;
const reTwitterUrl = /(<meta\s+name=["']twitter:url["']\s+content=["'])([^"']+)(["'])/i;
const reRobots = /(<meta\s+name=["']robots["']\s+content=["'])([^"']+)(["'])/i;

const stats = {
    files: 0, changed: 0, canonicalFixed: 0, urlsFixed: 0,
    linksFixed: 0, noindexed: 0, skippedNoindex: 0
};

for (const file of walk(PUBLIC_DIR)) {
    stats.files++;
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    let touched = false;

    // 1. Canonical and the social mirrors of it must name the same URL, so all
    //    three go through cleanUrl together.
    const cm = reCanonical.exec(after);
    if (cm) {
        const clean = cleanUrl(cm[2], DEFAULT_SITE_URL);
        if (clean !== cm[2]) {
            after = after.replace(reCanonical, `$1${clean}$3`);
            after = after.replace(reOgUrl, (m, a, u, c) => (u === cm[2] ? `${a}${clean}${c}` : m));
            after = after.replace(reTwitterUrl, (m, a, u, c) => (u === cm[2] ? `${a}${clean}${c}` : m));
            stats.canonicalFixed++;
            touched = true;
        }
    } else {
        // A page with no canonical at all lets the .html and slashless forms be
        // indexed as separate URLs. Derive one from the file's own path.
        const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
        const derived = cleanUrl(`/${rel}`, DEFAULT_SITE_URL);
        const link = `    <link rel="canonical" href="${derived}" />\n`;
        const headClose = after.match(/<meta name="generator"[^>]*\/>/i);
        if (headClose) {
            after = after.replace(headClose[0], `${headClose[0]}\n${link.trim()}`);
            stats.canonicalFixed++;
            touched = true;
            if (VERBOSE) console.log(`  + canonical ${derived}`);
        }
    }

    // 2. Empty stubs opt out of the index but stay crawlable, so the PDFs they
    //    link remain discoverable.
    //
    //    Only a *self-canonical* stub qualifies. A code-named twin is by
    //    definition a duplicate of some other page, and it may be a stale copy:
    //    the subject-code file can still hold real material that the slug-named
    //    canonical it points at has since lost. Noindexing that twin would
    //    withdraw the canonical from the index over content the canonical does
    //    not actually serve.
    const isSelfCanonical = cm
        ? cleanUrl(cm[2], DEFAULT_SITE_URL) === cleanUrl(`/${path.relative(PUBLIC_DIR, file).split(path.sep).join('/')}`, DEFAULT_SITE_URL)
        : true;
    const rm = reRobots.exec(after);
    const current = rm ? rm[2] : null;
    if (current && /noindex/i.test(current)) {
        stats.skippedNoindex++;
    } else if (isSelfCanonical && isThinPlaceholder(after)) {
        after = after.replace(reRobots, `$1${ROBOTS_THIN}$3`);
        stats.noindexed++;
        touched = true;
    } else if (current && current !== ROBOTS_DEFAULT) {
        after = after.replace(reRobots, `$1${ROBOTS_DEFAULT}$3`);
        touched = true;
    }

    // 3. Same-site links. Anchors, assets and external hosts are untouched.
    const linked = cleanInternalLinks(after, DEFAULT_SITE_URL);
    if (linked !== after) {
        const count = (after.match(/href="\/[^"#?]*\.html(?:#[^"]*)?"/gi) || []).length;
        stats.linksFixed += count;
        after = linked;
        touched = true;
    }

    if (after !== before) {
        stats.changed++;
        if (!DRY) fs.writeFileSync(file, after);
    }
}

console.log(`${DRY ? '[dry] ' : ''}scanned ${stats.files} pages`);
console.log(`  rewrote        ${stats.changed}`);
console.log(`  canonical/url  ${stats.canonicalFixed}`);
console.log(`  noindex added  ${stats.noindexed}`);
console.log(`  links cleaned  ${stats.linksFixed}`);
console.log(`  already noindex ${stats.skippedNoindex}`);
