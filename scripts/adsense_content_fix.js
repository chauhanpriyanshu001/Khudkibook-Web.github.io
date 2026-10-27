#!/usr/bin/env node
/**
 * One-off AdSense content-honesty pass.
 *
 * The site advertises "English & Gujarati textbook PDFs" as a universal
 * feature on ~33k generated pages, but Gujarati-medium books exist for only
 * ~300 subjects. An overstated site-wide claim is exactly the sort of thing a
 * content-quality reviewer treats as a trust problem, so this rewrites the
 * claim to what the site actually offers while keeping the per-subject
 * "Gujarati Book" labels that point at real Drive PDFs (those are honest).
 *
 * Like fix_indexing.js this rewrites the committed tree in place, because the
 * site deploys from committed HTML and the generators alone do not change a
 * live URL. scripts/generate.js is updated separately so regeneration keeps
 * the new wording.
 *
 * Idempotent: rewritten text never matches an input pattern again.
 *
 * Usage: node scripts/adsense_content_fix.js [--dry] [--verbose]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DRY = process.argv.includes('--dry');
const VERBOSE = process.argv.includes('--verbose');

const SKIP_DIRS = new Set(['books', 'data', 'assets', 'icons', 'templates']);

/**
 * Longest-first: full sentences before the fragments inside them, so the
 * generic fallbacks only catch variants the specific rules missed.
 * Bare `&` and `&amp;` spellings are both listed because the generated tree
 * contains both.
 */
const REPLACEMENTS = [
    // Dominant subject-page boilerplate (~33k pages).
    [
        'Get the full GTU study material, English & Gujarati textbook PDFs, syllabus curriculum, and solved previous year question papers.',
        'Get the full GTU study material for this subject: official syllabus, textbook links (Gujarati-medium books included where available), and previous year question papers.'
    ],
    [
        'Get the full GTU study material, English &amp; Gujarati textbook PDFs, syllabus curriculum, and solved previous year question papers.',
        'Get the full GTU study material for this subject: official syllabus, textbook links (Gujarati-medium books included where available), and previous year question papers.'
    ],

    // Diploma branch subject-page intro variant.
    [
        'Free GTU study material for this subject - official syllabus, textbooks (English & Gujarati), solved & unsolved previous year question papers, important questions, and chapter-wise resources to help you prepare',
        'Free GTU study material for this subject: official syllabus, textbook links, solved and unsolved previous year question papers, and chapter-wise resources to help you prepare'
    ],

    // Branch homepage / semester intro variants (each ~1-120 pages).
    [
        'including official syllabus, English & Gujarati medium textbooks, solved and unsolved previous year question papers',
        'including official syllabus, textbook links, solved and unsolved previous year question papers'
    ],
    [
        'with free access to official syllabus, English & Gujarati medium textbooks, solved and unsolved previous year question papers',
        'with free access to official syllabus, textbook links, solved and unsolved previous year question papers'
    ],
    [
        'official syllabus, textbooks (English & Gujarati), solved & unsolved previous year question papers',
        'official syllabus, textbook links, solved & unsolved previous year question papers'
    ],
    [
        'including syllabus, textbooks (English & Gujarati), solved and unsolved previous year question papers',
        'including syllabus, textbook links, solved and unsolved previous year question papers'
    ],
    [
        'syllabus, textbooks (English & Gujarati), solved & unsolved previous year question papers',
        'syllabus, textbook links, solved & unsolved previous year question papers'
    ],

    // Generic leftovers (blog posts, meta descriptions, misc pages).
    [
        'textbooks (English and Gujarati)',
        'textbook links (including Gujarati-medium books where available)'
    ],
    [
        'textbooks (English &amp; Gujarati)',
        'textbook links'
    ],
    [
        'textbooks (English & Gujarati)',
        'textbook links'
    ],
    [
        'English and Gujarati medium material organised by branch and semester',
        'study material organised by branch and semester'
    ],
    [
        'English &amp; Gujarati textbooks, and previous-year papers',
        'textbook links and previous-year papers'
    ],
    [
        'English & Gujarati textbooks, and previous-year papers',
        'textbook links and previous-year papers'
    ],
    [
        'textbook PDFs, official syllabus, and previous year papers',
        'textbook links, official syllabus, and previous year papers'
    ],
    [
        'English &amp; Gujarati GTU textbook PDFs',
        'GTU textbook PDFs'
    ],
    [
        'English & Gujarati GTU textbook PDFs',
        'GTU textbook PDFs'
    ],
    [
        'English and Gujarati medium PDFs',
        'textbook PDFs'
    ],
    [
        'English &amp; Gujarati medium textbooks',
        'textbook links'
    ],
    [
        'English & Gujarati medium textbooks',
        'textbook links'
    ],
    [
        'English &amp; Gujarati textbook PDFs',
        'textbook links'
    ],
    [
        'English & Gujarati textbook PDFs',
        'textbook links'
    ]
];

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(abs, out);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) out.push(abs);
    }
    return out;
}

let files = 0, touched = 0;
const ruleHits = REPLACEMENTS.map(() => 0);

for (const file of walk(PUBLIC)) {
    files++;
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    for (let i = 0; i < REPLACEMENTS.length; i++) {
        const [from, to] = REPLACEMENTS[i];
        if (!after.includes(from)) continue;
        const parts = after.split(from);
        const hits = parts.length - 1;
        ruleHits[i] += hits;
        after = parts.join(to);
    }
    if (after !== before) {
        touched++;
        if (VERBOSE) console.log('  ~', path.relative(PUBLIC, file));
        if (!DRY) fs.writeFileSync(file, after);
    }
}

console.log(`${DRY ? '[dry] ' : ''}scanned ${files} pages, rewrote ${touched}`);
REPLACEMENTS.forEach(([from], i) => {
    if (ruleHits[i]) console.log(`  ${String(ruleHits[i]).padStart(6)}x  ${from.slice(0, 90)}${from.length > 90 ? '…' : ''}`);
});
