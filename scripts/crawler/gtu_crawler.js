/**
 * GTU Crawler & Data Aggregator Suite
 * Scrapes:
 * 1. Latest GTU Circulars / Notices (https://gtu.ac.in/Circular.aspx)
 * 2. Official Syllabus & Teaching Schemes (https://gtu.ac.in/Syllabus/Syllabus.aspx)
 * 3. Year-wise & Session-wise Exam Question Papers via Download1.aspx postback
 *
 * Outputs structured JSON and non-destructively merges into site_db.json.
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Paths
const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'site_db_backup.json');
const NOTICES_FILE = path.join(DATA_DIR, 'gtu_notices.json');
const CRAWLED_PAPERS_FILE = path.join(DATA_DIR, 'crawled_gtu_papers.json');
const CRAWLED_SYLLABUS_FILE = path.join(DATA_DIR, 'crawled_gtu_syllabus.json');
const CRAWL_STATE_FILE = path.join(DATA_DIR, 'crawl_state.json');

const GTU_BASE = 'https://gtu.ac.in';
const SYLLABUS_PAGE = `${GTU_BASE}/Syllabus/Syllabus.aspx`;
const PAPERS_PAGE = `${GTU_BASE}/Download1.aspx`;
const CIRCULAR_PAGE = `${GTU_BASE}/Circular.aspx`;
const SYLLABUS_S3_PREFIX = 'https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const CURRENT_YEAR = new Date().getFullYear();

function esc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ========================================================
// HTTP helpers (native fetch)
// ========================================================
async function fetchHTML(url, opts = {}) {
    const { retries = 2, timeoutMs = 25000 } = opts;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': UA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            clearTimeout(timer);
            if (!res.ok) {
                if (res.status === 404) return { status: res.status, body: '' };
                lastErr = new Error(`HTTP ${res.status} for ${url}`);
                continue;
            }
            const body = await res.text();
            return { status: res.status, body, type: res.headers.get('content-type') || '' };
        } catch (e) {
            clearTimeout(timer);
            lastErr = e;
        }
    }
    throw lastErr || new Error(`Failed to fetch ${url}`);
}

async function postForm(url, fields = {}, buttonField, opts = {}) {
    const { retries = 2, timeoutMs = 30000 } = opts;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const getRes = await fetchHTML(url, { retries: 1, timeoutMs });
            if (getRes.status !== 200 || !getRes.body) throw new Error(`GET ${url} -> ${getRes.status}`);

            const $ = cheerio.load(getRes.body);
            const body = new URLSearchParams();

            $('input[type="hidden"]').each((i, el) => {
                const name = $(el).attr('name');
                const value = $(el).attr('value') || '';
                if (name && !body.has(name)) body.set(name, value);
            });

            $('select').each((i, el) => {
                const name = $(el).attr('name');
                if (!name || body.has(name)) return;
                if (fields[name] !== undefined) return; // will be set below
                const firstValue = $(el).find('option').first().attr('value');
                body.set(name, firstValue === undefined ? '' : firstValue);
            });

            for (const [k, v] of Object.entries(fields)) {
                body.set(k, v);
            }
            if (buttonField) body.set(buttonField, 'Search');

            const res = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                redirect: 'follow',
                headers: {
                    'User-Agent': UA,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': new URL(url).origin,
                    'Referer': url,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                body: body.toString()
            });
            clearTimeout(timer);
            if (!res.ok) {
                lastErr = new Error(`POST ${url} -> ${res.status}`);
                continue;
            }
            const html = await res.text();
            return html;
        } catch (e) {
            clearTimeout(timer);
            lastErr = e;
        }
    }
    throw lastErr || new Error(`Failed to POST ${url}`);
}

async function checkLink(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': UA }
        });
        clearTimeout(timer);
        return res.status >= 200 && res.status < 400;
    } catch (e) {
        clearTimeout(timer);
        try {
            const res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
            return res.status >= 200 && res.status < 400;
        } catch (e2) {
            return false;
        }
    }
}

// ========================================================
// Session / label helpers
// ========================================================
function getLabelFromSession(session) {
    // session like 'S2024' or 'W2024'
    const season = String(session || '').startsWith('W') ? 'Winter' : 'Summer';
    const year = String(session || '').replace(/^[SW]/i, '');
    return `${season} ${year} Exam Paper`;
}

function getSessionsForYear(year) {
    return [`S${year}`, `W${year}`];
}

/**
 * Parse an "effective from" string into a starting calendar year (number) or null.
 * Handles formats: "2024-25", "2023-2024", "Sept-2012", "Aug-2022", "2021", etc.
 */
function parseEffectiveYear(value) {
    const s = String(value || '').trim();
    if (!s) return null;
    const m = s.match(/(20\d{2})\s*[-–/]\s*(\d{2}|\d{4})/);
    if (m) {
        const start = parseInt(m[1], 10);
        const endPart = parseInt(m[2], 10);
        let end = start;
        if (Number.isFinite(endPart)) {
            end = endPart < 100 ? (start + endPart - (start % 100)) : endPart;
        }
        if (end >= start) return start;
        return start;
    }
    const only = s.match(/(20\d{2})/);
    if (only) return parseInt(only[1], 10);
    const monthYear = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-.\s]+(20\d{2})/i);
    if (monthYear) return parseInt(monthYear[2], 10);
    return null;
}

/**
 * Academic-year range (list of calendar years) a syllabus "effective from" covers,
 * based on program duration in years. Returns null when the year can't be parsed.
 */
function academicYearsFor(effectiveFrom, programYears = 3) {
    const start = parseEffectiveYear(effectiveFrom);
    if (start === null) return null;
    const dur = Math.max(1, parseInt(programYears, 10) || 1);
    return Array.from({ length: dur }, (_, i) => start + i);
}

/**
 * Program duration (calendar years) implied by a domain/branch semester count.
 */
function programYearsFor(branch) {
    const semCount = (branch && branch.semesters && branch.semesters.length) || 6;
    return Math.max(1, Math.ceil(semCount / 2));
}

function pickExType(code = '', exTypesOverride = []) {
    if (exTypesOverride && exTypesOverride.length) return exTypesOverride;
    const c = String(code);
    if (/^42\d{5}$/.test(c) || /^2\d{6}$/.test(c)) return ['DI'];
    if (/^3\d{6}$/.test(c)) return ['BE', 'MN', 'ME'];
    if (/^62\d{5}$/.test(c)) return ['MC']; // MCA
    if (/^63\d{5}$/.test(c)) return ['MB']; // MBA
    if (/^64\d{5}$/.test(c)) return ['BC']; // BCA
    if (/^65\d{5}$/.test(c)) return ['BB']; // BBA
    if (/^66\d{5}$/.test(c)) return ['BP']; // B.Pharm
    if (/^67\d{5}$/.test(c)) return ['MP']; // M.Pharm
    return ['DI', 'BE'];
}

// ========================================================
// 1. CIRCULARS / NOTICES
// ========================================================
const NOISE_RE = /(more|read more|click here|view all|all circular|circular|notification\s*$|^[\s\-|]*$)/i;

function extractDateFromString(text) {
    if (!text) return '';
    const m = String(text).match(/(20\d{2})(\d{2})(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = String(text).match(/(\d{1,2})\s*[-/.]\s*([A-Za-z]{3,9})\s*[-/.]\s*(\d{2,4})/);
    if (d) {
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const mon = months.findIndex(x => d[2].toLowerCase().startsWith(x)) + 1;
        const yr = d[3].length === 2 ? `20${d[3]}` : d[3];
        return `${yr}-${String(mon).padStart(2, '0')}-${String(d[1]).padStart(2, '0')}`;
    }
    return '';
}

function isNoiseLink(href, text) {
    const h = String(href || '').toLowerCase();
    const t = String(text || '').trim();
    if (!h || h === '#' || h.startsWith('javascript') || h.startsWith('mailto')) return true;
    if (h.includes('circular.aspx') || h.includes('syllabus.aspx') || h.includes('download1.aspx')) return true;
    if (!h.includes('amazonaws.com') || !h.includes('gtusitecirculars')) return true;
    if (!h.toLowerCase().endsWith('.pdf')) return true;
    if (!t || t.length < 5 || NOISE_RE.test(t)) return true;
    return false;
}

function categorizeNotice(title = '') {
    const t = title.toLowerCase();
    if (t.includes('result') || t.includes('declaration')) return 'Result & Notifications';
    if (t.includes('exam') || t.includes('examination')) return 'Exam';
    if (t.includes('timetable') || t.includes('schedule') || t.includes('time table')) return 'Timetable';
    if (t.includes('syllabus') || t.includes('curriculum')) return 'Academic';
    if (t.includes('fee')) return 'Fees';
    if (t.includes('admission')) return 'Admission';
    return 'General';
}

async function crawlCirculars(options = {}) {
    const log = options.log || (msg => console.log(msg));
    const limit = options.limit || 100;
    log(`[Circulars] Fetching ${CIRCULAR_PAGE}`);
    const res = await fetchHTML(CIRCULAR_PAGE);
    if (res.status !== 200) throw new Error(`Circular page returned ${res.status}`);

    const $ = cheerio.load(res.body);
    const notices = [];
    const seen = new Set();

    $('a').each((i, el) => {
        if (notices.length >= limit) return;
        const href = $(el).attr('href') || '';
        let title = $(el).text().replace(/\s+/g, ' ').trim();
        if (!title && href) title = decodeURIComponent(href.split('/').pop().replace(/\.pdf$/i, '')).replace(/[_-]+/g, ' ');
        if (isNoiseLink(href, title)) return;

        let link = href;
        if (!/^https?:\/\//i.test(link)) {
            link = link.startsWith('//') ? `https:${link}` : `${GTU_BASE}/${link.replace(/^\//, '')}`;
        }
        const key = link.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        const fileName = decodeURIComponent(link.split('/').pop() || '');
        const date = extractDateFromString(fileName) || extractDateFromString(title) || '';

        notices.push({
            title,
            date,
            category: categorizeNotice(title),
            link,
            source: 'gtu.ac.in',
            scrapedAt: new Date().toISOString()
        });
    });

    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(NOTICES_FILE, JSON.stringify(notices, null, 2));
    log(`[Circulars] Saved ${notices.length} notices to ${NOTICES_FILE}`);
    return notices;
}

// ========================================================
// 2. SYLLABUS
// ========================================================
function scoreTable($, table) {
    const text = $(table).text().replace(/\s+/g, ' ');
    let score = 0;
    if (/subject\s*name/i.test(text)) score += 5;
    if (/\bcredit\b/i.test(text)) score += 4;
    if (/\bsem\b/i.test(text)) score += 3;
    if (/effective\s*from|teaching\s*scheme/i.test(text)) score += 3;
    if (/is.?theory|is.?practical/i.test(text)) score -= 5; // detail tables
    const rows = $(table).find('tr').length;
    if (rows >= 3) score += 2;
    return score;
}

async function crawlSyllabusByCode(code, options = {}) {
    const log = options.log || (msg => console.log(msg));
    const html = await postForm(SYLLABUS_PAGE, {
        'ctl00$ContentPlaceHolder1$txtsubcode': String(code)
    }, 'ctl00$ContentPlaceHolder1$btn_search', options);

    const $ = cheerio.load(html);
    const tables = $('table').toArray().sort((a, b) => scoreTable($, b) - scoreTable($, a));
    const table = tables[0];
    if (!table) return null;

    const rows = [];
    $(table).find('tr').each((i, tr) => {
        const cells = $(tr).find('td').map((j, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
        if (!cells.length) return;
        const idx = cells.findIndex(c => c === String(code));
        if (idx === -1) return;
        const after = cells.slice(idx + 1);
        if (after.length < 15) return;

        const credit = parseFloat(String(after[9] || '').replace(/,/g, ''));
        rows.push({
            subjectCode: String(code),
            branchCode: after[0],
            effectiveFrom: after[1],
            subjectName: after[2],
            category: after[3],
            semYear: after[4],
            ltpPBL: `${after[5]} / ${after[6]} / ${after[7]} / ${after[8]}`,
            credit: isNaN(credit) ? 0 : credit,
            marksEM: after[10],
            marksIV: after[12],
            marksTotal: after[14]
        });
    });

    if (!rows.length) return null;

    const first = rows[0];
    return {
        code: String(code),
        name: first.subjectName,
        link: `${SYLLABUS_S3_PREFIX}${code}.pdf`,
        credit: first.credit,
        category: first.category,
        semYear: first.semYear,
        branchCode: first.branchCode,
        effectiveFrom: first.effectiveFrom,
        rows
    };
}

async function crawlSyllabus(codes = [], options = {}) {
    const log = options.log || (msg => console.log(msg));
    const delay = options.delay || 600;
    const state = loadCrawlState();
    const force = options.force === true;
    log(`[Syllabus] Fetching syllabus for ${codes.length} subject codes${force ? ' (FORCE)' : ' (incremental)'}...`);

    const results = [];
    let scanned = 0;
    for (const code of codes) {
        try {
            if (!force && isSyllabusScanned(state, code, force)) {
                continue;
            }
            scanned++;
            const res = await crawlSyllabusByCode(code, options);
            if (res) {
                results.push(res);
                log(`[Syllabus] ✓ ${code}: ${res.name}${res.effectiveFrom ? ' (eff ' + res.effectiveFrom + ')' : ''}`);
            }
            else log(`[Syllabus] No data for ${code}`);
            // Only mark scanned when no crash occurred during this code's fetch
            markSyllabusScanned(state, code, force);
        } catch (e) {
            log(`[Syllabus] ✗ ${code}: ${e.message}`);
        }
        if (delay) await new Promise(r => setTimeout(r, delay));
    }

    saveCrawlState(state);
    if (scanned > 0) log(`[Syllabus] Scanned ${scanned} new code(s)`);

    if (options.save !== false) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CRAWLED_SYLLABUS_FILE, JSON.stringify(results, null, 2));
        log(`[Syllabus] Saved ${results.length} syllabus entries to ${CRAWLED_SYLLABUS_FILE}`);
    }
    return results;
}

// ========================================================
// 3. QUESTION PAPERS (Download1.aspx)
// ========================================================
async function searchQuestionPapersForCode(code, session, extype, options = {}) {
    const log = options.log || (msg => console.log(msg));
    const html = await postForm(PAPERS_PAGE, {
        'ctl00$ContentPlaceHolder1$ddlsession': session,
        'ctl00$ContentPlaceHolder1$drpextype': extype,
        'ctl00$ContentPlaceHolder1$txtsearch': String(code)
    }, 'ctl00$ContentPlaceHolder1$btnsearch', options);

    const $ = cheerio.load(html);
    const links = [];
    const seen = new Set();
    const wantedSession = String(session).toUpperCase();
    const paperUrlRe = /\/uploads\/([A-Z]\d{4})\/([A-Z]{1,4})\/([A-Z]?\d{7})\.pdf$/i;
    $('a[href*="uploads"]').each((i, el) => {
        let href = $(el).attr('href') || '';
        if (!/^https?:\/\//i.test(href)) {
            href = href.startsWith('//') ? `https:${href}` : `${GTU_BASE}/${href.replace(/^\/+/, '')}`;
        }
        const m = href.match(paperUrlRe);
        if (!m) return;
        if (m[1].toUpperCase() !== wantedSession) return; // must match searched session
        if (seen.has(href)) return;
        seen.add(href);
        links.push({
            subjectCode: String(code),
            session,
            extype,
            year: String(session).replace(/^[SW]/i, ''),
            label: getLabelFromSession(session),
            link: href,
            type: 'paper'
        });
    });

    const papers = [];
    for (const p of links) {
        if (options.verify === false) {
            papers.push({ ...p, verified: true, scrapedAt: new Date().toISOString() });
            continue;
        }
        const ok = await checkLink(p.link);
        if (ok) papers.push({ ...p, verified: true, scrapedAt: new Date().toISOString() });
    }

    log(`[Papers] ✓ ${code} ${session} (${extype}) -> ${papers.length} link(s)`);
    return papers;
}

async function crawlQuestionPapers(codes = [], options = {}) {
    const log = options.log || (msg => console.log(msg));
    const currentYear = options.years && options.years.length
        ? options.years
        : Array.from({ length: CURRENT_YEAR - 2018 + 1 }, (_, i) => CURRENT_YEAR - i); // 2018..current
    const maxPerCode = options.limit || null;
    const state = loadCrawlState();
    const force = options.force === true;
    log(`[Papers] Scanning ${codes.length} code(s)${force ? ' (FORCE)' : ' (incremental)'}...`);

    const results = [];
    let newlyScanned = 0;
    for (const code of codes) {
        const extTypes = pickExType(code, options.exTypesOverride);
        let codeCount = 0;
        for (const extype of extTypes) {
            log(`[Papers] Scanning ${code} as ${extype}...`);
            for (const year of currentYear) {
                for (const session of getSessionsForYear(year)) {
                    if (!force && isPapersScanned(state, code, session, extype, force)) {
                        continue;
                    }
                    try {
                        const found = await searchQuestionPapersForCode(code, session, extype, options);
                        results.push(...found);
                        codeCount += found.length;
                        markPapersScanned(state, code, session, extype, force);
                        newlyScanned++;
                        if (maxPerCode && codeCount >= maxPerCode) {
                            saveCrawlState(state);
                            if (options.save !== false) {
                                fs.mkdirSync(DATA_DIR, { recursive: true });
                                fs.writeFileSync(CRAWLED_PAPERS_FILE, JSON.stringify(results, null, 2));
                                log(`[Papers] Verified ${results.length} papers -> ${CRAWLED_PAPERS_FILE}`);
                            }
                            return results;
                        }
                    } catch (e) {
                        log(`[Papers] ✗ ${code} ${session} (${extype}): ${e.message}`);
                    }
                    if (options.delay) await new Promise(r => setTimeout(r, options.delay));
                }
            }
            if (codeCount > 0) break;
        }
    }

    saveCrawlState(state);
    if (newlyScanned > 0) log(`[Papers] Scanned ${newlyScanned} new session(s)`);

    if (options.save !== false) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CRAWLED_PAPERS_FILE, JSON.stringify(results, null, 2));
        log(`[Papers] Verified ${results.length} papers -> ${CRAWLED_PAPERS_FILE}`);
    }
    return results;
}

// ========================================================
// 4. KNOWLEDGE BASE / DB HELPERS
// ========================================================
function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) throw new Error('Database not found at ' + DB_FILE);
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDatabase(db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_BACKUP_FILE, fs.readFileSync(DB_FILE));
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ========================================================
// INCREMENTAL CRAWL STATE
// Tracks what has already been crawled so re-crawls only
// fetch NEW subject codes / sessions / notices.
// ========================================================
function loadCrawlState() {
    if (fs.existsSync(CRAWL_STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CRAWL_STATE_FILE, 'utf8'));
        } catch (e) {
            // fall through -> fresh state
        }
    }
    return { papersScanned: {}, syllabusScanned: {}, noticesScanned: {}, updatedAt: null };
}

function saveCrawlState(state) {
    state.updatedAt = new Date().toISOString();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CRAWL_STATE_FILE, JSON.stringify(state, null, 2));
}

function markPapersScanned(state, code, session, extype, force) {
    if (force) return;
    state.papersScanned[`${code}|${session}|${extype}`] = new Date().toISOString();
}

function isPapersScanned(state, code, session, extype, force) {
    if (force) return false;
    return !!state.papersScanned[`${code}|${session}|${extype}`];
}

function markSyllabusScanned(state, code, force) {
    if (force) return;
    state.syllabusScanned[String(code)] = new Date().toISOString();
}

function isSyllabusScanned(state, code, force) {
    if (force) return false;
    return !!state.syllabusScanned[String(code)];
}

function hasSyllabusInDb(index, code) {
    const contexts = index.get(String(code));
    if (!contexts) return true; // not in DB -> nothing to crawl for
    return contexts.every(ctx => (ctx.sub.materials || []).some(m => m.type === 'syllabus'));
}

function collectSubjectCodes(db, opts = {}) {
    const seen = new Set();
    const codes = [];
    for (const unv of db.universities || []) {
        for (const domain of unv.domains || []) {
            for (const branch of domain.branches || []) {
                for (const sem of branch.semesters || []) {
                    for (const sub of sem.subjects || []) {
                        if (sub.code && !seen.has(String(sub.code))) {
                            seen.add(String(sub.code));
                            codes.push(sub.code);
                        }
                    }
                }
            }
        }
    }
    return opts.limit ? codes.slice(0, opts.limit) : codes;
}

// ========================================================
// 5. NON-DESTRUCTIVE MERGE
// ========================================================
function buildSubjectIndex(db) {
    const index = new Map();
    for (const unv of db.universities || []) {
        for (const domain of unv.domains || []) {
            for (const branch of domain.branches || []) {
                for (const sem of branch.semesters || []) {
                    for (const sub of sem.subjects || []) {
                        if (!sub.code) continue;
                        const key = String(sub.code);
                        if (!index.has(key)) index.set(key, []);
                        index.get(key).push({ unv, domain, branch, sem, sub });
                    }
                }
            }
        }
    }
    return index;
}

function mergeIntoDatabase(crawledPapers = [], crawledSyllabus = [], options = {}) {
    const log = options.log || (msg => console.log(msg));
    const db = loadDatabase();

    let papersAdded = 0;
    let papersSkipped = 0;
    let syllabusAdded = 0;
    let syllabusSkipped = 0;
    let creditsUpdated = 0;

    const index = buildSubjectIndex(db);

    for (const paper of crawledPapers) {
        const contexts = index.get(String(paper.subjectCode));
        if (!contexts) {
            papersSkipped++;
            continue;
        }
        const shortLabel = getLabelFromSession(paper.session).replace(' Exam Paper', '').toLowerCase();
        let anyTargeted = false;
        for (const ctx of contexts) {
            if (!ctx.sub.materials) ctx.sub.materials = [];
            const exists = ctx.sub.materials.some(m => m.type === 'paper' &&
                (m.link === paper.link || (m.label && m.label.toLowerCase().includes(shortLabel))));
            if (exists) {
                papersSkipped++;
            } else {
                ctx.sub.materials.push({
                    type: 'paper',
                    label: getLabelFromSession(paper.session),
                    link: paper.link,
                    year: paper.year || 'all'
                });
                papersAdded++;
                anyTargeted = true;
            }
        }
        if (anyTargeted) log(`[Merge] + Paper ${paper.subjectCode}: ${getLabelFromSession(paper.session)}`);
    }

    for (const item of crawledSyllabus) {
        if (!item.code) { syllabusSkipped++; continue; }
        const contexts = index.get(String(item.code));
        if (!contexts) {
            syllabusSkipped++;
            continue;
        }
        for (const ctx of contexts) {
            if (!ctx.sub.materials) ctx.sub.materials = [];

            const programYears = programYearsFor(ctx.branch);
            const years = academicYearsFor(item.effectiveFrom, programYears);

            const existing = ctx.sub.materials.find(m => m.type === 'syllabus');
            const base = {
                type: 'syllabus',
                label: 'Syllabus',
                link: item.link,
                year: years ? `all` : 'all'
            };
            if (item.effectiveFrom) base.effectiveFrom = String(item.effectiveFrom);
            if (years && years.length) {
                base.academicYears = years;
                base.year = `${years[0]}-${years[years.length - 1]}`;
            }
            if (item.semYear) base.semYear = String(item.semYear);

            if (!existing) {
                if (item.link) {
                    ctx.sub.materials.push(base);
                    syllabusAdded++;
                    log(`[Merge] + Syllabus for ${item.code}` + (years ? ` (${years[0]}-${years[years.length - 1]})` : ''));
                }
            } else {
                // Upgrade a previously-merged "all" syllabus with academic years when newly available
                let upgraded = false;
                if (!existing.effectiveFrom && item.effectiveFrom) {
                    existing.effectiveFrom = String(item.effectiveFrom);
                    upgraded = true;
                }
                if ((!existing.academicYears || !existing.academicYears.length) && years && years.length) {
                    existing.academicYears = years;
                    existing.year = `${years[0]}-${years[years.length - 1]}`;
                    upgraded = true;
                }
                if (item.semYear && !existing.semYear) {
                    existing.semYear = String(item.semYear);
                }
                if (!existing.link) existing.link = item.link;
                if (upgraded) {
                    syllabusAdded++;
                    log(`[Merge] ~ Syllabus for ${item.code} updated to ${existing.year}`);
                } else {
                    syllabusSkipped++;
                }
            }

            if (item.credit && (!ctx.sub.credit || ctx.sub.credit === 0)) {
                ctx.sub.credit = item.credit;
                creditsUpdated++;
            }
        }
    }

    saveDatabase(db);
    log(`[Merge] DB updated. Papers: +${papersAdded}, skipped ${papersSkipped}. ` +
        `Syllabus: +${syllabusAdded}, skipped ${syllabusSkipped}. Credits updated: ${creditsUpdated}.`);
    return { papersAdded, papersSkipped, syllabusAdded, syllabusSkipped, creditsUpdated };
}

// ========================================================
// SYLLABUS YEAR BACKFILL
// Reads previously-crawled gtu_full_subjects.json (which has
// effFrom per code) and stamps syllabus materials in the DB
// with effectiveFrom / academicYears without re-crawling.
// ========================================================
function backfillSyllabusYearsFromCrawl(options = {}) {
    const log = options.log || (msg => console.log(msg));
    const CRAWLED_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');
    if (!fs.existsSync(CRAWLED_FILE)) {
        log('[Backfill] No gtu_full_subjects.json found - skipping');
        return { updatedSubjects: 0 };
    }

    const crawled = JSON.parse(fs.readFileSync(CRAWLED_FILE, 'utf8'));
    const effByCode = new Map();
    const scan = (container) => {
        for (const [branchCode, semesters] of Object.entries(container || {})) {
            for (const [sem, subjects] of Object.entries(semesters || {})) {
                for (const sub of subjects || []) {
                    if (sub.code && sub.effFrom && !effByCode.has(String(sub.code))) {
                        effByCode.set(String(sub.code), sub);
                    }
                }
            }
        }
    };
    scan(crawled.DI);
    scan(crawled.BE);
    scan(crawled.ME);

    const db = loadDatabase();
    let updatedSubjects = 0;
    for (const unv of db.universities || []) {
        for (const domain of unv.domains || []) {
            for (const branch of domain.branches || []) {
                const programYears = programYearsFor(branch);
                for (const sem of branch.semesters || []) {
                    for (const sub of sem.subjects || []) {
                        if (!sub.materials) continue;
                        const eff = effByCode.get(String(sub.code));
                        const syllabus = sub.materials.find(m => m.type === 'syllabus');
                        if (!syllabus) continue;
                        const effFrom = eff && eff.effFrom ? String(eff.effFrom) : syllabus.effectiveFrom;
                        const years = effFrom ? academicYearsFor(effFrom, programYears) : null;
                        let changed = false;
                        if (effFrom && !syllabus.effectiveFrom) {
                            syllabus.effectiveFrom = effFrom;
                            changed = true;
                        }
                        if (years && years.length && (!syllabus.academicYears || !syllabus.academicYears.length)) {
                            syllabus.academicYears = years;
                            syllabus.year = `${years[0]}-${years[years.length - 1]}`;
                            changed = true;
                        }
                        if (changed) updatedSubjects++;
                    }
                }
            }
        }
    }

    saveDatabase(db);
    log(`[Backfill] Updated syllabus years for ${updatedSubjects} subject(s) from gtu_full_subjects.json`);
    return { updatedSubjects };
}

// ========================================================
// RUNNERS (used by server endpoints)
// ========================================================
async function runNotices(opts = {}) {
    return await crawlCirculars(opts);
}

async function runSyllabus(opts = {}) {
    const db = opts.db || loadDatabase();
    let codes = opts.subjectCodes || [];
    if (codes.length === 0) codes = collectSubjectCodes(db, opts);
    return await crawlSyllabus(codes, opts);
}

async function runPapers(opts = {}) {
    const db = opts.db || loadDatabase();
    let codes = opts.subjectCodes || [];
    if (codes.length === 0) codes = collectSubjectCodes(db, opts);
    return await crawlQuestionPapers(codes, opts);
}

async function runSync(opts = {}) {
    const log = opts.log || (msg => console.log(msg));
    log('=== GTU SYNC START ===');

    let notices = [];
    if (!opts.skipNotices) {
        try {
            notices = await crawlCirculars({ ...opts, limit: opts.noticesLimit || 50 });
        } catch (e) {
            log(`[Sync] Circulars skipped: ${e.message}`);
        }
    }

    let db = loadDatabase();
    const codes = collectSubjectCodes(db, { ...opts, limit: opts.subjectLimit || null });

    let syllabus = [];
    if (!opts.skipSyllabus) {
        try {
            syllabus = await crawlSyllabus(codes, { ...opts, limit: opts.syllabusLimit || null });
        } catch (e) {
            log(`[Sync] Syllabus skipped: ${e.message}`);
        }
    }

    // Stamp academic years from already-crawled syllabus artifacts when years exist there
    try {
        const backfill = backfillSyllabusYearsFromCrawl({ log });
        if (backfill.updatedSubjects > 0) log(`[Sync] Backfilled ${backfill.updatedSubjects} subject(s) with syllabus academic years`);
    } catch (e) {
        log(`[Sync] Backfill skipped: ${e.message}`);
    }

    let papers = [];
    if (!opts.skipPapers) {
        try {
            papers = await crawlQuestionPapers(codes, { ...opts, limit: opts.paperLimit || null, db });
        } catch (e) {
            log(`[Sync] Papers skipped: ${e.message}`);
        }
    }

    let mergeResult = {};
    if (papers.length || syllabus.length) {
        mergeResult = mergeIntoDatabase(papers, syllabus, opts);
    } else {
        log('[Sync] Nothing to merge (no papers/syllabus fetched).');
    }

    log('=== GTU SYNC COMPLETE ===');
    return { notices: notices.length, syllabus: syllabus.length, papers: papers.length, ...mergeResult };
}

// ========================================================
// CLI
// ========================================================
const HELP = `
GTU Crawler & Data Aggregator

Usage:
  node scripts/crawler/gtu_crawler.js --notices [--limit 20]
  node scripts/crawler/gtu_crawler.js --syllabus [--limit 5]
  node scripts/crawler/gtu_crawler.js --syllabus --subject-codes 4300001,4330701
  node scripts/crawler/gtu_crawler.js --papers [--limit 5]
  node scripts/crawler/gtu_crawler.js --papers --subject-codes 4300001 --years 2024,2023
  node scripts/crawler/gtu_crawler.js --sync
  node scripts/crawler/gtu_crawler.js --sync --skip-notices --paper-limit 20
  node scripts/crawler/gtu_crawler.js --sync --force              # re-crawl everything
`;

async function main() {
    const args = process.argv.slice(2);
    const opts = {};

    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--notices') opts.mode = 'notices';
        else if (a === '--syllabus') opts.mode = 'syllabus';
        else if (a === '--papers') opts.mode = 'papers';
        else if (a === '--sync') opts.mode = 'sync';
        else if (a === '--help' || a === '-h') { console.log(HELP); return; }
        else if (a === '--limit') opts.limit = parseInt(args[++i], 10);
        else if (a === '--paper-limit') opts.paperLimit = parseInt(args[++i], 10);
        else if (a === '--notices-limit') opts.noticesLimit = parseInt(args[++i], 10);
        else if (a === '--syllabus-limit') opts.syllabusLimit = parseInt(args[++i], 10);
        else if (a === '--subject-limit') opts.subjectLimit = parseInt(args[++i], 10);
        else if (a === '--years') opts.years = args[++i].split(',').map(Number);
        else if (a === '--subject-codes') opts.subjectCodes = args[++i].split(',').map(c => c.trim());
        else if (a === '--extypes') opts.exTypesOverride = args[++i].split(',').map(c => c.trim());
        else if (a === '--skip-notices') opts.skipNotices = true;
        else if (a === '--skip-syllabus') opts.skipSyllabus = true;
        else if (a === '--skip-papers') opts.skipPapers = true;
        else if (a === '--force') opts.force = true;
        else if (a === '--delay') opts.delay = parseInt(args[++i], 10);
    }

    if (!opts.mode) { console.log(HELP); return; }

    if (opts.mode === 'notices') {
        await runNotices({ limit: opts.limit || 50 });
    } else if (opts.mode === 'syllabus') {
        await runSyllabus({ ...opts, limit: opts.limit || null });
    } else if (opts.mode === 'papers') {
        await runPapers({ ...opts, limit: opts.limit || null });
    } else if (opts.mode === 'sync') {
        await runSync(opts);
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('[FATAL]', err.message);
        process.exit(1);
    });
}

module.exports = {
    crawlCirculars,
    crawlSyllabus,
    crawlSyllabusByCode,
    crawlQuestionPapers,
    searchQuestionPapersForCode,
    mergeIntoDatabase,
    getLabelFromSession,
    pickExType,
    parseEffectiveYear,
    academicYearsFor,
    programYearsFor,
    loadCrawlState,
    saveCrawlState,
    backfillSyllabusYearsFromCrawl,
    runNotices,
    runSyllabus,
    runPapers,
    runSync,
    loadDatabase,
    saveDatabase,
    collectSubjectCodes,
    fetchHTML,
    postForm,
    checkLink,
    extractDateFromString
};