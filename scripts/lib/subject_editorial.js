/**
 * Render the reviewed, per-subject editorial block.
 *
 * Subject pages used to carry only the scraped GTU syllabus and download links.
 * That is enough to be useful once, but thousands of near-identical pages of it
 * is exactly the "scaled content" shape an AdSense reviewer rejects. This block
 * adds copy written for the subject: what it is for, how GTU examines it, what
 * the units cover (read from the official syllabus cache), how to prepare and
 * the mistakes that cost marks.
 *
 * The copy lives in data/subject_content.json keyed by course code. It is added
 * deliberately, never generated in bulk. A page is only treated as having
 * "original value" (scripts/lib/seo.js: hasOriginalEditorial) when this marker
 * class is present, so the indexing, sitemap and ad guards all move together.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..', '..');
const CONTENT_FILE = path.join(ROOT_DIR, 'data', 'subject_content.json');
const SYLLABUS_FILE = path.join(ROOT_DIR, 'data', 'syllabus_content.json');

const REVIEW_DATE = '2026-10-27';

let contentCache = null;
let syllabusCache = null;

function loadSubjectContent() {
    if (contentCache) return contentCache;
    try {
        contentCache = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
    } catch (e) {
        contentCache = {};
    }
    return contentCache;
}

function loadSyllabus() {
    if (syllabusCache) return syllabusCache;
    try {
        syllabusCache = JSON.parse(fs.readFileSync(SYLLABUS_FILE, 'utf8'));
    } catch (e) {
        syllabusCache = {};
    }
    return syllabusCache;
}

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function shortUnitTitle(title) {
    // Syllabus titles sometimes carry the whole unit objective on one line.
    const clean = String(title || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= 90) return clean;
    return clean.slice(0, 87).replace(/[\s,;:.-]+$/, '') + '…';
}

function unitsFor(code) {
    const entry = loadSyllabus()[code];
    if (!entry || !Array.isArray(entry.units)) return [];
    return entry.units
        .filter(u => u && (u.title || (u.topics && u.topics.length)))
        .slice(0, 12)
        .map(u => ({
            n: u.n,
            title: shortUnitTitle(u.title),
            topics: Array.isArray(u.topics) ? u.topics.length : 0,
            marks: u.marks || null
        }));
}

function getSubjectContent(code) {
    return loadSubjectContent()[code] || null;
}

/**
 * Strip a previously injected block, so the enrichment pass is idempotent.
 * The block contains no nested <section>, so a non-greedy match is safe.
 */
function stripSubjectEditorial(html) {
    if (!html) return html;
    return html.replace(/<section class="kb-subject-editorial"[\s\S]*?<\/section>\s*/i, '');
}

/**
 * @param {string} code GTU course code
 * @param {{name?: string}} facts display name (from the page/database)
 * @returns {string} HTML block, or '' when there is no reviewed copy
 */
function renderSubjectEditorial(code, facts = {}) {
    const entry = getSubjectContent(code);
    if (!entry || !entry.overview) return '';

    const name = esc(facts.name || 'this subject');
    const units = unitsFor(code);

    const unitList = units.length
        ? `<h3>What the units cover</h3>
                <p>The official syllabus for ${name} is divided into ${units.length} unit${units.length === 1 ? '' : 's'}. Treat this as your revision checklist — every unit you can summarise without notes is a unit you can answer on exam day.</p>
                <ol class="kb-subject-editorial-units">
                    ${units.map(u => `<li><strong>${u.n ? `Unit ${u.n}` : 'Unit'}:</strong> ${esc(u.title || '')}${u.topics ? ` <span class="kb-editorial-meta">(${u.topics} topic${u.topics === 1 ? '' : 's'})</span>` : ''}${u.marks ? ` <span class="kb-editorial-meta">(${esc(u.marks)} marks)</span>` : ''}</li>`).join('\n                    ')}
                </ol>`
        : '';

    const plan = Array.isArray(entry.studyPlan) && entry.studyPlan.length
        ? `<h3>How to prepare</h3>
                <ol class="kb-subject-editorial-plan">
                    ${entry.studyPlan.map(s => `<li>${esc(s)}</li>`).join('\n                    ')}
                </ol>`
        : '';

    const pitfalls = Array.isArray(entry.pitfalls) && entry.pitfalls.length
        ? `<h3>Common mistakes to avoid</h3>
                <ul class="kb-subject-editorial-pitfalls">
                    ${entry.pitfalls.map(s => `<li>${esc(s)}</li>`).join('\n                    ')}
                </ul>`
        : '';

    return `<section class="kb-subject-editorial" data-subject-code="${esc(code)}">
            <div class="kb-subject-editorial-inner">
                <h2>About ${name} (${esc(code)})</h2>
                <p class="kb-subject-editorial-overview">${esc(entry.overview)}</p>
                <h3>How GTU examines this subject</h3>
                <p>${esc(entry.examPattern || 'Check your branch scheme for the current theory and internal-assessment split, and use the previous-year papers linked above to see the pattern.')}</p>
                ${unitList}
                ${plan}
                ${pitfalls}
                <p class="kb-subject-editorial-note">Written and reviewed by the Khudkibook editorial team. Last reviewed: <time datetime="${REVIEW_DATE}">${REVIEW_DATE}</time>. Read our <a href="/editorial-policy">editorial policy</a>.</p>
            </div>
        </section>

        `;
}

module.exports = {
    loadSubjectContent,
    getSubjectContent,
    renderSubjectEditorial,
    stripSubjectEditorial,
    REVIEW_DATE
};
