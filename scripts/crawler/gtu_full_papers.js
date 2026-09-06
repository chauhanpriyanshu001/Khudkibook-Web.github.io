#!/usr/bin/env node
/**
 * Full question-papers crawl for the expanded GTU DB.
 *
 * Queries GTU's Download1.aspx per subject code for exam sessions in a
 * chosen year range (default 2021..2026), collects paper links with
 * verification disabled (speed), saves them to a checkpoint file, and
 * merges them into site_db.json via mergeIntoDatabase.
 *
 * Resumable: --resume continues from the checkpoint file, skipping codes
 * that were already queried (or already have recent papers in the DB).
 *
 * Usage:
 *   node scripts/crawler/gtu_full_papers.js [--years 2021-2026] [--resume] [--delay 300] [--dry-run]
 */
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');

const GTU_BASE = 'https://gtu.ac.in';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const DB_BACKUP_FILE = path.join(DATA_DIR, 'site_db_backup.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'gtu_full_papers_progress.json');

const crawler = require(path.join(__dirname, 'gtu_crawler.js'));
const { mergeIntoDatabase, loadDatabase } = crawler;

function parseArgs(argv) {
    const opts = {
        years: null,
        resume: false,
        delay: 300,
        dryRun: false,
        log: (m) => console.log(m)
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--years') opts.years = String(argv[++i]).split(',').map(s => s.trim()).filter(Boolean);
        else if (a === '--resume') opts.resume = true;
        else if (a === '--delay') opts.delay = parseInt(argv[++i], 10) || 0;
        else if (a === '--dry-run') opts.dryRun = true;
        else if (a === '--max') opts.max = parseInt(argv[++i], 10) || 0;
    }
    if (!opts.years) {
        const years = [];
        for (let y = 2021; y <= 2026; y++) years.push(String(y));
        opts.years = years;
    }
    return opts;
}

function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8')); } catch (e) { return {}; }
    }
    return {};
}

function saveProgress(progress) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function getSessionsForYear(year) {
    return [`S${year}`, `W${year}`];
}

// Optimized: one GET per code (for hidden form fields), reused across all
// sessions, then a single POST per session. Halves request count vs the
// default searchQuestionPapersForCode which GETs before every POST.
async function searchCodeSessions(code, extype, sessions, opts = {}) {
    const log = opts.log || (() => {});
    const html = await crawler.fetchHTML(GTU_BASE + '/Download1.aspx', { retries: 1, timeoutMs: 30000 });
    if (html.status !== 200 || !html.body) throw new Error(`GET Download1.aspx -> ${html.status}`);

    const $ = cheerio.load(html.body);
    const baseBody = new URLSearchParams();
    $('input[type="hidden"]').each((i, el) => {
        const name = $(el).attr('name');
        const value = $(el).attr('value') || '';
        if (name && !baseBody.has(name)) baseBody.set(name, value);
    });

    const paperUrlRe = /\/uploads\/([A-Z]\d{4})\/([A-Z]{1,4})\/([A-Z]?\d{7})\.pdf$/i;
    const found = [];
    const seen = new Set();

    for (const session of sessions) {
        const body = new URLSearchParams(baseBody);
        for (const [k, v] of Object.entries({
            'ctl00$ContentPlaceHolder1$ddlsession': session,
            'ctl00$ContentPlaceHolder1$drpextype': extype,
            'ctl00$ContentPlaceHolder1$txtsearch': String(code)
        })) body.set(k, v);
        body.set('ctl00$ContentPlaceHolder1$btnsearch', 'Search');

        let res;
        try {
            res = await fetch(GTU_BASE + '/Download1.aspx', {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'User-Agent': UA,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': GTU_BASE,
                    'Referer': GTU_BASE + '/Download1.aspx',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                body: body.toString()
            });
        } catch (e) {
            log(`  ✗ ${code} ${session}: ${e.message}`);
            continue;
        }
        if (!res.ok) { log(`  ✗ ${code} ${session}: HTTP ${res.status}`); continue; }
        const respHtml = await res.text();
        const $r = cheerio.load(respHtml);
        const wanted = String(session).toUpperCase();
        $r('a[href*="uploads"]').each((i, el) => {
            let href = $r(el).attr('href') || '';
            if (!/^https?:\/\//i.test(href)) {
                href = href.startsWith('//') ? `https:${href}` : `${GTU_BASE}/${href.replace(/^\/+/, '')}`;
            }
            const m = href.match(paperUrlRe);
            if (!m) return;
            if (m[1].toUpperCase() !== wanted) return;
            if (seen.has(href)) return;
            seen.add(href);
            found.push({
                subjectCode: String(code),
                session,
                extype,
                year: String(session).replace(/^[SW]/i, ''),
                label: ((session.startsWith('W')) ? 'Winter' : 'Summer') + ' ' + String(session).replace(/^[SW]/i, '') + ' Exam Paper',
                link: href,
                type: 'paper'
            });
        });
        if (opts.delay) await new Promise(r => setTimeout(r, opts.delay));
    }
    return found;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const log = opts.log;

    const db = loadDatabase();
    const progress = opts.resume ? loadProgress() : { queried: {}, papersByCode: {} };

    // On resume, re-merge any papers collected by a prior (possibly killed)
    // run that weren't flushed to the DB yet. Idempotent via exists checks.
    if (opts.resume && !opts.dryRun && Object.keys(progress.papersByCode || {}).length) {
        const backlog = [];
        for (const arr of Object.values(progress.papersByCode)) backlog.push(...arr);
        if (backlog.length) {
            log(`[resume] Re-merging ${backlog.length} collected papers into DB...`);
            mergeIntoDatabase(backlog, [], { log });
        }
    }

    // Build bare-code -> extype map from the DB (use first domain seen).
    const codeExtype = new Map();
    for (const unv of db.universities || []) {
        for (const domain of unv.domains || []) {
            const extype = domain.id === 'me' ? 'ME' : (domain.id === 'be' ? 'BE' : 'DI');
            for (const branch of domain.branches || []) {
                for (const sem of branch.semesters || []) {
                    for (const sub of sem.subjects || []) {
                        if (!sub.code) continue;
                        const cc = String(sub.code);
                        // Only classic 7-digit codes have hosted question papers on
                        // GTU's uploads endpoint (new prefixed codes return 404).
                        if (!/^\d{7}$/.test(cc)) continue;
                        if (!codeExtype.has(cc)) codeExtype.set(cc, extype);
                    }
                }
            }
        }
    }

    // Collect codes that still need querying.
    let todo = [];
    for (const [code, extype] of codeExtype) {
        if (progress.queried[code]) continue;
        todo.push({ code, extype });
    }
    if (opts.max) todo = todo.slice(0, opts.max);

    log(`Sessions: ${opts.years.flatMap(getSessionsForYear).join(', ')}`);
    log(`Total unique codes: ${codeExtype.size}; already queried: ${Object.keys(progress.queried).length}; to do: ${todo.length}`);
    log(`verify=false, delay=${opts.delay}ms, dryRun=${opts.dryRun}`);

    const sessions = opts.years.flatMap(getSessionsForYear);
    let done = 0;
    const startTime = Date.now();

    for (const { code, extype } of todo) {
        if (!progress.papersByCode[code]) progress.papersByCode[code] = [];
        try {
            const found = await searchCodeSessions(code, extype, sessions, { delay: opts.delay });
            for (const p of found) {
                const dup = progress.papersByCode[code].some(ex => ex.link === p.link);
                if (!dup) progress.papersByCode[code].push(p);
            }
        } catch (e) {
            log(`  ✗ ${code} (${extype}): ${e.message}`);
        }
        progress.queried[code] = true;
        done++;

        if (done % 50 === 0) {
            saveProgress(progress);
            const elapsedMin = ((Date.now() - startTime) / 60000).toFixed(1);
            const rate = done / (elapsedMin || 0.001);
            const remaining = todo.length - done;
            const etaMin = remaining / (rate || 1);
            log(`[progress] ${done}/${todo.length} codes done (${elapsedMin}min, ~${rate.toFixed(1)}/min, ETA ~${etaMin.toFixed(0)}min)`);
        }

        // Periodically flush collected papers into the DB so partial
        // progress survives an interruption. Idempotent via mergeIntoDatabase.
        if (!opts.dryRun && done % 100 === 0) {
            const flush = [];
            for (const [code, arr] of Object.entries(progress.papersByCode)) flush.push(...arr);
            if (flush.length) {
                log(`[flush] Merging ${flush.length} papers collected so far...`);
                mergeIntoDatabase(flush, [], { log, flushOnly: true });
            }
            saveProgress(progress);
        }
    }

    saveProgress(progress);
    log('\n=== CRAWL DONE ===');
    let total = 0;
    let withPapers = 0;
    for (const [code, arr] of Object.entries(progress.papersByCode)) {
        total += arr.length;
        if (arr.length) withPapers++;
    }
    log(`Codes surveyed: ${done}, codes with papers: ${withPapers}, total paper materials: ${total}`);

    if (!opts.dryRun && total) {
        // Flatten and merge into DB.
        const papers = [];
        for (const arr of Object.values(progress.papersByCode)) papers.push(...arr);
        log(`Merging ${papers.length} paper materials into DB...`);
        const result = mergeIntoDatabase(papers, [], { log });
        log('Merge result:', result);
    } else {
        log('Dry-run or no papers found; DB not modified.');
    }
}

if (require.main === module) {
    main().catch(e => {
        console.error(e);
        process.exit(1);
    });
} else {
    module.exports = { searchCodeSessions, getSessionsForYear };
}
