/**
 * Consolidates the duplicate pages that share a canonical URL.
 *
 * AdSense returned a "low value content" finding, and the reason is volume:
 * 26,098 files were `index, follow` but they only described 12,458 URLs, so
 * roughly half the crawlable site was a second or third copy of a page that
 * already existed. On top of that 14,958 files were byte-identical to another
 * file on disk. A site that is half duplicates reads as a thin doorway to a
 * handful of real pages, which is exactly the shape of the finding.
 *
 * The copies exist because GTU lists the same subject under several code
 * schemes -- the current `4xxxxx` code, the older `3xxxxx` code, the continuing
 * edition `C4xxxxx`, and the `DI0xxxxxx` paper code -- and each of those records
 * generates its own file for one subject. `generate.js` also writes a semester
 * index to both `index.html` and `homepage.html` with one canonical between them.
 *
 * For every canonical claimed by more than one indexable file this keeps exactly
 * one indexable page and flips the rest to `noindex, follow`:
 *
 *   - the winner is the file that actually backs the canonical, so the surviving
 *     page is the one the canonical already points at and no signal is moved;
 *   - a page carrying real study material always beats a "Coming Soon" stub,
 *     even when the stub is the canonical target (see PROMOTE below);
 *   - losers keep `follow`, so the crawler still walks their links, they just
 *     stop competing for a query the winner already answers.
 *
 * PROMOTE: a handful of canonicals point at a file that is itself noindex or is
 * an empty stub, which leaves live pages canonicalising at a page that cannot be
 * indexed. For those the best-material page in the group is promoted -- it
 * becomes self-canonical and the losers are pointed at it -- rather than
 * noindexing the group and losing the subject from the index entirely.
 *
 * Idempotent: re-running it is a no-op once every canonical has one owner.
 *
 * Usage:
 *   node scripts/dedupe_canonicals.js --dry-run
 *   node scripts/dedupe_canonicals.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const { cleanUrl, isThinPlaceholder } = require('./lib/seo');

const ROOT = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DRY_RUN = process.argv.includes('--dry-run');

// Mirrors ROBOTS_DEFAULT/ROBOTS_THIN in generate.js: `follow` is deliberate, the
// loser pages still hold internal links worth crawling.
const INDEXABLE = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX = 'noindex, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

const SKIP_DIRS = new Set(['templates', 'data', 'assets', 'icons', 'books']);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(abs, out);
        } else if (entry.name.endsWith('.html')) {
            out.push(abs);
        }
    }
    return out;
}

const canonicalOf = (html) => {
    const m = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    return m ? m[1] : null;
};

const robotsOf = (html) => {
    const m = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
    return m ? m[1] : '';
};

const isNoindex = (html) => /noindex/i.test(robotsOf(html));

/** The on-disk path a canonical resolves to under cleanUrls (`/a/b` -> `a/b.html` or `a/b/index.html`). */
function backingPath(canonical) {
    return cleanUrl(canonical, 'https://khudkibook.in').replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
}

const setRobots = (html, value) =>
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i.test(html)
        ? html.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${value}" />`)
        : html.replace(/<meta\s+name="viewport"/i, `<meta name="robots" content="${value}" />\n    <meta name="viewport"`);

const setCanonical = (html, url) =>
    html.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${url}" />`);

function main() {
    const files = walk(PUBLIC_DIR);

    // Group every indexable page by the canonical it declares.
    const groups = new Map();
    let noindexed = 0;
    let noCanonical = 0;

    for (const file of files) {
        const html = fs.readFileSync(file, 'utf8');
        if (isNoindex(html)) { noindexed++; continue; }
        const canonical = canonicalOf(html);
        if (!canonical) { noCanonical++; continue; }
        if (!groups.has(canonical)) groups.set(canonical, []);
        groups.get(canonical).push({ file, html, rel: path.relative(PUBLIC_DIR, file) });
    }

    /**
     * Higher is better. Material outranks everything so a real subject page is
     * never demoted in favour of an empty stub, then backing the canonical so
     * the surviving page is the one already being pointed at.
     */
    const score = (member, canonical) => {
        let s = 0;
        if (!isThinPlaceholder(member.html)) s += 100;
        const noExt = member.rel.replace(/\.html$/, '');
        if (noExt === backingPath(canonical) || noExt === backingPath(canonical) + '/index') s += 50;
        return s;
    };

    let changed = 0;
    let promoted = 0;
    let allThin = 0;
    const losers = [];

    for (const [canonical, members] of groups) {
        if (members.length < 2) continue;

        members.sort((a, b) => score(b, canonical) - score(a, canonical) || a.rel.localeCompare(b.rel));
        const winner = members[0];
        const rest = members.slice(1);

        // Nothing worth indexing behind this canonical: noindex the whole group.
        if (isThinPlaceholder(winner.html)) {
            allThin++;
            for (const m of members) {
                losers.push(m.rel);
                if (!DRY_RUN) fs.writeFileSync(m.file, setRobots(m.html, NOINDEX));
            }
            continue;
        }

        // The winner does not back the canonical, so the canonical would keep
        // pointing at a noindex page. Hand the URL to the winner instead.
        const backs = winner.rel.replace(/\.html$/, '') === backingPath(canonical) ||
            winner.rel.replace(/\.html$/, '') === backingPath(canonical) + '/index';
        if (!backs) {
            promoted++;
            if (!DRY_RUN) {
                const selfCanonical = cleanUrl('/' + winner.rel.replace(/\.html$/, ''), 'https://khudkibook.in');
                fs.writeFileSync(winner.file, setCanonical(winner.html, selfCanonical));
            }
        }

        for (const m of rest) {
            losers.push(m.rel);
            if (!DRY_RUN) fs.writeFileSync(m.file, setRobots(m.html, NOINDEX));
        }
        changed++;
    }

    /**
     * Second pass: a page that is indexable but whose canonical resolves to a
     * page that cannot be indexed.
     *
     * This is the same contradiction as PROMOTE, in the shape the first pass
     * cannot see. Where a subject's slug page is an empty stub it is already
     * noindex, so it never joins the canonical's group and the group is left
     * holding a single code-named page -- indexable, but pointing its canonical
     * at the stub. Google is told the indexable page is a copy of a page that
     * may not be indexed at all.
     *
     * Handing the URL to the page that owns the material fixes it. The first pass
     * has already reduced each of these groups to one indexable page, so nothing
     * is promoted here that was not already the group's winner.
     */
    let repointed = 0;
    for (const file of files) {
        const html = fs.readFileSync(file, 'utf8');
        if (isNoindex(html)) continue;
        const canonical = canonicalOf(html);
        if (!canonical) continue;

        const rel = backingPath(canonical);
        const own = path.relative(PUBLIC_DIR, file).replace(/\.html$/, '');
        // Already the page its own canonical names.
        if (own === rel || own === rel + '/index') continue;

        const direct = path.join(PUBLIC_DIR, rel + '.html');
        const served = fs.existsSync(direct) ? direct : path.join(PUBLIC_DIR, rel, 'index.html');
        if (!fs.existsSync(served)) continue;

        const servedHtml = fs.readFileSync(served, 'utf8');
        if (!isNoindex(servedHtml) && !isThinPlaceholder(servedHtml)) continue;

        repointed++;
        if (!DRY_RUN) fs.writeFileSync(file, setCanonical(html, cleanUrl('/' + own, 'https://khudkibook.in')));
    }

    const label = DRY_RUN ? 'DRY RUN - nothing written' : 'applied';
    console.log(`${label}: canonical consolidation`);
    console.log(`  html files scanned            : ${files.length}`);
    console.log(`  already noindex              : ${noindexed}`);
    console.log(`  indexable with a canonical   : ${[...groups.values()].reduce((n, g) => n + g.length, 0)}`);
    console.log(`  unique canonicals            : ${groups.size}`);
    console.log(`  duplicate groups fixed       : ${changed - allThin}`);
    console.log(`  canonical re-pointed (promote): ${promoted + repointed}`);
    console.log(`    of which lone pages        : ${repointed}`);
    console.log(`  all-thin groups noindexed     : ${allThin}`);
    console.log(`  pages noindexed              : ${losers.length}`);
    console.log(`  indexable files remaining    : ${[...groups.values()].reduce((n, g) => n + g.length, 0) - losers.length}`);
    if (DRY_RUN && losers.length) {
        console.log('\n  first 10 losers:');
        losers.slice(0, 10).forEach((l) => console.log('    ' + l));
    }
}

main();