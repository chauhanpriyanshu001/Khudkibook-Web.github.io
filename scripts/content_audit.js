#!/usr/bin/env node
/**
 * Content-quality audit for the committed public/ tree.
 *
 * Prints the numbers that decide whether AdSense sees a valuable site or a
 * scaled directory:
 *
 *   - how many pages are indexable vs noindex
 *   - how many subject pages are low-value (syllabus + links only)
 *   - how many indexable subject pages share a single GTU course code
 *   - which indexable pages are empty generated shells
 *
 * This is read-only. It is the diagnostic used before/after the cleanup passes
 * (scripts/dedupe_subjects.js, scripts/fix_indexing.js, scripts/prune_junk.js,
 * scripts/gen_sitemap.js) and by scripts/quality_gate.js in CI.
 *
 * Usage:
 *   node scripts/content_audit.js
 *   node scripts/content_audit.js --json data/content_audit.json
 *   node scripts/content_audit.js --top 25 --verbose
 */

const fs = require('fs');
const path = require('path');
const {
    isLowValueSubjectPage,
    isSubjectPage,
    hasRealBook,
    hasOriginalEditorial,
    visibleWordCount,
    DEFAULT_SITE_URL
} = require('./lib/seo');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');

const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const jsonIndex = argv.indexOf('--json');
const JSON_PATH = jsonIndex !== -1 ? argv[jsonIndex + 1] : null;
const topIndex = argv.indexOf('--top');
const TOP = topIndex !== -1 ? Number(argv[topIndex + 1]) || 20 : 20;

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

function firstMatch(html, re) {
    const m = re.exec(html);
    return m ? m[1] : null;
}

function classify(relPath) {
    const p = '/' + relPath.split(path.sep).join('/');
    if (/\/blog\/[^/]+\.html$/i.test(p)) return 'blog';
    if (/\/sem\d+\/(?:index|homepage)\.html$/i.test(p)) return 'semester-index';
    if (/\/sem\d+\/[^/]+\.html$/i.test(p)) return 'subject';
    if (/homepage\.html$/i.test(p)) return 'branch-landing';
    return 'other';
}

function readSitemapCount() {
    try {
        const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
        return (xml.match(/<loc>/g) || []).length;
    } catch (e) {
        return 0;
    }
}

const files = walk(PUBLIC_DIR);
const pages = [];
const codeGroups = new Map();

for (const file of files) {
    let html;
    try {
        html = fs.readFileSync(file, 'utf8');
    } catch (e) {
        continue;
    }
    const rel = path.relative(PUBLIC_DIR, file);
    const relPosix = rel.split(path.sep).join('/');
    const type = classify(rel);
    const robots = firstMatch(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i) || '';
    const canonical = firstMatch(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
    const code = firstMatch(html, /"courseCode"\s*:\s*"([^"]*)"/);
    const noindex = /noindex/i.test(robots);
    const words = visibleWordCount(html);
    const subject = isSubjectPage(html);
    const lowValue = isLowValueSubjectPage(html);
    const realBook = hasRealBook(html);
    const editorial = hasOriginalEditorial(html);

    const page = {
        path: relPosix,
        type,
        noindex,
        indexable: !noindex,
        canonical,
        code,
        title: title ? title.replace(/\s+/g, ' ').trim() : null,
        words,
        subject,
        lowValue,
        realBook,
        editorial
    };
    pages.push(page);

    if (type === 'subject') {
        const key = code || `path:${relPosix}`;
        if (!codeGroups.has(key)) codeGroups.set(key, []);
        codeGroups.get(key).push(page);
    }
}

const indexable = pages.filter(p => p.indexable);
const byType = {};
for (const p of indexable) byType[p.type] = (byType[p.type] || 0) + 1;

const indexableSubjects = indexable.filter(p => p.type === 'subject');
const lowValueIndexable = indexableSubjects.filter(p => p.lowValue);
const thinIndexable = indexable.filter(p => p.type !== 'subject' && p.words < 300);

// Duplicate course codes among *indexable* subject pages: the same GTU subject
// rendered once per branch/semester. These are what the dedupe pass collapses.
const dupGroups = [];
for (const [code, list] of codeGroups) {
    const idx = list.filter(p => p.indexable);
    if (idx.length > 1) dupGroups.push({ code, count: idx.length, pages: idx.map(p => p.path) });
}
dupGroups.sort((a, b) => b.count - a.count);

const junk = indexable.filter(p => {
    if (p.type === 'subject' || p.type === 'blog') return false;
    if (p.type === 'semester-index') return p.words < 120;
    if (p.type === 'branch-landing') return p.words < 120;
    return false;
});

const report = {
    generatedAt: new Date().toISOString(),
    totals: {
        htmlFiles: pages.length,
        indexable: indexable.length,
        noindex: pages.length - indexable.length,
        sitemapUrls: readSitemapCount()
    },
    indexableByType: byType,
    subjects: {
        indexable: indexableSubjects.length,
        lowValue: lowValueIndexable.length,
        withRealBook: indexableSubjects.filter(p => p.realBook).length,
        withEditorial: indexableSubjects.filter(p => p.editorial).length,
        distinctCodes: indexableSubjects.filter(p => p.code).map(p => p.code).filter((v, i, a) => a.indexOf(v) === i).length,
        duplicateGroups: dupGroups.length,
        duplicatePages: dupGroups.reduce((n, g) => n + g.count, 0)
    },
    thinNonSubject: thinIndexable.map(p => ({ path: p.path, type: p.type, words: p.words })),
    junk: junk.map(p => ({ path: p.path, type: p.type, words: p.words })),
    topDuplicateGroups: dupGroups.slice(0, TOP),
    topLowValueSubjects: lowValueIndexable
        .slice()
        .sort((a, b) => a.words - b.words)
        .slice(0, TOP)
        .map(p => ({ path: p.path, code: p.code, words: p.words }))
};

function pct(n, d) {
    if (!d) return '0%';
    return `${Math.round((n / d) * 100)}%`;
}

console.log('Content audit');
console.log('=============');
console.log(`  HTML files            : ${report.totals.htmlFiles}`);
console.log(`  indexable             : ${report.totals.indexable}`);
console.log(`  noindex               : ${report.totals.noindex}`);
console.log(`  sitemap URLs          : ${report.totals.sitemapUrls}`);
console.log('');
console.log('Indexable by type');
for (const [type, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(22)}: ${n}`);
}
console.log('');
console.log('Subject pages (indexable)');
console.log(`  total                 : ${report.subjects.indexable}`);
console.log(`  low value (no book/editorial): ${report.subjects.lowValue} (${pct(report.subjects.lowValue, report.subjects.indexable)})`);
console.log(`  with real textbook    : ${report.subjects.withRealBook}`);
console.log(`  with editorial copy   : ${report.subjects.withEditorial}`);
console.log(`  distinct course codes : ${report.subjects.distinctCodes}`);
console.log(`  duplicate code groups : ${report.subjects.duplicateGroups} (${report.subjects.duplicatePages} pages)`);
console.log('');
console.log('Top duplicate course codes');
for (const g of report.topDuplicateGroups.slice(0, TOP)) {
    console.log(`  ${String(g.count).padStart(4)}x  ${g.code}`);
    if (VERBOSE) g.pages.slice(0, 5).forEach(p => console.log(`          ${p}`));
}
if (report.topDuplicateGroups.length > TOP) {
    console.log(`  ... and ${report.topDuplicateGroups.length - TOP} more`);
}
console.log('');
console.log(`Empty non-subject pages (<300 words, indexable): ${report.thinNonSubject.length}`);
for (const j of report.junk) console.log(`  - ${j.words.toString().padStart(4)}w  ${j.path} (${j.type})`);
if (report.junk.length < report.thinNonSubject.length) {
    console.log(`  (${report.thinNonSubject.length - report.junk.length} other short pages are utilities/policy pages)`);
}

if (JSON_PATH) {
    const out = path.resolve(ROOT_DIR, JSON_PATH);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`\nReport written to ${out}`);
}
