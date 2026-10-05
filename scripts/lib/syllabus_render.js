/**
 * Render the cached syllabus content into the on-page HTML of a subject page.
 *
 * Why
 * ---
 * Every subject page on the site links the official GTU syllabus PDF, but the
 * page body itself held no content: a breadcrumb, a badge row, a paragraph of
 * boilerplate and a list of sibling subjects. That is what Google and the
 * AdSense reviewer both score as thin, and it is why 92% of the site read as
 * empty shells.
 *
 * This module turns the parsed syllabus -- the unit list, the topics inside each
 * unit, the teaching hours -- into real text on the page. Every fact rendered
 * here is read out of the official GTU document for that subject code, so it is
 * specific to the subject and verifiable against the source PDF. Nothing is
 * generated or paraphrased.
 *
 * The content is cached in data/syllabus_content.json by
 * scripts/syllabus_content.js; a code with no entry renders exactly as before.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONTENT_FILE = path.join(__dirname, '..', '..', 'data', 'syllabus_content.json');

let cache = null;

/** Load the syllabus cache once per process. */
function loadSyllabus() {
    if (cache) return cache;
    try {
        cache = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    } catch (e) {
        cache = {};
    }
    return cache;
}

/**
 * Escape text for interpolation into HTML.
 *
 * The syllabus text is extracted from third-party PDFs, so it can contain
 * `<`, `&` and stray angle brackets. Everything that reaches the page goes
 * through here.
 */
function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * True when a topic line is too broken to be worth showing.
 *
 * The PDFs are a mix of born-digital and scanned documents, so a handful of
 * lines come back as fragments ("appropriate", "nd"). A list of those next to
 * real topics makes the section look machine-generated, so they are dropped.
 */
function usableTopic(t) {
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length < 2) return false;
    // Needs at least two real words, not just numerals or fragments.
    return words.filter(w => /[a-z]{2}/i.test(w)).length >= 2;
}

function unitHtml(unit) {
    const topics = (unit.topics || []).filter(usableTopic);
    if (!topics.length) return '';

    const num = unit.n || '';
    const meta = [];
    if (unit.hours) meta.push(`${unit.hours} lecture hours`);
    if (unit.marks) meta.push(String(unit.marks));

    const heading = unit.title
        ? `<h3 class="kb-unit-title">${num ? `<span class="kb-unit-n">Unit ${esc(num)}</span> ` : ''}${esc(unit.title)}</h3>`
        : `<h3 class="kb-unit-title"><span class="kb-unit-n">Unit ${esc(num)}</span></h3>`;

    return `
                        <div class="kb-unit">
                            ${heading}
                            ${meta.length ? `<p class="kb-unit-meta">${esc(meta.join(' · '))}</p>` : ''}
                            <ul class="kb-topics">
                                ${topics.map((t) => `<li>${esc(t)}</li>`).join('\n                                ')}
                            </ul>
                        </div>`;
}

/**
 * The syllabus section for one subject, or an empty string when the code has no
 * usable parsed syllabus.
 *
 * `ctx` (branch and semester names) is woven into the intro because a subject
 * code is shared across many branches -- 3316301 English alone appears on over
 * a hundred diploma pages. The unit list is identical on all of them, so without
 * branch-specific framing every one of those pages would carry byte-identical
 * body text.
 */
function renderSyllabusSection(code, ctx = {}) {
    const all = loadSyllabus();
    const entry = all && all[String(code || '').trim()];
    if (!entry || !Array.isArray(entry.units) || !entry.units.length) return '';

    const blocks = entry.units.map(unitHtml).filter(Boolean);
    if (!blocks.length) return '';

    const topicsTotal = entry.units.reduce((n, u) => n + (u.topics || []).filter(usableTopic).length, 0);
    const subjectName = entry.name || '';
    const where = [ctx.branch, ctx.semester].filter(Boolean).join(' · ');
    const scope = where
        ? `as prescribed for ${esc(where)}`
        : 'as prescribed by GTU';

    return `
                    <section class="kb-syllabus" aria-labelledby="kb-syllabus-h">
                        <h2 id="kb-syllabus-h">${esc(subjectName)} Syllabus — Unit-wise Content</h2>
                        <p class="kb-syllabus-intro">
                            The official GTU curriculum for <strong>${esc(subjectName)}</strong> (subject code
                            ${esc(entry.code)}) ${scope} divides the course into
                            ${entry.units.length} unit${entry.units.length === 1 ? '' : 's'}, covering ${topicsTotal} listed
                            topic${topicsTotal === 1 ? '' : 's'}. The unit-wise breakdown below is read from the GTU syllabus
                            document for this subject code, so you can check what the course actually covers before
                            deciding which papers to attempt.
                        </p>
                        <a class="kb-syllabus-pdf" href="${esc(entry.syllabusUrl || '')}" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-file-pdf" aria-hidden="true"></i>
                            Download the official syllabus PDF (${esc(entry.code)})
                        </a>
${blocks.join('\n')}
                    </section>`;
}

module.exports = { renderSyllabusSection, loadSyllabus, esc, usableTopic };