#!/usr/bin/env node
/**
 * Prune empty "Coming Soon" subject pages into lightweight redirects.
 *
 * Why: the site carries ~21,575 generated subject pages that offer neither a
 * textbook nor question papers -- a title, a breadcrumb and two "Coming Soon"
 * empty states. They are the bulk of the tree (1.18 GB of 1.9 GB) and they are
 * simultaneously:
 *
 *   1. What blows the Firebase Hosting free-plan storage cap on every deploy
 *      (each release copies the whole tree), and
 *   2. Exactly the "scaled thin content" an AdSense reviewer flags.
 *
 * Every one of these is already `noindex`. This pass swaps each file's body for
 * a tiny redirect that sends the reader to the subject's own semester index --
 * the nearest page with real content -- so:
 *
 *   - the ~15k internal links pointing at these keep working (they land on the
 *     semester index instead of a dead end),
 *   - a reviewer who opens one is sent to substantive content, and
 *   - each file shrinks from ~55 KB to ~1 KB, cutting ~1.16 GB per release.
 *
 * Pages that DO carry a textbook or past papers are untouched -- isThinPlaceholder
 * (scripts/lib/seo.js) is the single source of "what counts as a stub", shared
 * with the noindex pass and the ad guard, so the three can never disagree.
 *
 * Idempotent: a pruned file carries a `kb-pruned:redirect` marker and is skipped
 * on re-run. Safe to run repeatedly; use --dry to preview.
 *
 * Usage: node scripts/prune_stubs.js [--dry] [--verbose] [--restore]
 */

const fs = require('fs');
const path = require('path');
const { isThinPlaceholder, DEFAULT_SITE_URL } = require('./lib/seo');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');
const RESTORE = process.argv.includes('--restore'); // report only; git is the real restore

const MARKER = 'kb-pruned:redirect';

const SKIP_DIRS = new Set(['templates', 'assets', 'icons', 'data']);
// Never redirect an index/homepage onto its own directory.
const NEVER_PRUNE = new Set(['index.html', 'homepage.html']);

// The subject's own semester index, as the clean (slashless, non-.html) URL
// that answers 200. `civil/sem3/slug.html` -> `/civil/sem3`.
function semesterUrl(relPath) {
    const dir = path.posix.dirname(relPath); // e.g. "civil/sem3" or "BE/computer/sem1"
    const parts = dir.split('/');
    // Safety net: only prune where the parent really is a semester folder, so we
    // never redirect a page to something that is not a semester index.
    if (!/^sem\d+$/i.test(parts[parts.length - 1])) return null;
    return '/' + dir;
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
      This subject has no textbook or question papers on file yet.
      <a href="${target}">Go to its semester page &rarr;</a>
    </p>
  </body>
</html>
`;
}

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs, out);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(abs);
    }
    return out;
}

function titleOf(html) {
    const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
    let t = (m ? m[1] : '').replace(/\s*\|\s*Khudkibook\s*$/i, '').trim();
    if (!t) t = 'Subject';
    return t.replace(/[<>]/g, '').slice(0, 120);
}

const stats = { scanned: 0, pruned: 0, already: 0, skipped: 0, bytesBefore: 0, bytesAfter: 0 };

for (const file of walk(PUBLIC_DIR)) {
    stats.scanned++;
    const before = fs.readFileSync(file, 'utf8');

    if (before.includes(MARKER)) { stats.already++; continue; }

    if (!isThinPlaceholder(before)) continue;
    if (NEVER_PRUNE.has(path.basename(file))) { stats.skipped++; continue; }

    const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
    const target = semesterUrl(rel);
    if (!target) { stats.skipped++; if (VERBOSE) console.log(`  skip (not a semester path): ${rel}`); continue; }

    stats.bytesBefore += Buffer.byteLength(before);
    const after = redirectPage(target, titleOf(before));
    stats.bytesAfter += Buffer.byteLength(after);
    stats.pruned++;
    if (!DRY) fs.writeFileSync(file, after);
    if (VERBOSE) console.log(`  ${rel} -> ${target}`);
}

console.log(`${DRY ? '[dry] ' : ''}prune thin subject stubs`);
console.log(`  scanned        : ${stats.scanned}`);
console.log(`  pruned         : ${stats.pruned}`);
console.log(`  already pruned : ${stats.already}`);
console.log(`  skipped        : ${stats.skipped}`);
if (stats.pruned) {
    const savedMB = (stats.bytesBefore - stats.bytesAfter) / (1024 * 1024);
    console.log(`  bytes saved    : ${savedMB.toFixed(0)} MB (this run)`);
}
if (RESTORE) console.log('  note: originals are in git -- `git checkout -- public/` restores them.');
