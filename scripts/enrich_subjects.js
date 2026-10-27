#!/usr/bin/env node
/**
 * Inject the reviewed subject editorial block into committed subject pages.
 *
 * The copy lives in data/subject_content.json (keyed by GTU course code) and is
 * rendered by scripts/lib/subject_editorial.js. This pass applies it over the
 * tree that actually deploys, because public/ is committed and the generator is
 * not run on every change.
 *
 * Only subjects with an entry are touched. A subject without reviewed copy stays
 * syllabus-only and is `noindex` (see scripts/fix_indexing.js), so the indexable
 * set is exactly the pages the site can stand behind.
 *
 * The block is stripped and re-inserted, so re-running after editing the JSON
 * updates every page without duplicating copy.
 *
 * Usage: node scripts/enrich_subjects.js [--dry] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const {
    renderSubjectEditorial,
    stripSubjectEditorial,
    loadSubjectContent
} = require('./lib/subject_editorial');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');
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

function extract(html, re) {
    const m = re.exec(html);
    return m ? m[1] : null;
}

function insertBlock(html, block) {
    const syllabus = /<section\s+class="kb-syllabus"/i.exec(html);
    if (syllabus) {
        return html.slice(0, syllabus.index) + block + html.slice(syllabus.index);
    }
    const contribs = /<div class="kb-contribs-section"/i.exec(html);
    if (contribs) {
        return html.slice(0, contribs.index) + block + html.slice(contribs.index);
    }
    const closeMain = html.lastIndexOf('</main>');
    if (closeMain !== -1) {
        return html.slice(0, closeMain) + block + html.slice(closeMain);
    }
    return null;
}

const content = loadSubjectContent();
const wanted = new Set(Object.keys(content).filter(k => !k.startsWith('_')));
const stats = { scanned: 0, matched: 0, written: 0, skippedNoCode: 0, skippedNoindex: 0, missing: new Set() };

for (const file of walk(PUBLIC_DIR)) {
    const rel = path.relative(PUBLIC_DIR, file).split(path.sep).join('/');
    if (!/\/sem\d+\/[^/]+\.html$/i.test('/' + rel)) continue;
    if (/(?:\/index|\/homepage)\.html$/i.test('/' + rel)) continue;

    stats.scanned++;
    const before = fs.readFileSync(file, 'utf8');
    // Duplicates are noindexed by scripts/dedupe_subjects.js and canonicalised
    // to a single page per course code. Only the canonical copy needs the
    // reviewed copy; writing it to all ~40 twins would be wasted bytes.
    const robots = extract(before, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || '';
    if (/noindex/i.test(robots)) { stats.skippedNoindex++; continue; }
    const code = extract(before, /"courseCode"\s*:\s*"([^"]*)"/);
    if (!code) { stats.skippedNoCode++; continue; }
    if (!wanted.has(code)) continue;
    stats.matched++;

    const name = extract(before, /"@type":"Course","name":"([^"]+)"/)
        || extract(before, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
        || code;
    const block = renderSubjectEditorial(code, { name: name.replace(/<[^>]+>/g, '').trim() });
    if (!block) { stats.missing.add(code); continue; }

    const stripped = stripSubjectEditorial(before);
    const after = insertBlock(stripped, block);
    if (!after) { stats.missing.add(code); continue; }
    if (after !== before) {
        stats.written++;
        if (!DRY) fs.writeFileSync(file, after);
        if (VERBOSE) console.log(`  + ${rel} (${code})`);
    }
}

console.log(`${DRY ? '[dry] ' : ''}enrich subject pages with reviewed editorial copy`);
console.log(`  scanned        : ${stats.scanned}`);
console.log(`  already noindex: ${stats.skippedNoindex}`);
console.log(`  matched codes  : ${stats.matched}`);
console.log(`  rewritten      : ${stats.written}`);
if (stats.missing.size) console.log(`  no render      : ${[...stats.missing].join(', ')}`);
