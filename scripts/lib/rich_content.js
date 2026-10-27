/**
 * Shared renderer for the editorial copy in data/rich_content.json.
 *
 * The problem this solves: the generated tree carries ~6,100 indexable pages,
 * and roughly 400 of them -- the homepage, 188 branch landing pages, 216
 * semester indexes, the papers/syllabus tools and the blog index -- said almost
 * nothing beyond a list of links. Those are the pages a human reviewer lands on
 * first, and a wall of links with no original text is exactly the shape that
 * draws an AdSense "low value content" finding.
 *
 * Every one of those pages now carries a block rendered from
 * data/rich_content.json, which is a plain JSON file meant to be edited by
 * hand. The block is wrapped in `<!-- kb-rich:start ... -->` markers so it can
 * be replaced in place:
 *
 *   - scripts/generate.js calls the renderers when it builds a page, so newly
 *     generated pages carry the copy.
 *   - scripts/enrich_pages.js re-renders the same blocks over the committed
 *     tree, which is what actually deploys. Change the JSON, run
 *     `npm run enrich`, and every page updates. Both paths go through here, so
 *     the generator and the enricher can never drift apart.
 *
 * Each block is filled with the page's own facts -- branch name, degree level,
 * semester, subject count, subject names, credit totals -- so no two pages
 * render the same paragraph. Duplicated copy across hundreds of pages would be
 * its own thin-content problem, so the placeholders are load-bearing rather
 * than decorative.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CONTENT_PATH = path.join(__dirname, '..', '..', 'data', 'rich_content.json');

const MARK_START = (type, id) => `<!-- kb-rich:start type=${type} id=${id} -->`;
const MARK_END = '<!-- kb-rich:end -->';
const MARK_RE = /<!--\s*kb-rich:start[^>]*-->([\s\S]*?)<!--\s*kb-rich:end\s*-->/g;

let cached = null;

/** Load data/rich_content.json. Cached, because a full site pass loads it once. */
function loadRichContent() {
    if (cached) return cached;
    cached = JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf8'));
    return cached;
}

/** Test-only: forget the cached copy so an edited file is picked up. */
function resetRichContentCache() {
    cached = null;
}

// ---------------------------------------------------------------- utilities

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Fill {{placeholders}} in a template.
 *
 * Unknown placeholders are left verbatim rather than blanked: a blank renders
 * as broken prose in the browser and is easy to miss, while a visible
 * `{{subjectCount}}` shows up in review immediately.
 */
function fill(template, vars) {
    return String(template == null ? '' : template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, key) => {
        const v = vars[key];
        return v == null || v === '' ? whole : String(v);
    });
}

/** Serialise a plain list into readable English: "a, b and c". */
function listToSentence(items) {
    const clean = (items || []).filter(Boolean).map(String);
    if (!clean.length) return '';
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
    return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

function toWords(n) {
    const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    n = Number(n) || 0;
    if (n < 20) return ones[n] || String(n);
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? '-' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    return String(n);
}

/** Wrap a rendered block in the markers the enricher looks for. */
function wrapBlock(type, id, html) {
    if (!html) return '';
    return `${MARK_START(type, id)}\n${html.trim()}\n${MARK_END}`;
}

/** Remove every existing rich block from an HTML string. */
function stripBlocks(html) {
    return String(html || '').replace(MARK_RE, '');
}

/** True when the string still contains at least one rich block. */
function hasBlock(html) {
    return MARK_RE.test(String(html || ''));
}

/**
 * Resolve which curated profile a branch should use.
 *
 * `computer` on the Diploma page and `computer` on the BE page are different
 * programmes with different syllabi, so the JSON can carry `computer_diploma`
 * and `computer` separately. The lookup order is deliberate: the level-qualified
 * key wins, then the bare key, then an alias, then the default block. A missing
 * profile is not an error -- the default block is written so it reads correctly
 * for any branch, which is what keeps the enricher usable when a new branch
 * appears in site_db.json before anyone has written a profile for it.
 */
function profileFor(content, branchId, levelKey) {
    const profiles = (content.branch && content.branch.profiles) || {};
    const aliases = content.profileAliases || {};
    const base = String(branchId || '').toLowerCase();
    const candidates = [
        `${base}_${levelKey}`,
        base,
        aliases[base] ? `${aliases[base]}_${levelKey}` : null,
        aliases[base] || null
    ].filter(Boolean);
    for (const key of candidates) {
        if (profiles[key]) return Object.assign({}, content.branch.default, profiles[key]);
    }
    return Object.assign({}, content.branch.default);
}

/**
 * Merge the per-semester overrides over the shared semester block.
 *
 * data/rich_content.json carries a default block plus sem1..sem8 overrides.
 * Every override rewrites `title`, `intro`, `workload` and the whole `advice`
 * list, so a page that matches an override is entirely its own copy rather than
 * the default with one word swapped.
 */
function semesterGuideFor(content, semId) {
    const base = content.semester.default || {};
    const override = (content.semester.bySem || {})[semId];
    return override ? Object.assign({}, base, override) : base;
}

// ----------------------------------------------------------------- renderers

/** Visible word count, for callers that want to check a rendered block. */
function wordCount(html) {
    return stripBlocks(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&[a-z]+;/gi, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .length;
}

function icon(name) {
    return `<i class="fas ${esc(name)}" aria-hidden="true"></i>`;
}

function pointsList(points) {
    return (points || []).map((p) => `
        <li class="kb-rich-point">
          <span class="kb-rich-point-icon">${icon(p.icon || 'fa-check')}</span>
          <div>
            <h4>${esc(p.heading)}</h4>
            <p>${esc(p.body)}</p>
          </div>
        </li>`).join('');
}

function stepsList(steps) {
    return (steps || []).map((s) => `
        <li class="kb-rich-step">
          <span class="kb-rich-step-num">${esc(s.n)}</span>
          <div>
            <h4>${esc(s.heading)}</h4>
            <p>${esc(s.body)}</p>
          </div>
        </li>`).join('');
}

function faqList(items) {
    return (items || []).map((f) => `
        <details class="kb-rich-faq">
          <summary>${esc(f.q)}</summary>
          <p>${esc(f.a)}</p>
        </details>`).join('');
}

function sectionCards(sections) {
    return (sections || []).map((s) => `
        <article class="kb-rich-card">
          <h3>${icon(s.icon || 'fa-star')} ${esc(s.heading)}</h3>
          <p>${esc(s.body)}</p>
        </article>`).join('');
}

function h2(inner) {
    return `<h2 class="kb-rich-h2">${inner}</h2>`;
}

/**
 * Render the block for a branch landing page.
 *
 * `facts` needs: branchId, branchName, level ("Diploma" / "BE Degree" / "ME"),
 * levelWord ("diploma" / "degree" / "postgraduate"), subjectNames (array),
 * semesters (array of {id, name, nSubjects}), nSubjects.
 */
function renderBranchBlock(facts) {
    const content = loadRichContent();
    const shared = content.shared || {};
    const profile = profileFor(content, facts.branchId, facts.levelWord);
    const site = content.site || {};

    const vars = {
        branch: facts.branchName,
        level: facts.levelWord === 'diploma' ? 'Diploma' : facts.levelWord === 'postgraduate' ? 'ME' : 'BE Degree',
        levelLower: facts.levelWord === 'diploma' ? 'diploma' : facts.levelWord === 'postgraduate' ? 'ME' : 'BE Degree',
        university: site.universityShort || 'GTU',
        universityFull: site.university || 'Gujarat Technological University',
        nSubjects: toWords(facts.nSubjects),
        nSubjectsNum: facts.nSubjects,
        nSemesters: toWords((facts.semesters || []).length),
        nSemestersNum: (facts.semesters || []).length,
        semList: listToSentence((facts.semesters || []).map((s) => s.name)),
        subjectList: listToSentence((facts.subjectNames || []).slice(0, 6))
    };

    const semRows = (facts.semesters || []).map((s) => `
            <li>
              <a href="/${esc(facts.semesterHrefPrefix || '')}${esc(s.id)}/index.html">
                <strong>${esc(s.name)}</strong>
                <span>${esc(String(s.nSubjects || 0))} subject${Number(s.nSubjects) === 1 ? '' : 's'} &rarr;</span>
              </a>
            </li>`).join('');

    const html = `
<section class="kb-rich" data-kb-rich="branch" data-kb-rich-id="${esc(facts.branchId)}">
  <div class="kb-rich-head">
    <h2>${icon('fa-graduation-cap')} ${esc(fill((content.branch.default.heading || 'About GTU {{branch}} {{level}}'), vars))}</h2>
    <p class="kb-rich-lead">${esc(fill(profile.about, vars))}</p>
    <p>${esc(fill(profile.whatIs || content.branch.default.whatIs, vars))}</p>
    <p>${esc(fill(profile.careersNote, vars))}</p>
  </div>

  <div class="kb-rich-facts">
    <div class="kb-rich-fact"><strong>${esc(String(facts.nSemestersNum || (facts.semesters || []).length))}</strong><span>semesters on file</span></div>
    <div class="kb-rich-fact"><strong>${esc(String(facts.nSubjects || 0))}</strong><span>subjects listed</span></div>
    <div class="kb-rich-fact"><strong>${esc(facts.level || '')}</strong><span>programme level</span></div>
    <div class="kb-rich-fact"><strong>Free</strong><span>no login, no paywall</span></div>
  </div>

  <div class="kb-rich-cols">
    <div class="kb-rich-col">
      ${h2(`${icon('fa-compass')} What Is In ${esc(facts.branchName)} At GTU`)}
      <ul class="kb-rich-points">${pointsList((shared.whatYouGet || {}).points)}</ul>
    </div>
    <div class="kb-rich-col">
      ${h2(`${icon('fa-book')} Semesters Covered On This Page`)}
      <p class="kb-rich-note">${esc(fill(profile.semListNote || '', vars))}</p>
      <ol class="kb-rich-semlist">${semRows}</ol>
    </div>
  </div>

  ${h2(`${icon('fa-tasks')} How To Prepare Well In ${esc(facts.branchName)}`)}
  <ul class="kb-rich-points">${pointsList((profile.focus || []).map((text, i) => ({
        icon: ['fa-hourglass-half', 'fa-pen', 'fa-balance-scale', 'fa-redo'][i % 4],
        heading: `Tip ${i + 1}`,
        body: text
    })))}</ul>

  ${h2(`${icon('fa-question-circle')} How To Use This Page`)}
  <ol class="kb-rich-steps">${stepsList((shared.howToUse || {}).steps)}</ol>

  <div class="kb-rich-faq-wrap">
    ${h2(`${icon('fa-comments')} Questions GTU Students Ask`)}
    ${faqList(shared.faq)}
  </div>
</section>`;

    return wrapBlock('branch', facts.branchId, html);
}

/**
 * Render the block for a semester index page.
 *
 * `facts` needs: branchId, branchName, levelWord, semId ("sem3"), semName
 * ("Semester 3"), subjects (array of {code, name, credit}).
 */
function renderSemesterBlock(facts) {
    const content = loadRichContent();
    const shared = content.shared || {};
    const guide = semesterGuideFor(content, facts.semId);
    const site = content.site || {};

    const credits = (facts.subjects || []).map((s) => Number(s.credit) || 0).filter((c) => c > 0);
    const totalCredits = credits.reduce((a, b) => a + b, 0);
    const subjectNames = (facts.subjects || []).map((s) => s.name).filter(Boolean);

    const vars = {
        branch: facts.branchName,
        level: facts.levelWord === 'diploma' ? 'Diploma' : facts.levelWord === 'postgraduate' ? 'ME' : 'BE Degree',
        semName: facts.semName,
        semId: facts.semId,
        nSubjects: toWords((facts.subjects || []).length),
        nSubjectsNum: (facts.subjects || []).length,
        totalCredits: totalCredits,
        minCredits: credits.length ? Math.min.apply(null, credits) : 0,
        maxCredits: credits.length ? Math.max.apply(null, credits) : 0,
        subjectList: listToSentence(subjectNames.slice(0, 6)),
        university: site.universityShort || 'GTU'
    };

    const sharedNote = content.semester.sharedNote || {};

    const html = `
<section class="kb-rich" data-kb-rich="semester" data-kb-rich-id="${esc(facts.branchId)}/${esc(facts.semId)}">
  <div class="kb-rich-head">
    <h2>${icon('fa-layer-group')} ${esc(fill(guide.title, vars))}</h2>
    <p class="kb-rich-lead">${esc(fill(guide.intro, vars))}</p>
    <p>${esc(fill(guide.workload, vars))}</p>
    ${guide.emptyNote ? `<p class="kb-rich-note">${esc(fill(guide.emptyNote, vars))}</p>` : ''}
  </div>

  <div class="kb-rich-facts">
    <div class="kb-rich-fact"><strong>${esc(String(facts.subjects ? facts.subjects.length : 0))}</strong><span>subjects this semester</span></div>
    <div class="kb-rich-fact"><strong>${esc(String(totalCredits))}</strong><span>credits on the table</span></div>
    <div class="kb-rich-fact"><strong>Free</strong><span>papers and syllabus</span></div>
  </div>

  ${h2(`${icon('fa-tasks')} ${esc(fill(guide.adviceTitle || 'How To Work Through This Semester', vars))}`)}
  <ol class="kb-rich-steps">${(guide.advice || []).map((text, i) => `
        <li class="kb-rich-step">
          <span class="kb-rich-step-num">${i + 1}</span>
          <div><p>${esc(fill(text, vars))}</p></div>
        </li>`).join('')}</ol>

  ${h2(`${icon('fa-file-alt')} ${esc(sharedNote.heading || 'About The Papers On This Page')}`)}
  <p class="kb-rich-note">${esc(fill(sharedNote.body || '', vars))}</p>

  ${h2(`${icon('fa-question-circle')} Questions GTU Students Ask`)}
  <div class="kb-rich-faq-wrap">${faqList(shared.faq)}</div>
</section>`;

    return wrapBlock('semester', `${facts.branchId}/${facts.semId}`, html);
}

/** Render the block for the site homepage. */
function renderHomepageBlock(facts) {
    const content = loadRichContent();
    const home = content.homepage || {};
    const shared = content.shared || {};

    const vars = {
        nBranches: facts.nBranches || 0,
        nSubjects: facts.nSubjects || 0,
        nPapers: facts.nPapers || 0,
        university: (content.site || {}).universityShort || 'GTU'
    };

    const html = `
<section class="kb-rich kb-rich-home" data-kb-rich="homepage" data-kb-rich-id="home">
  <div class="kb-rich-head">
    <h2>${icon('fa-book-open')} ${esc(fill(home.title, vars))}</h2>
    <p class="kb-rich-lead">${esc(fill(home.intro, vars))}</p>
    <p>${esc(fill(home.intro2, vars))}</p>
  </div>

  <div class="kb-rich-facts">
    <div class="kb-rich-fact"><strong>${esc(String(vars.nBranches))}</strong><span>branches listed</span></div>
    <div class="kb-rich-fact"><strong>${esc(String(vars.nSubjects))}</strong><span>subject pages</span></div>
    <div class="kb-rich-fact"><strong>Diploma, BE, ME</strong><span>all three levels</span></div>
    <div class="kb-rich-fact"><strong>Free</strong><span>forever, no login</span></div>
  </div>

  <div class="kb-rich-grid">${sectionCards(home.sections)}</div>

  ${h2(`${icon('fa-tasks')} ${(shared.howToUse || {}).title || 'How To Use This Site'}`)}
  <ol class="kb-rich-steps">${stepsList((shared.howToUse || {}).steps)}</ol>

  ${h2(`${icon('fa-file-pdf')} ${(shared.whatYouGet || {}).title || 'What You Get'}`)}
  <p class="kb-rich-note">${esc((shared.whatYouGet || {}).intro || '')}</p>
  <ul class="kb-rich-points">${pointsList((shared.whatYouGet || {}).points)}</ul>

  <div class="kb-rich-faq-wrap">
    ${h2(`${icon('fa-comments')} ${esc(home.faqTitle || 'Frequently Asked Questions')}`)}
    ${faqList(shared.faq)}
  </div>
</section>`;

    return wrapBlock('homepage', 'home', html);
}

/** Render the block for a tool page (papers / syllabus / blog index). */
function renderToolBlock(kind, facts) {
    const content = loadRichContent();
    const tool = (content.tools || {})[kind];
    if (!tool) return '';

    const vars = Object.assign({ university: (content.site || {}).universityShort || 'GTU' }, facts || {});

    const html = `
<section class="kb-rich" data-kb-rich="tool" data-kb-rich-id="${esc(kind)}">
  <div class="kb-rich-head">
    <h2>${icon(kind === 'syllabus' ? 'fa-list-ol' : kind === 'blog' ? 'fa-pen-nib' : 'fa-file-alt')} ${esc(fill(tool.title, vars))}</h2>
    <p class="kb-rich-lead">${esc(fill(tool.intro, vars))}</p>
  </div>

  ${tool.whyTitle ? h2(`${icon('fa-lightbulb')} ${esc(fill(tool.whyTitle, vars))}`) : ''}
  ${(tool.why || []).length ? `<ul class="kb-rich-points">${pointsList((tool.why || []).map((text, i) => ({
        icon: ['fa-hourglass-half', 'fa-pen', 'fa-repeat', 'fa-balance-scale'][i % 4],
        heading: `Why it matters ${i + 1}`,
        body: text
    })))}</ul>` : ''}

  ${tool.howTitle ? h2(`${icon('fa-shoe-prints')} ${esc(fill(tool.howTitle, vars))}`) : ''}
  ${(tool.how || []).length ? `<ol class="kb-rich-steps">${stepsList((tool.how || []).map((s, i) => ({ n: String(i + 1), heading: '', body: s })))}</ol>` : ''}

  <div class="kb-rich-faq-wrap">
    ${h2(`${icon('fa-comments')} Questions GTU Students Ask`)}
    ${faqList((content.shared || {}).faq)}
  </div>
</section>`;

    return wrapBlock('tool', kind, html);
}

module.exports = {
    loadRichContent,
    resetRichContentCache,
    CONTENT_PATH,
    MARK_START,
    MARK_END,
    MARK_RE,
    wrapBlock,
    stripBlocks,
    hasBlock,
    profileFor,
    semesterGuideFor,
    renderBranchBlock,
    renderSemesterBlock,
    renderHomepageBlock,
    renderToolBlock,
    wordCount,
    fill,
    esc,
    toWords,
    listToSentence
};
