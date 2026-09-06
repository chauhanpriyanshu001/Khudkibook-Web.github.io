/**
 * GTU Full Syllabus Crawler - Optimized
 * Crawls ALL subject listings across ALL GTU programs by querying the official GTU syllabus page.
 * 
 * Output: public/data/gtu_full_subjects.json
 * 
 * Usage:
 *   node scripts/crawler/gtu_full_crawl.js                       # crawl BE, DI, ME
 *   node scripts/crawler/gtu_full_crawl.js --courses BE          # crawl only BE
 *   node scripts/crawler/gtu_full_crawl.js --resume              # resume from last checkpoint
 *   node scripts/crawler/gtu_full_crawl.js --limit 20            # stop after 20 combos
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const DATA_DIR = path.join(__dirname, '../../data');
const PROGRAMS_FILE = path.join(DATA_DIR, 'gtu_programs_branches.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'gtu_full_crawl_progress.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');
const SYLLABUS_PAGE = 'https://gtu.ac.in/Syllabus/Syllabus.aspx';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';

const CODE_RE = /^([A-Z]{0,4}\d{7,8})$/;
const SKIP_BRANCHES = new Set(['AA','AB','AC','AD','AE','AF','AG','AH','AI','AJ','AK','AL','AM','AN','AO','AP','AQ','AR','AS','AT','AU','AV','IAA','IAN','IAO','IAP','IAQ','IAR','IAS','IAT','IAU','IAV','NA','NB','NC']);
const DUPLICATE_BRANCHES = { '89': '19' };
let DELAY_MS = 400;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg) { console.log(msg); }

async function fetchHTML(url) {
    const res = await fetch(url, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(25000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
}

function buildFormBody($) {
    const body = new URLSearchParams();
    $('input[type="hidden"]').each((i, el) => {
        const name = $(el).attr('name');
        const value = $(el).attr('value') || '';
        if (name && !body.has(name)) body.set(name, value);
    });
    $('select').each((i, el) => {
        const name = $(el).attr('name');
        if (!name || body.has(name)) return;
        body.set(name, '');
    });
    return body;
}

async function postPage(body) {
    const res = await fetch(SYLLABUS_PAGE, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'https://gtu.ac.in', 'Referer': SYLLABUS_PAGE },
        body: body.toString(),
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`POST ${res.status}`);
    return await res.text();
}

function parseGrid(html) {
    const $ = cheerio.load(html);
    const tbl = $('#ContentPlaceHolder1_GridViewToCategory');
    if (!tbl.length) return [];
    const subs = [];
    tbl.find('tr').each((i, tr) => {
        const cells = $(tr).find('td,th').map((j, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
        if (cells.length < 13) return;
        let codeIdx = -1;
        for (let j = 0; j < cells.length; j++) {
            if (CODE_RE.test(cells[j])) { codeIdx = j; break; }
        }
        if (codeIdx === -1) return;
        const code = cells[codeIdx];
        const branchRaw = cells[codeIdx + 1] || '';
        const effFrom = cells[codeIdx + 2] || '';
        const name = cells[codeIdx + 3] || '';
        const category = cells[codeIdx + 4] || '';
        const sem = cells[codeIdx + 5] || '';
        const l = cells[codeIdx + 6] || '';
        const t = cells[codeIdx + 7] || '';
        const p = cells[codeIdx + 8] || '';
        const pbl = cells[codeIdx + 9] || '';
        const credit = parseFloat((cells[codeIdx + 10] || '').replace(/,/g, '')) || 0;
        const em = cells[codeIdx + 11] || '';
        const iv = cells[codeIdx + 13] || '';
        const total = cells[codeIdx + 15] || '';
        subs.push({ code, name, category, sem, effFrom, ltpPBL: `${l}/${t}/${p}/${pbl}`, credit, em, iv, total, branchCode: branchRaw });
    });
    const seen = new Set();
    return subs.filter(s => {
        if (!s.code || !s.name) return false;
        const k = s.code + '|' + s.sem + '|' + s.branchCode;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    return { completed: [], results: {} };
}

function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function writeMergedOutput(progress) {
    // Merge with any previously-crawled courses (preserve data across separate course runs)
    let combined = {};
    if (fs.existsSync(OUTPUT_FILE)) {
        try { combined = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); } catch (e) { combined = {}; }
    }
    for (const [course, branches] of Object.entries(progress.results)) {
        combined[course] = branches;
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(combined, null, 2));
}

async function main() {
    const args = process.argv.slice(2);
    let targetCourses = ['BE', 'DI', 'ME'];
    let resume = false;
    let limit = Infinity;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--courses') targetCourses = args[++i].split(',');
        else if (args[i] === '--resume') resume = true;
        else if (args[i] === '--limit') limit = parseInt(args[++i], 10);
        else if (args[i] === '--delay') DELAY_MS = parseInt(args[++i], 10);
    }

    const programs = JSON.parse(fs.readFileSync(PROGRAMS_FILE, 'utf8')).programs;
    const progress = resume ? loadProgress() : { completed: [], results: {} };
    const completedSet = new Set(progress.completed);

    // Count total combos
    let totalCombos = 0;
    for (const course of targetCourses) {
        const prog = programs[course];
        if (!prog || !prog.branches) continue;
        for (const br of prog.branches) {
            if (SKIP_BRANCHES.has(br.code) || DUPLICATE_BRANCHES[br.code]) continue;
            const sems = (prog.sems || []).filter(s => s !== 'Sem');
            totalCombos += sems.length;
        }
    }

    log(`\n=== GTU FULL SYLLABUS CRAWL ===`);
    log(`Courses: ${targetCourses.join(', ')}`);
    log(`Total combos: ${totalCombos} (skip: ${completedSet.size} done, limit: ${limit === Infinity ? 'none' : limit})`);
    log(`\n`);

    let doneCombos = 0, totalSubjects = 0, startTs = Date.now();

    for (const course of targetCourses) {
        const prog = programs[course];
        if (!prog || !prog.branches) continue;

        log(`\n--- COURSE ${course} ---`);

        // Step 1: Course selection postback (once per course)
        const html0 = await fetchHTML(SYLLABUS_PAGE);
        let $ = cheerio.load(html0);
        let courseHtml = await postPage((() => {
            const body = buildFormBody($);
            body.set('__EVENTTARGET', 'ctl00$ContentPlaceHolder1$ddcourse');
            body.set('ctl00$ContentPlaceHolder1$ddcourse', course);
            return body;
        })());
        let lastFormHtml = courseHtml;

        for (const br of prog.branches) {
            if (SKIP_BRANCHES.has(br.code)) continue;
            if (limit <= doneCombos) break;
            const actualBranch = DUPLICATE_BRANCHES[br.code] || br.code;
            const sems = (prog.sems || []).filter(s => s !== 'Sem');

            for (const sem of sems) {
                if (limit <= doneCombos) break;
                const key = `${course}|${actualBranch}|${sem}`;

                if (completedSet.has(key)) {
                    doneCombos++;
                    continue;
                }

                doneCombos++;
                const elapsed = ((Date.now() - startTs) / 1000).toFixed(0);
                const rate = doneCombos > 0 ? (doneCombos / (Date.now() - startTs) * 1000).toFixed(1) : 0;
                process.stdout.write(`[${doneCombos}/${totalCombos}] [${elapsed}s @${rate}/s] ${course}/${br.code}/sem${sem}... `);

                try {
                    $ = cheerio.load(lastFormHtml);
                    const body = buildFormBody($);
                    body.set('ctl00$ContentPlaceHolder1$ddcourse', course);
                    body.set('ctl00$ContentPlaceHolder1$ddlbrcode', actualBranch);
                    body.set('ctl00$ContentPlaceHolder1$ddsem', String(sem));
                    body.set('ctl00$ContentPlaceHolder1$ddl_effFrom', '');
                    body.set('ctl00$ContentPlaceHolder1$ddl_iselective', '');
                    body.set('ctl00$ContentPlaceHolder1$btn_search', 'Search');

                    const searchHtml = await postPage(body);
                    const subs = parseGrid(searchHtml);
                    lastFormHtml = searchHtml;

                    if (!progress.results[course]) progress.results[course] = {};
                    if (!progress.results[course][actualBranch]) progress.results[course][actualBranch] = {};
                    progress.results[course][actualBranch][sem] = subs;
                    totalSubjects += subs.length;
                    progress.completed.push(key);
                    completedSet.add(key);
                    console.log(`${subs.length} subjects`);
                } catch (e) {
                    log(`ERROR: ${e.message}`);
                    progress.completed.push(key);
                    completedSet.add(key);
                }

                if (doneCombos % 20 === 0) {
                    saveProgress(progress);
                    writeMergedOutput(progress);
                }
                await delay(DELAY_MS);
            }
        }
    }

    saveProgress(progress);
    writeMergedOutput(progress);
    const totalSec = ((Date.now() - startTs) / 1000).toFixed(0);
    log(`\n=== DONE in ${totalSec}s ===`);
    log(`Combos: ${doneCombos}, Subjects: ${totalSubjects}`);
    log(`Output: ${OUTPUT_FILE}`);
}

main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });