#!/usr/bin/env node
/**
 * Enrichment pass: stamp the curated editorial copy from data/rich_content.json
 * onto the committed pages that need it.
 *
 * The problem this solves: the pages a human (or an AdSense reviewer) lands on
 * first -- the homepage, the ~190 branch landing pages, the ~980 semester index
 * pages and the papers/syllabus/blog tools -- were walls of links with almost no
 * original text (papers.html carried 33 words, a branch landing 225). That is
 * the exact shape that draws a "low value content" finding, no matter how useful
 * the link collection is.
 *
 * data/rich_content.json + scripts/lib/rich_content.js already carry the copy
 * and the renderers for it. This file is the missing pass that applies them over
 * the committed tree -- the tree that actually deploys. Edit the JSON, re-run
 * `npm run enrich`, and every page updates in place. It is idempotent: each page
 * has its previous block stripped before the fresh one is written, so re-running
 * never duplicates copy.
 *
 * generate.js renders the same blocks at build time through the same library, so
 * a freshly generated page and an enriched page cannot drift apart.
 *
 * Usage: node scripts/enrich_pages.js [--dry] [--verbose]
 */

const fs = require('fs');
const path = require('path');
const { cleanInternalLinks, DEFAULT_SITE_URL } = require('./lib/seo');
const {
    loadRichContent,
    resetRichContentCache,
    stripBlocks,
    renderBranchBlock,
    renderSemesterBlock,
    renderHomepageBlock,
    renderToolBlock
} = require('./lib/rich_content');

const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_FILE = path.join(ROOT_DIR, 'data', 'site_db.json');

const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

// The threshold a page must clear once its block is added, measured on the whole
// visible page (not the block alone), so an enriched page is never itself thin.
const MIN_WORDS = (loadRichContent().thresholds || {}).minWords || 300;

// ------------------------------------------------------------------ helpers

// Same stop-word-aware title casing the generator uses, so a branch name from
// the ALL-CAPS database reads as "Agricultural Engineering", not "AGRICULTURAL
// ENGINEERING", inside the editorial sentences.
function titleCase(str) {
    const stop = new Set(['a', 'an', 'and', 'or', 'of', 'for', 'in', 'on', 'at', 'to', 'with', 'the', 'vs']);
    return String(str || '')
        .toLowerCase()
        .split(/\s+/)
        .map(w => {
            if (!w) return w;
            if (stop.has(w)) return w;
            if ((w.match(/[a-z]/g) || []).length <= 3) return w.toUpperCase();
            return w.charAt(0).toUpperCase() + w.slice(1);
        })
        .join(' ');
}

// Map a database domain id onto the level word the renderers expect.
const LEVEL_WORD = { diploma: 'diploma', be: 'degree', me: 'postgraduate' };
const LEVEL_LABEL = { diploma: 'Diploma', be: 'BE Degree', me: 'ME' };

/**
 * Replace/insert a rich block inside a page's <main>.
 *
 * Any previous block is stripped first (idempotency). By default the fresh
 * block is placed immediately after the opening <main ...> tag. Branch and
 * semester pages pass `position: 'end'` instead, so the semester/subject
 * selection stays at the top and the editorial copy sits below it. Generated
 * pages carry `<main id="main-content">`; a couple of the hand-written tool
 * pages carry a bare `<main>`, so both are accepted.
 */
function injectBlock(html, block, position) {
    if (!block) return { html, inserted: false };
    // The renderers emit links in the `.html` form; Firebase cleanUrls 301s
    // those, so point them at the clean URL before they land in the page. This
    // mirrors what generate.js finish() does, keeping the two paths identical.
    block = cleanInternalLinks(block, DEFAULT_SITE_URL);
    let out = stripBlocks(html);
    const openMain = /<main(?:\s[^>]*)?>/i.exec(out);
    if (!openMain) return { html: out, inserted: false };

    if (position === 'end') {
        const closeMain = out.lastIndexOf('</main>');
        if (closeMain === -1) return { html: out, inserted: false };
        const head = out.slice(0, closeMain).replace(/\s*$/, '');
        const tail = out.slice(closeMain);
        return { html: head + '\n\n' + block + '\n' + tail, inserted: true };
    }

    const head = out.slice(0, openMain.index + openMain[0].length);
    // Drop every leading blank line after the tag. A previous strip leaves the
    // newlines that used to surround the block behind, and without this the
    // gap would grow on every re-run -- phantom git churn on 1,117 files.
    const tail = out.slice(openMain.index + openMain[0].length).replace(/^\s*/, '');
    return { html: head + '\n\n' + block + '\n' + tail, inserted: true };
}

// Measure the whole visible page INCLUDING the rich block, so the "still thin"
// diagnostic reflects what a reader actually lands on. (rich_content.wordCount
// deliberately strips blocks to measure a block in isolation, so it is not used
// here.)
function visibleWords(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z#0-9]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
}

// ------------------------------------------------------------- page builders

const stats = {
    scanned: 0, written: 0, inserted: 0, skippedNoMain: 0, missing: 0, underThreshold: 0
};

function applyTo(relPath, block, label, position) {
    const abs = path.join(PUBLIC_DIR, relPath);
    if (!fs.existsSync(abs)) {
        stats.missing++;
        if (VERBOSE) console.log(`  miss ${relPath}`);
        return;
    }
    stats.scanned++;
    const before = fs.readFileSync(abs, 'utf8');
    const { html: after, inserted } = injectBlock(before, block, position);
    if (!inserted) {
        stats.skippedNoMain++;
        if (VERBOSE) console.log(`  no <main> ${relPath}`);
        return;
    }
    const words = visibleWords(after);
    if (words < MIN_WORDS) {
        stats.underThreshold++;
        if (VERBOSE) console.log(`  thin(${words}w) ${relPath}`);
    }
    if (after !== before) {
        stats.written++;
        if (!DRY) fs.writeFileSync(abs, after);
    }
    if (inserted) stats.inserted++;
    if (VERBOSE) console.log(`  ${inserted ? '+' : '~'} ${label} ${relPath} (${words}w)`);
}

function main() {
    if (!fs.existsSync(DATA_FILE)) {
        console.error('No database found at ' + DATA_FILE);
        process.exit(1);
    }
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    resetRichContentCache();

    let nBranches = 0, nSubjects = 0, nSemesters = 0;

    for (const unv of db.universities || []) {
        for (const dom of unv.domains || []) {
            const prefix = dom.urlPrefix || '';
            const levelWord = LEVEL_WORD[dom.id] || 'degree';
            for (const branch of dom.branches || []) {
                nBranches++;
                const branchName = titleCase(branch.name);
                const semesters = branch.semesters || [];
                const subjectNames = [];
                for (const sem of semesters) {
                    for (const sub of sem.subjects || []) {
                        nSubjects++;
                        if (sub.name) subjectNames.push(titleCase(sub.name));
                    }
                }

                // --- Branch landing page ---
                const branchBlock = renderBranchBlock({
                    branchId: branch.id,
                    branchName,
                    level: LEVEL_LABEL[dom.id] || 'BE Degree',
                    levelWord,
                    subjectNames,
                    semesters: semesters.map(s => ({
                        id: s.id,
                        name: s.name,
                        nSubjects: (s.subjects || []).length
                    })),
                    nSubjects: subjectNames.length,
                    semesterHrefPrefix: `${prefix ? prefix + '/' : ''}${branch.id}/`
                });
                applyTo(
                    `${prefix ? prefix + '/' : ''}${branch.id}homepage.html`,
                    branchBlock,
                    'branch',
                    'end'
                );

                // --- Semester index pages ---
                for (const sem of semesters) {
                    nSemesters++;
                    const semBlock = renderSemesterBlock({
                        branchId: branch.id,
                        branchName,
                        levelWord,
                        semId: sem.id,
                        semName: sem.name,
                        subjects: (sem.subjects || []).map(s => ({
                            code: s.code,
                            name: titleCase(s.name),
                            credit: s.credit
                        }))
                    });
                    applyTo(
                        `${prefix ? prefix + '/' : ''}${branch.id}/${sem.id}/index.html`,
                        semBlock,
                        'semester',
                        'end'
                    );
                }
            }
        }
    }

    // --- Homepage ---
    applyTo('index.html', renderHomepageBlock({ nBranches, nSubjects, nSemesters }), 'home');

    // --- Tool pages ---
    applyTo('papers.html', renderToolBlock('papers', {}), 'tool');
    applyTo('syllabus.html', renderToolBlock('syllabus', {}), 'tool');
    applyTo(path.join('blog', 'index.html'), renderToolBlock('blog', {}), 'tool');

    console.log(`${DRY ? '[dry] ' : ''}enrichment pass`);
    console.log(`  branches/semesters/subjects : ${nBranches} / ${nSemesters} / ${nSubjects}`);
    console.log(`  pages scanned               : ${stats.scanned}`);
    console.log(`  pages written               : ${stats.written}`);
    console.log(`  blocks inserted             : ${stats.inserted}`);
    console.log(`  missing files               : ${stats.missing}`);
    console.log(`  no <main> anchor            : ${stats.skippedNoMain}`);
    console.log(`  still under ${MIN_WORDS}w        : ${stats.underThreshold}`);
}

main();
