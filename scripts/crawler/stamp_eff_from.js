/**
 * Effective-From Backfill
 *
 * Copies GTU's "effective from" academic year onto the subject records that the
 * sync already placed correctly, so a page can state which intake its curriculum
 * belongs to without being re-crawled.
 *
 * The year is looked up per (branch, semester, code) triple rather than per code:
 * 133 diploma codes are offered with two different effective years depending on
 * the branch, so a code-only lookup would put the wrong year on half the pages.
 *
 * Nothing else is touched -- no titles, no materials, no placements.
 *
 * Usage:
 *   node scripts/crawler/stamp_eff_from.js --dry-run
 *   node scripts/crawler/stamp_eff_from.js
 *   node scripts/crawler/stamp_eff_from.js --courses DI --years 2021-2026
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const CRAWLED_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');

const DRY_RUN = process.argv.includes('--dry-run');
const COURSE_BY_DOMAIN = { be: 'BE', diploma: 'DI', me: 'ME' };

const COURSE_FILTER = (() => {
    const i = process.argv.indexOf('--courses');
    if (i === -1 || !process.argv[i + 1]) return null;
    const wanted = process.argv[i + 1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    return wanted.length ? new Set(wanted) : null;
})();

const YEAR_RANGE = (() => {
    const i = process.argv.indexOf('--years');
    if (i === -1 || !process.argv[i + 1]) return null;
    const m = String(process.argv[i + 1]).match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (!m) { console.error(`--years expects a range like 2021-2026, got "${process.argv[i + 1]}"`); process.exit(1); }
    return { from: parseInt(m[1], 10), to: parseInt(m[2], 10) };
})();

// Branch ids in the DB are slugs; the crawl is keyed by GTU branch code. The
// mapping has to come from the same name match the sync uses, so import it rather
// than reimplementing it and letting the two drift.
const { resolveDbBranchCodes, buildGtuBranchNameLookup } = require('./branch_map');

function semNumber(semId) {
    return parseInt(String(semId || '').replace(/\D/g, ''), 10);
}

// "course|gtuBranchCode|sem|code" -> effectiveFrom
function buildLookup(crawled) {
    const lookup = new Map();
    for (const [course, branches] of Object.entries(crawled)) {
        if (COURSE_FILTER && !COURSE_FILTER.has(course)) continue;
        for (const [branchCode, sems] of Object.entries(branches)) {
            for (const [sem, subs] of Object.entries(sems)) {
                for (const s of subs) {
                    if (!s.code) continue;
                    lookup.set(`${course}|${branchCode}|${parseInt(sem, 10)}|${s.code}`, (s.effFrom || '').trim());
                }
            }
        }
    }
    return lookup;
}

function inYears(effFrom) {
    if (!YEAR_RANGE) return true;
    const m = String(effFrom).match(/\d{4}/);
    if (!m) return false;
    const y = parseInt(m[0], 10);
    return y >= YEAR_RANGE.from && y <= YEAR_RANGE.to;
}

function main() {
    if (!fs.existsSync(DB_FILE)) { console.error('DB not found'); process.exit(1); }
    if (!fs.existsSync(CRAWLED_FILE)) { console.error('Crawled data not found. Run gtu_full_crawl.js first.'); process.exit(1); }

    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const crawled = JSON.parse(fs.readFileSync(CRAWLED_FILE, 'utf8'));
    const programs = fs.existsSync(path.join(DATA_DIR, 'gtu_programs_branches.json'))
        ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gtu_programs_branches.json'), 'utf8'))
        : { programs: {} };
    const nameLookup = buildGtuBranchNameLookup(programs);

    const gtuUnv = db.universities.find(u => u.id === 'gtu');
    if (!gtuUnv) { console.error('No GTU university in DB'); process.exit(1); }

    const lookup = buildLookup(crawled);
    let stamped = 0, already = 0, unmatched = 0, outOfScope = 0;
    const unmappedBranches = [];

    for (const domain of gtuUnv.domains) {
        const course = COURSE_BY_DOMAIN[domain.id];
        if (!course) continue;
        if (COURSE_FILTER && !COURSE_FILTER.has(course)) continue;
        const dbCodes = resolveDbBranchCodes(domain, course, nameLookup);

        for (const branch of domain.branches) {
            const gtuCode = dbCodes.get(branch.id);
            if (gtuCode === null || gtuCode === undefined) {
                if (!unmappedBranches.includes(branch.id)) unmappedBranches.push(branch.id);
                continue;
            }
            for (const sem of branch.semesters) {
                const semNo = semNumber(sem.id);
                for (const sub of sem.subjects) {
                    const effFrom = lookup.get(`${course}|${gtuCode}|${semNo}|${sub.code}`);
                    if (effFrom === undefined) { unmatched++; continue; }
                    if (!inYears(effFrom)) { outOfScope++; continue; }
                    if (sub.effFrom === effFrom) { already++; continue; }
                    sub.effFrom = effFrom;
                    stamped++;
                }
            }
        }
    }

    console.log('\n=== EFFECTIVE-FROM BACKFILL ===');
    console.log(`Stamped: ${stamped}`);
    console.log(`Already correct: ${already}`);
    console.log(`No GTU record for this branch/semester/code (left alone): ${unmatched}`);
    console.log(`Outside the requested intake range (left alone): ${outOfScope}`);
    if (unmappedBranches.length) {
        console.log(`Branches with no GTU counterpart, skipped: ${unmappedBranches.join(', ')}`);
    }

    if (!DRY_RUN) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('Database saved!');
    } else {
        console.log('(DRY RUN - not saved)');
    }
}

main();