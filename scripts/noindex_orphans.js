/**
 * Marks stale build artifacts `noindex, follow` and strips the ad units they
 * still carry.
 *
 * `public/` is committed, and older generators wrote into paths the current one
 * no longer produces. Those leftovers are still deployed, still marked
 * `index, follow`, and so each one is an independently indexable page competing
 * with the live page that replaced it. That is replicated content, and it is how
 * `public/diploma/` came to hold 173 files (plus ~100 more elsewhere, including
 * some named literally `.html`) shadowing the live `civil/`, `computer/` and
 * `diploma/<branch>/` trees.
 *
 * Two cleanups, deliberately scoped to different things.
 *
 * 1. Ad units. 110 pages shipped a hardcoded
 *    `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` loader plus three
 *    `ins.adsbygoogle` slots that pushed unconditionally at parse time -- outside
 *    `pageHasPublishableContent()` in ad-injector.js, which is what keeps ads off
 *    "Coming Soon" stubs. 58 of those 110 were exactly those stubs: ads on
 *    screens with no publisher content, the clearest route to an AdSense
 *    low-value / policy finding. Every hardcoded unit is removed from every page
 *    and placement is left to the injector, which applies the guard.
 *
 * 2. Stale artifacts, judged on one signal: no canonical. Every page the current
 *    generator emits substitutes `{{CANONICAL_URL}}` from base.html, so a missing
 *    canonical means an older generator wrote it and nothing has replaced it.
 *    A path allowlist would go stale the next time a generator moved.
 *
 * The two are kept apart on purpose. Ad markup says nothing about staleness --
 * about.html, contact.html, ddcet.html, papers.html and syllabus.html are
 * hand-written, load the AdSense library legitimately, and are among the most
 * linked pages on the site. Inferring "stale" from ads would noindex them.
 *
 * `noindex, follow` rather than deletion on purpose: the site carries well over
 * a million internal links, so removing a file that anything still links to
 * would trade a duplicate result for a 404. Following is kept so the sitemap and
 * link equity still reach whatever the page does link.
 *
 * Idempotent -- a second run rewrites nothing.
 *
 * Usage: node scripts/noindex_orphans.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DRY_RUN = process.argv.includes('--dry-run');

const ROBOTS_NOINDEX = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const SKIP_DIRS = new Set(['templates']);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(abs, out);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
            out.push(abs);
        }
    }
    return out;
}

function hasCanonical(html) {
    return /<link\s+rel=["']canonical["']/i.test(html);
}

/** The AdSense library, loaded directly. base.html never emits this. */
const ADSENSE_LOADER = /<script[^>]*googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^>]*>\s*<\/script>\s*/gi;

function hasHardcodedAdsense(html) {
    ADSENSE_LOADER.lastIndex = 0;
    return ADSENSE_LOADER.test(html);
}

/**
 * Removes one `<div class="ad-slot-wrapper">…</div>` block by counting `<div>`
 * depth, rather than by matching to the first `</div></div>`.
 *
 * The blocks are not nested inside anything, but the wrapper contains an
 * `.ad-container` div plus the `<ins>` and the inline push script, so a naive
 * non-greedy match either stops inside the block or eats the following section.
 */
function removeAdWrapper(html) {
    const open = html.indexOf('<div class="ad-slot-wrapper');
    if (open === -1) return html;

    let depth = 0;
    let i = open;
    for (; i < html.length; i++) {
        if (html.startsWith('<div', i)) { depth++; i += 3; continue; }
        if (html.startsWith('</div>', i)) {
            depth--;
            if (depth === 0) { i += 6; break; }
        }
    }
    if (depth !== 0) return html;

    // Swallow the ad-slot comment that introduces the block, if present.
    let start = open;
    const before = html.slice(0, open);
    const comment = before.match(/<!--[^<>]*[Aa]d[^<>]*-->\s*$/);
    if (comment) start = open - comment[0].length;

    return html.slice(0, start) + html.slice(i);
}

function stripHardcodedAds(html) {
    let next = html.replace(ADSENSE_LOADER, '');
    let previous;
    do {
        previous = next;
        next = removeAdWrapper(previous);
    } while (next !== previous);
    return next;
}

function isAlreadyNoindex(html) {
    const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
    return !!m && /noindex/i.test(m[1]);
}

const files = walk(PUBLIC_DIR);
const marked = [];
const skipped = [];
const stripped = [];

for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    const rel = path.relative(PUBLIC_DIR, file);

    // Drop any ad unit this page hardcodes, on ANY page. ad-injector.js owns
    // placement now, and its pageHasPublishableContent() guard is the only thing
    // keeping ads off "Coming Soon" stubs -- a hardcoded <ins> bypasses it.
    const withoutAds = stripHardcodedAds(html);
    const hadAds = withoutAds !== html;
    if (hadAds) {
        html = withoutAds;
        stripped.push(rel);
    }

    // Staleness is judged on the canonical alone. It must not be inferred from
    // the ad markup: about.html, contact.html, ddcet.html, papers.html and
    // syllabus.html are hand-written, carry the AdSense library legitimately and
    // are among the most linked pages on the site.
    if (hasCanonical(html)) {
        // Live page, but its ad units still have to go.
        if (!DRY_RUN && hadAds) fs.writeFileSync(file, html);
        continue;
    }

    if (isAlreadyNoindex(html)) {
        skipped.push(rel);
        if (!DRY_RUN && hadAds) fs.writeFileSync(file, html);
        continue;
    }

    // Replace the existing robots tag when there is one, otherwise drop the
    // directive in right after <head> so it is never missed by a crawler that
    // stops early.
    const next = /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i.test(html)
        ? html.replace(/<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
            `<meta name="robots" content="${ROBOTS_NOINDEX}" />`)
        : html.replace(/<head[^>]*>/i, (m) => `${m}\n    <meta name="robots" content="${ROBOTS_NOINDEX}" />`);

    if (!DRY_RUN) fs.writeFileSync(file, next);
    marked.push(rel);
}

console.log(`Scanned ${files.length} HTML files under public/.`);
if (DRY_RUN) {
    console.log(`[dry-run] Would noindex ${marked.length} stale artifacts, ${skipped.length} already marked.`);
} else {
    console.log(`noindexed ${marked.length} stale artifacts, ${skipped.length} already marked.`);
}
console.log(`${DRY_RUN ? '[dry-run] Would strip' : 'stripped'} hardcoded ad units from ${stripped.length} stale page(s).`);
if (marked.length) {
    const byDir = new Map();
    for (const rel of marked) {
        const dir = path.dirname(rel).split(path.sep).slice(0, 2).join('/');
        byDir.set(dir, (byDir.get(dir) || 0) + 1);
    }
    [...byDir.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .forEach(([dir, n]) => console.log(`  ${String(n).padStart(4)}  ${dir}`));
    if (byDir.size > 8) console.log(`  ... and ${byDir.size - 8} more directories`);
}