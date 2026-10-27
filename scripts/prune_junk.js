#!/usr/bin/env node
/**
 * Turn empty generated landing pages into lightweight noindex redirects.
 *
 * `public/` is committed, so stale output from older crawls/generators survives
 * forever. A few of those files are indexable but contain no content at all:
 *
 *   examTimeTablehomepage.html        (12 words, empty semester grid)
 *   BE/marinehomepage.html            (13 words, branch no longer in the DB)
 *   civil-engineering-dlmhomepage.html(14 words)
 *   mechanical-engineering-dlmhomepage.html (14 words)
 *   BE/common/sem8/index.html         (30 words, "0 Subjects Included")
 *
 * They are not subject pages, so the subject quality gate does not catch them;
 * they stayed in the sitemap and gave a reviewer an empty page to land on.
 *
 * This pass rewrites only generated landing/semester pages that are (a) still
 * indexable and (b) effectively empty, sending them to the nearest page with
 * real content (the branch landing, else the site root). It is deliberately
 * narrow: policy pages, blog posts, tool pages and subject pages are untouched.
 *
 * Idempotent -- a rewritten file carries the `kb-junk:redirect` marker.
 *
 * Usage: node scripts/prune_junk.js [--dry] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { visibleWordCount, DEFAULT_SITE_URL } = require('./lib/seo');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');
const MARKER = 'kb-junk:redirect';
const MAX_WORDS = 120;

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

function isNoindex(html) {
    const m = /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i.exec(html);
    return !!m && /noindex/i.test(m[1]);
}

function titleOf(html) {
    const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
    return (m ? m[1] : 'Khudkibook').replace(/\s*\|\s*Khudkibook\s*$/i, '').trim().slice(0, 120);
}

/**
 * The URL that should absorb this empty page.
 *  - a semester index falls back to its branch landing when one exists
 *  - everything else falls back to the site root
 */
function redirectTarget(relPosix) {
    const sem = /^(.*\/sem\d+)\/(?:index|homepage)\.html$/i.exec(relPosix);
    if (sem) {
        const dir = sem[1];
        const branchDir = path.posix.dirname(dir); // e.g. "BE/common"
        const branchHome = path.join(PUBLIC_DIR, `${branchDir}homepage.html`);
        if (fs.existsSync(branchHome)) return '/' + branchDir + 'homepage';
        return '/';
    }
    return '/';
}

function redirectPage(target, title) {
    const canonical = DEFAULT_SITE_URL.replace(/\/+$/, '') + target;
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, follow" />
    <link rel="canonical" href="${canonical}" />
    <meta http-equiv="refresh" content="0; url=${target}" />
    <title>${title} | Khudkibook</title>
    <!-- ${MARKER} -->
  </head>
  <body>
    <p style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; line-height: 1.6;">
      This page has no content yet. <a href="${target}">Continue to Khudkibook &rarr;</a>
    </p>
  </body>
</html>
`;
}

const stats = { scanned: 0, candidates: 0, rewritten: 0, already: 0, skipped: 0 };
const rewrites = [];

for (const file of walk(PUBLIC_DIR)) {
    const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    stats.scanned++;

    if (html.includes(MARKER)) { stats.already++; continue; }
    if (isNoindex(html)) continue;

    // Only generated landing/semester pages. Subject pages are handled by the
    // content quality gate; blog/tool/policy pages are never junk by length.
    const isLanding = /homepage\.html$/i.test(rel);
    const isSemIndex = /\/sem\d+\/index\.html$/i.test(rel);
    if (!isLanding && !isSemIndex) continue;

    stats.candidates++;
    const words = visibleWordCount(html);
    const empty = words < MAX_WORDS;
    if (!empty) { stats.skipped++; continue; }

    const target = redirectTarget(rel);
    stats.rewritten++;
    rewrites.push({ rel, words, target });
    if (!DRY) fs.writeFileSync(file, redirectPage(target, titleOf(html)));
    if (VERBOSE) console.log(`  ${rel} (${words}w) -> ${target}`);
}

console.log(`${DRY ? '[dry] ' : ''}prune empty generated landing pages`);
console.log(`  scanned   : ${stats.scanned}`);
console.log(`  candidates: ${stats.candidates}`);
console.log(`  rewritten : ${stats.rewritten}`);
console.log(`  already   : ${stats.already}`);
for (const r of rewrites) console.log(`    ${r.words.toString().padStart(4)}w  ${r.rel} -> ${r.target}`);
