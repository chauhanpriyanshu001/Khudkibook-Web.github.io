/**
 * GTU live source — reads Gujarat Technological University's public JSON API.
 *
 * GTU rebuilt gtu.ac.in as a React SPA, so the old Circular.aspx scraping path
 * is dead (it 404s). The public feed behind the new site is:
 *
 *   GET /api/v1/site/category-circulars/?page_number=1&page_size=50
 *     -> { data: [{ id, title, created_at, category, category_id,
 *                  file_url, documents: [{file_url, file_name}], is_important }],
 *          meta: { total, page, page_size, total_pages } }
 *
 * Notes learned from the live API:
 *  - `data` is ordered newest-first by `created_at`/`id`.
 *  - `page_size` above 50 returns 502, so 50 is the hard ceiling.
 *  - Heavy 502s happen when requests are fired back to back; callers must pace.
 *  - The category list lives at /site/category-circulars/categories/.
 *
 * This module is deliberately side-effect free apart from `fetchCirculars`,
 * so both the 24x7 watcher and the admin-panel crawler can share it.
 */

const GTU_ORIGIN = 'https://gtu.ac.in';
const API_BASE = `${GTU_ORIGIN}/api/v1`;
const CIRCULARS_PATH = '/site/category-circulars/';
const CATEGORIES_PATH = '/site/category-circulars/categories/';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const MAX_PAGE_SIZE = 50;

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Collapse GTU's messy title spacing: "Sem- 1", "Sem - 6", "A.Y.  2026-27". */
function tidyTitle(title) {
    return String(title || '')
        .replace(/\s+/g, ' ')
        .replace(/\bSEM\s*-\s*/gi, 'Sem ')
        .replace(/\bSemester\s*-\s*/gi, 'Semester ')
        .replace(/\bA\.Y\.\s*/gi, 'A.Y. ')
        .replace(/\s*([,.;:])\s*/g, '$1 ')
        .replace(/\s+/g, ' ')
        .replace(/[\s,;:]+$/, '')
        .trim();
}

// The public API sits behind something that intermittently answers 502 even at
// a single sequential request, so every call gets a generous retry budget with
// exponential backoff. Empirically 2-3 attempts is almost always enough.
async function apiGet(path, { retries = 6, timeoutMs = 25000, minDelayMs = 900 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                signal: controller.signal,
                headers: {
                    'User-Agent': UA,
                    'Accept': 'application/json',
                    'Referer': `${GTU_ORIGIN}/academics/circulars`
                }
            });
            clearTimeout(timer);
            if (res.status === 502 || res.status === 503 || res.status === 429 || res.status === 504) {
                lastErr = new Error(`HTTP ${res.status} (throttled) for ${path}`);
            } else if (!res.ok) {
                throw new Error(`HTTP ${res.status} for ${path}`);
            } else {
                return await res.json();
            }
        } catch (e) {
            clearTimeout(timer);
            lastErr = e;
        }
        if (attempt < retries) {
            const backoff = Math.min(minDelayMs * Math.pow(2, attempt), 12000) + Math.floor(Math.random() * 600);
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    throw lastErr || new Error(`Failed to fetch ${path}`);
}

/** Normalise one raw API record into the shape the site stores. */
function normalizeNotice(raw) {
    const documents = Array.isArray(raw.documents) ? raw.documents : [];
    const pdfs = documents
        .filter(d => d && d.file_url)
        .map(d => ({ url: d.file_url, name: d.file_name || '' }));
    if (raw.file_url && !pdfs.some(p => p.url === raw.file_url)) {
        pdfs.unshift({ url: raw.file_url, name: documents[0] && documents[0].file_name ? documents[0].file_name : '' });
    }
    return {
        id: Number(raw.id),
        title: tidyTitle(raw.title),
        rawTitle: String(raw.title || '').replace(/\s+/g, ' ').trim(),
        date: (raw.created_at || '').slice(0, 10),
        postedAt: raw.created_at || '',
        category: raw.category || 'General',
        categoryId: raw.category_id != null ? Number(raw.category_id) : null,
        link: pdfs.length ? pdfs[0].url : (raw.file_url || ''),
        documents: pdfs,
        important: !!raw.is_important,
        source: 'gtu.ac.in',
        sourcePage: `${GTU_ORIGIN}/academics/circulars`
    };
}

/**
 * Fetch the newest circulars, newest first.
 * @param {number} pages how many pages of 50 to pull
 */
async function fetchCirculars(pages = 1, opts = {}) {
    const log = opts.log || (() => {});
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize || MAX_PAGE_SIZE));
    const out = [];
    let meta = null;

    for (let page = 1; page <= Math.max(1, pages); page++) {
        const qs = new URLSearchParams({ page_number: String(page), page_size: String(pageSize) });
        const json = await apiGet(`${CIRCULARS_PATH}?${qs.toString()}`, opts);
        if (!json || json.success === false) throw new Error(`Unexpected API response: ${JSON.stringify(json).slice(0, 200)}`);
        const rows = Array.isArray(json.data) ? json.data : [];
        meta = json.meta || meta;
        log(`[GTU] page ${page}: ${rows.length} notice(s) (total on GTU: ${meta && meta.total ? meta.total : '?'})`);
        for (const raw of rows) out.push(normalizeNotice(raw));
        if (!json.meta || !json.meta.has_next) break;
        await new Promise(r => setTimeout(r, opts.delay || 1500));
    }

    // De-duplicate by id, keeping the newest first ordering.
    const seen = new Set();
    return out.filter(n => (seen.has(n.id) ? false : (seen.add(n.id), true)));
}

async function fetchCategories(opts = {}) {
    const json = await apiGet(CATEGORIES_PATH, opts);
    return (Array.isArray(json.data) ? json.data : []).map(c => ({
        id: Number(c.id),
        code: c.code,
        name: c.name
    }));
}

// ========================================================
// Classification
// ========================================================

/** GTU category names that are never student-relevant news. */
const NOISE_CATEGORIES = new Set([
    'phd', 'tender', 'recruitment', 'college activity',
    'potential funding resources', 'media coverage', 'new horizons'
]);

const PROGRAMS = [
    { name: 'Diploma in Engineering', short: 'DE', re: /Diploma\s+in\s+Engineering|\bD\.?E\.?\b|Diploma\s+Engineering/i },
    { name: 'Bachelor of Engineering', short: 'BE', re: /Bachelor\s+of\s+Engineering|\bB\.?E\.?\b|\bBE\s+Working\s+Professional/i },
    { name: 'Master of Engineering', short: 'ME', re: /Master\s+of\s+Engineering|\bM\.?E\.?\b|M\.Tech/i },
    { name: 'Bachelor of Architecture', short: 'B.Arch', re: /Bachelor\s+of\s+Architecture|\bB\.?Arch\b/i },
    { name: 'Diploma in Architecture', short: 'D.Arch', re: /Diploma\s+in\s+Architecture/i },
    { name: 'Master of Architecture', short: 'M.Arch', re: /Master\s+of\s+Architecture/i },
    { name: 'Bachelor of Planning', short: 'B.Plan', re: /Bachelor\s+of\s+Planning|\bB\.Plan\b/i },
    { name: 'Master of Planning', short: 'M.Plan', re: /Master\s+of\s+Planning|\bM\.Plan\b/i },
    { name: 'Master of Business Administration', short: 'MBA', re: /Master\s+of\s+Business\s+Administration|\bMBA\b/i },
    { name: 'Master of Computer Applications', short: 'MCA', re: /Master\s+of\s+Computer\s+Applications|\bMCA\b/i },
    { name: 'Bachelor of Computer Applications', short: 'BCA', re: /Bachelor\s+of\s+Computer\s+Applications|\bBCA\b/i },
    { name: 'Bachelor of Business Administration', short: 'BBA', re: /Bachelor\s+of\s+Business\s+Administration|\bBBA\b/i },
    { name: 'Master of Commerce', short: 'M.Com', re: /Master\s+of\s+Commerce|\bM\.?Com\b/i },
    { name: 'Bachelor of Commerce', short: 'B.Com', re: /Bachelor\s+of\s+Commerce|\bB\.?Com\b/i },
    { name: 'Bachelor of Science', short: 'B.Sc', re: /Bachelor\s+of\s+Science|\bB\.?Sc\b/i },
    { name: 'Master of Science', short: 'M.Sc', re: /Master\s+of\s+Science|\bM\.?Sc\b/i },
    { name: 'Bachelor of Arts', short: 'BA', re: /Bachelor\s+of\s+Arts|\bBA\b/i },
    { name: 'Master of Arts', short: 'MA', re: /Master\s+of\s+Arts|\bMA\b/i },
    { name: 'Bachelor of Pharmacy', short: 'B.Pharm', re: /Bachelor\s+of\s+Pharmacy|\bB\.?Pharm\b/i },
    { name: 'Master of Pharmacy', short: 'M.Pharm', re: /Master\s+of\s+Pharmacy|\bM\.?Pharm\b/i },
    { name: 'Pharm.D', short: 'Pharm.D', re: /Pharm\.?D/i },
    { name: 'Bachelor of Hotel Management', short: 'BHMCT', re: /Hotel\s+and\s+Hospital\s+Management|\bBHMCT\b|\bBHM\b/i },
    { name: 'Bachelor of Interior Design', short: 'BID', re: /Interior\s+Design|\bBID\b/i },
    { name: 'Bachelor of Vocational', short: 'B.Voc', re: /\bB\.?\s?Voc(ational)?\b/i },
    { name: 'PhD', short: 'PhD', re: /\bPh\.?D\b/i }
];

/** Human wording for each result-event kind, used in labels and headings. */
const RESULT_KIND_LABELS = {
    main: 'Result declared',
    recheck: 'Recheck result declared',
    remedial: 'Remedial result declared',
    'term-extension': 'Term extension result declared',
    supplementary: 'Supplementary result declared'
};

/** Pull out the facts a GTU title reliably carries. */
function extractFacts(notice) {
    const t = notice.rawTitle || notice.title || '';
    const facts = {};

    const sess = t.match(/\b(Summer|Winter)\s*[-–—]?\s*(\d{4})\b/i);
    if (sess) {
        facts.session = `${sess[1][0].toUpperCase()}${sess[1].slice(1).toLowerCase()} ${sess[2]}`;
        facts.sessionSlug = `${sess[1][0].toLowerCase()}${sess[1].slice(1).toLowerCase()}-${sess[2]}`;
        facts.sessionYear = sess[2];
        facts.sessionName = sess[1][0].toUpperCase() + sess[1].slice(1).toLowerCase();
    }

    const ay = t.match(/\bA\.?Y\.?\s*(\d{4})\s*[-–]\s*(\d{2,4})\b/i);
    if (ay) {
        facts.academicYear = `${ay[1]}-${ay[2].length === 2 ? ay[1].slice(0, 2) + ay[2] : ay[2]}`;
        facts.academicYearSlug = facts.academicYear.replace(/\s/g, '');
    } else {
        const ay2 = t.match(/\b(20\d{2})\s*[-–]\s*(\d{2})\b(?!\s*[-–]\s*\d)/);
        if (ay2) facts.academicYear = `${ay2[1]}-${ay2[2]}`;
    }

    const sem = t.match(/\bSem(?:ester)?\s*[-–—]?\s*(\d{1,2})\b/i);
    if (sem) facts.semester = parseInt(sem[1], 10);

    const semRange = t.match(/\bSem(?:ester)?\s*[-–—]?\s*(\d{1,2})\s*(?:to|&|and|[-–—])\s*(\d{1,2})\b/i);
    if (semRange) {
        facts.semesterFrom = parseInt(semRange[1], 10);
        facts.semesterTo = parseInt(semRange[2], 10);
    }

    const minor = t.match(/\b(Minor\s+Hons?ours?)\b/i);
    if (minor) facts.isMinor = true;

    const prog = PROGRAMS.find(p => p.re.test(t));
    if (prog) {
        facts.program = prog.name;
        facts.programShort = prog.short;
    }

    facts.isRecheck = /\bre\s*[-–]?\s*check\b/i.test(t);
    facts.isReassessment = /\bre\s*[-–]?\s*assessment\b/i.test(t);
    facts.isRegular = /\bregular\b/i.test(t);
    facts.isRemedial = /\bremedial\b/i.test(t);
    facts.isTermExtension = /\bterm\s+extension\b/i.test(t);
    facts.isBiAnnual = /bi\s*[-–]?\s*annual/i.test(t);
    facts.isSupplementary = /\bsupplementary\b|\bmake\s*[- ]?up\b|\brevised\b|\bcompartmental\b/i.test(t);

    // Which *kind* of event this circular announces. This is what decides
    // whether a notice continues an existing blog post or deserves a new one:
    // the Summer 2026 main result and the Summer 2026 recheck result are two
    // separate news events with separate dates and separate audiences, even
    // though both are "results for Summer 2026". Keying on session alone would
    // quietly rewrite the old article weeks later.
    //
    // Note this deliberately looks at the event, not at the programme/semester:
    // GTU fans one result announcement out into dozens of near-identical
    // circulars (one per programme x semester), and those all collapse into the
    // same kind, hence the same post. The fan-out is not the news; the event is.
    if (/\bresult\b|\bdeclaration\b|\bmarks\s+statement\b|\btranscript\b/i.test(t)) {
        if (facts.isSupplementary) facts.resultKind = 'supplementary';
        else if (facts.isTermExtension) facts.resultKind = 'term-extension';
        // Remedial and recheck/reassessment are deliberately the SAME bucket. To a
        // student both mean "you failed and here is a second chance", GTU announces
        // them in the same breath, and splitting them would turn one result
        // announcement into three near-identical thin posts.
        else if (facts.isRemedial || facts.isRecheck || facts.isReassessment) facts.resultKind = 'recheck';
        else facts.resultKind = 'main';
    }

    // A concrete date mentioned in the title itself, e.g. "on 07/10/2026".
    const onDate = t.match(/\bon\s+(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    if (onDate) {
        const [, dd, mm, yyyy] = onDate;
        facts.eventDate = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    return facts;
}

/**
 * Map a notice onto a "topic" — the unit we actually publish.
 *
 * GTU emits dozens of near-identical circulars for one real-world event (one per
 * programme x semester). Publishing a post per circular would be thin-content
 * spam, so notices are bucketed by topic and one canonical post is maintained
 * per topic key.
 *
 * @returns {{type:string, key:string, label:string, newsworthy:boolean, priority:number}}
 */
function topicFor(notice) {
    const t = notice.rawTitle || notice.title || '';
    const f = extractFacts(notice);
    const sess = f.sessionSlug || 'unspecified';
    const cat = String(notice.category || '').toLowerCase();

    if (NOISE_CATEGORIES.has(cat)) {
        return { type: 'noise', key: `noise:${cat}`, label: notice.category, newsworthy: false, priority: 0 };
    }

    // Admin circulars aimed at affiliated colleges rather than students. GTU files
    // these under the same Circular category as student news, so they pass the
    // category check above — but a "re-inspection fee for affiliated institutes"
    // page is not what a student searching this site wants.
    if (/\b(affiliated\s+institutes?|institutional\s+inspection|re\s*[- ]?inspection|inspection\s+(?:fees?|charges?)|affiliation\s+(?:fees?|charges?)|AIC\s+fees?)\b/i.test(t)) {
        return { type: 'institute-admin', key: `institute-admin:${sess}`, label: 'Institute administration', newsworthy: false, priority: 0 };
    }

    if (/\bresult\b|\bdeclaration\b|\brecheck\b|\bre\s*assessment\b|\bmarks\s+statement\b|\btranscript\b/i.test(t)) {
        // Keyed on session AND on which kind of result event this is, so:
        //   - the programme x semester fan-out of one announcement still
        //     collapses into a single post (same kind, same session), and
        //   - a genuinely new result event gets its own new post instead of
        //     being appended to — and silently rewriting — the old one.
        // "Summer 2026 result" and "Summer 2026 recheck result" are separate
        // news: different dates, different students, different search intent.
        const kind = f.resultKind || 'main';
        return {
            type: 'result',
            key: `result:${sess}:${kind}`,
            label: `${RESULT_KIND_LABELS[kind]} — ${f.session || 'current session'}`,
            newsworthy: true,
            priority: 10 + (kind === 'main' ? 1 : 0) // the main result is the headline students want
        };
    }

    if (/\btime\s*[-–]?\s*table\b|\bexam\s+schedule\b|\bexam\s+date|\bseating\s+arrangement\b|\bhall\s+ticket\b|\binvigilator\b|\bquestion\s+paper\b/i.test(t)) {
        return {
            type: 'exam-schedule',
            key: `exam-schedule:${sess}`,
            label: `Exam dates & schedule — ${f.session || 'current session'}`,
            newsworthy: true,
            priority: 9
        };
    }

    if (/\bexam\s+form|\bforms\s+of\b|\bfilling\s+(the\s+)?(regular|remedial)\b|\bexam\s+registration\b/i.test(t)) {
        const type = f.isTermExtension ? 'term-extension' : 'exam-form';
        return {
            type,
            key: `${type}:${sess}`,
            label: `${type === 'term-extension' ? 'Term extension' : 'Exam form'} — ${f.session || 'current session'}`,
            newsworthy: true,
            priority: 8
        };
    }

    if (/\bacademic\s+calendar\b|\btentative\s+(examination\s+)?dates\b/i.test(t)) {
        const ay = f.academicYearSlug || 'ay';
        return {
            type: 'academic-calendar',
            key: `academic-calendar:${ay}`,
            label: `Academic calendar — A.Y. ${f.academicYear || 'current'}`,
            newsworthy: true,
            priority: 9
        };
    }

    if (/\bsyllabus\b|\bcurriculum\b|\bnew\s+subject\b|\bintroduction\s+of\b|\bcredits?\b|\bcurriculum\s+structure\b/i.test(t)) {
        const prog = f.programShort ? `-${f.programShort}` : '';
        const semNo = f.semester ? `-sem${f.semester}` : '';
        return {
            type: 'syllabus',
            key: `syllabus:${prog}${semNo}:${notice.date.slice(0, 7)}`,
            label: `Syllabus / curriculum change${f.program ? ` — ${f.program}` : ''}`,
            newsworthy: true,
            priority: 7
        };
    }

    if (/\badmission\b|\bcounselling\b|\bmerit\s+list\b|\bvacant\s+seats?\b|\bGCAS\b|\bcap\s+round\b/i.test(t)) {
        const ay = f.academicYearSlug || notice.date.slice(0, 7);
        return {
            type: 'admission',
            key: `admission:${ay}`,
            label: `Admission update — A.Y. ${f.academicYear || notice.date.slice(0, 4)}`,
            newsworthy: true,
            priority: 8
        };
    }

    if (/\bfees?\b|\bscholarship\b|\breimbursement\b/i.test(t)) {
        return {
            type: 'fee',
            key: `fee:${notice.date.slice(0, 7)}`,
            label: 'Fee / scholarship update',
            newsworthy: true,
            priority: 6
        };
    }

    if (/\bholidays?\b|\bworking\s+day|\bacademic\s+vacation\b/i.test(t)) {
        return {
            type: 'calendar-holiday',
            key: `holiday:${notice.date.slice(0, 7)}`,
            label: 'Holidays / academic vacation',
            newsworthy: true,
            priority: 5
        };
    }

    return { type: 'other', key: `other:${notice.id}`, label: notice.category || 'General', newsworthy: false, priority: 2 };
}

function enrich(notice) {
    const facts = extractFacts(notice);
    const topic = topicFor(notice);
    return { ...notice, facts, topic };
}

module.exports = {
    GTU_ORIGIN,
    API_BASE,
    CIRCULARS_PATH,
    CATEGORIES_PATH,
    MAX_PAGE_SIZE,
    esc,
    tidyTitle,
    apiGet,
    fetchCirculars,
    fetchCategories,
    normalizeNotice,
    extractFacts,
    topicFor,
    enrich,
    PROGRAMS,
    NOISE_CATEGORIES
};
