/**
 * GTU Subject Sync Script
 * Reconciles site_db.json against a fresh GTU full crawl (gtu_full_subjects.json).
 *
 * Strategy (code-level validation — authoritative & safe):
 *
 * A subject's existence on GTU is determined by whether its code appears ANYWHERE
 * in the fresh crawl for the corresponding domain (diploma/be/me). This avoids
 * false removals caused by historical differences in how branches were merged
 * or named between GTU's listing and Khudkibook's DB.
 *
 * 1. REMOVE subjects whose code appears NOWHERE in the crawl for that domain
 *    (stale subjects no longer offered by GTU).
 * 2. ADD subjects from the fresh crawl whose code is missing from the DB.
 *    Each crawl branch is mapped to its best-matching DB branch (max subject-code
 *    overlap) and added into that branch's listed semester.
 * 3. FIX every Google Drive syllabus link -> official GTU S3 syllabus link.
 * 4. Prune empty semesters/branches left behind.
 *
 * Usage:
 *   node scripts/crawler/sync_gtu_subjects.js            # execute (creates backup)
 *   node scripts/crawler/sync_gtu_subjects.js --dry-run  # preview without writing
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const DB_BACKUP = path.join(DATA_DIR, 'site_db_backup.json');
const CRAWLED_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');
const OG_IMAGE = 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';
const SYLLABUS_PREFIX = 'https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/';

const DRY_RUN = process.argv.includes('--dry-run');
const DOMAIN_BY_COURSE = { BE: 'be', DI: 'diploma', ME: 'me' };
const COURSE_BY_DOMAIN = { be: 'BE', diploma: 'DI', me: 'ME' };

// ============================
// Helpers
// ============================
function slugify(name) {
    return name.toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function isElective(sub) {
    const name = (sub.name || '').toLowerCase();
    const cat = (sub.category || '').toLowerCase();
    return name.includes('elective') || cat.includes('elective');
}

function generateSEO(branchName, semName, subjectName, subjectCode, courseType) {
    const courseLabel = courseType === 'DI' ? 'Diploma' : courseType === 'ME' ? 'M.Tech' : 'B.E.';
    return {
        title: `${subjectName} (${subjectCode}) - GTU ${branchName} ${semName} Free Books & Papers | Khudkibook`,
        description: `Download free ${subjectName} study material for GTU ${courseLabel} ${branchName} ${semName}. Get textbooks, question papers, syllabus PDF at Khudkibook.`,
        keywords: `gtu ${subjectName.toLowerCase()}, ${subjectCode}, gtu ${branchName.toLowerCase()} ${semName.toLowerCase()}, ${courseLabel.toLowerCase()} ${branchName.toLowerCase()} books, gtu papers`
    };
}

// ============================
// Build crawl indexes
// ============================
// domain -> Set(all subject codes present in crawl)
function buildCrawlCodeIndex(crawled) {
    const idx = { be: new Set(), diploma: new Set(), me: new Set() };
    for (const [course, branchData] of Object.entries(crawled)) {
        const dId = DOMAIN_BY_COURSE[course];
        if (!dId) continue;
        for (const sems of Object.values(branchData)) {
            for (const subs of Object.values(sems)) {
                for (const s of subs) if (s.code) idx[dId].add(s.code);
            }
        }
    }
    return idx;
}

// domain -> crawlBranchCode -> { semNum -> [subject objects] }
function buildCrawlBranchIndex(crawled) {
    const idx = { be: {}, diploma: {}, me: {} };
    for (const [course, branchData] of Object.entries(crawled)) {
        const dId = DOMAIN_BY_COURSE[course];
        if (!dId) continue;
        for (const [bc, sems] of Object.entries(branchData)) {
            idx[dId][bc] = {};
            for (const [semNum, subs] of Object.entries(sems)) {
                if (subs && subs.length) idx[dId][bc][semNum] = subs;
            }
        }
    }
    return idx;
}

// For each crawl branch in a domain, find the DB branch with max subject-code overlap.
function mapCrawlToDbBranches(dbDomains, crawlBranchIndex) {
    const mappings = { be: {}, diploma: {}, me: {} };
    for (const domain of dbDomains) {
        const domId = domain.id;
        if (!mappings[domId]) continue;
        for (const [bc, sems] of Object.entries(crawlBranchIndex[domId] || {})) {
            const cCodes = new Set(Object.values(sems).flat().map(x => x.code).filter(Boolean));
            if (!cCodes.size) continue;
            let bestBr = null, bestOv = -1;
            for (const br of domain.branches) {
                const dCodes = new Set(br.semesters.flatMap(s => s.subjects.map(x => x.code)));
                let ov = 0;
                for (const c of cCodes) if (dCodes.has(c)) ov++;
                if (ov > bestOv) { bestOv = ov; bestBr = br.id; }
            }
            mappings[domId][bc] = { branchSlug: bestBr, overlap: bestOv, total: cCodes.size };
        }
    }
    return mappings;
}

// ============================
// Main
// ============================
function main() {
    if (!fs.existsSync(DB_FILE)) { console.error('DB not found'); process.exit(1); }
    if (!fs.existsSync(CRAWLED_FILE)) { console.error('Crawled data not found. Run gtu_full_crawl.js first.'); process.exit(1); }

    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const crawled = JSON.parse(fs.readFileSync(CRAWLED_FILE, 'utf8'));

    if (!DRY_RUN) {
        fs.writeFileSync(DB_BACKUP, fs.readFileSync(DB_FILE));
        console.log('Backup saved to site_db_backup.json');
    }

    let gtuUnv = db.universities.find(u => u.id === 'gtu');
    if (!gtuUnv) { console.error('No GTU university in DB'); process.exit(1); }

    const crawlCodes = buildCrawlCodeIndex(crawled);
    const crawlBranchIdx = buildCrawlBranchIndex(crawled);
    const mappings = mapCrawlToDbBranches(gtuUnv.domains, crawlBranchIdx);

    let removed = 0, fixedDrive = 0, added = 0;

    // ---- Pass 1: Remove stale subjects + fix Drive syllabus links + prune ----
    for (const domain of gtuUnv.domains) {
        const validCodes = crawlCodes[domain.id];
        for (const branch of [...domain.branches]) {
            for (const sem of [...branch.semesters]) {
                const kept = [];
                for (const sub of sem.subjects) {
                    // Fix Google Drive syllabus links
                    if (sub.materials) {
                        let changed = false;
                        sub.materials = sub.materials.map(m => {
                            if (m.type === 'syllabus' && String(m.link || '').includes('drive.google.com')) {
                                changed = true;
                                return { ...m, link: `${SYLLABUS_PREFIX}${sub.code}.pdf` };
                            }
                            return m;
                        });
                        if (changed) fixedDrive++;
                        if (sub.materials.length === 0) delete sub.materials;
                    }
                    // Validate existence on GTU
                    if (!validCodes.has(sub.code)) { removed++; continue; }
                    kept.push(sub);
                }
                sem.subjects = kept;
            }
            branch.semesters = branch.semesters.filter(s => s.subjects && s.subjects.length > 0);
        }
        domain.branches = domain.branches.filter(b => b.semesters && b.semesters.length > 0);
    }

    // ---- Pass 2: Add missing subjects from crawl ----
    for (const domain of gtuUnv.domains) {
        const domId = domain.id;
        const existingCodes = new Set();
        for (const br of domain.branches) {
            for (const sem of br.semesters) {
                for (const s of sem.subjects) existingCodes.add(s.code);
            }
        }

        for (const [bc, sems] of Object.entries(crawlBranchIdx[domId] || {})) {
            const map = mappings[domId][bc];
            if (!map && map === undefined) continue;
            for (const [semNum, subs] of Object.entries(sems)) {
                const newSubs = subs.filter(s => {
                    if (!s.code || existingCodes.has(s.code)) return false;
                    // Only add codes not present anywhere in this domain DB
                    return true;
                });
                if (!newSubs.length) continue;

                // Pick target branch: best overlap mapping, else create one
                let targetBranch = map ? domain.branches.find(b => b.id === map.branchSlug) : null;
                if (!targetBranch) targetBranch = domain.branches[0];

                let targetSem = targetBranch.semesters.find(s => parseInt((s.id || '').replace(/\D/g, '')) === parseInt(semNum));
                if (!targetSem) {
                    targetSem = {
                        id: `sem${semNum}`,
                        name: `Semester ${semNum}`,
                        seo: { title: '', description: '', keywords: '' },
                        subjects: []
                    };
                    targetBranch.semesters.push(targetSem);
                }

                const existingInSem = new Set(targetSem.subjects.map(s => s.code));
                for (const s of newSubs) {
                    if (existingInSem.has(s.code)) continue;
                    const course = COURSE_BY_DOMAIN[domId];
                    const slug = slugify(s.name || s.code);
                    targetSem.subjects.push({
                        code: s.code,
                        name: s.name || s.code,
                        slug,
                        image: OG_IMAGE,
                        credit: s.credit || 0,
                        marks: s.total ? parseInt(s.total) || 0 : 0,
                        isElective: isElective(s),
                        categories: s.category || 'General',
                        seo: generateSEO(targetBranch.name, targetSem.name, s.name || s.code, s.code, course),
                        materials: [{ type: 'syllabus', label: 'Syllabus', link: `${SYLLABUS_PREFIX}${s.code}.pdf`, year: 'all' }]
                    });
                    added++;
                    existingCodes.add(s.code);
                    existingInSem.add(s.code);
                }
            }
        }
    }

    // ---- Re-sort ----
    for (const domain of gtuUnv.domains) {
        domain.branches.sort((a, b) => a.name.localeCompare(b.name));
        for (const branch of domain.branches) {
            branch.semesters.sort((a, b) => (parseInt(a.id.replace(/\D/g, '')) || 0) - (parseInt(b.id.replace(/\D/g, '')) || 0));
            for (const sem of branch.semesters) {
                sem.subjects.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
            }
        }
    }

    // ---- Report ----
    let totalSubjects = 0, driveSyllBus = 0, totalSyll = 0;
    for (const d of gtuUnv.domains) {
        for (const br of d.branches) {
            for (const sem of br.semesters) {
                totalSubjects += sem.subjects.length;
                for (const s of sem.subjects) {
                    for (const m of s.materials || []) {
                        if (m.type === 'syllabus') {
                            totalSyll++;
                            if (String(m.link || '').includes('drive.google')) driveSyllBus++;
                        }
                    }
                }
            }
        }
    }

    console.log('\n=== GTU SUBJECT SYNC SUMMARY ===');
    console.log(`Removed stale subjects (not on GTU): ${removed}`);
    console.log(`Added missing subjects (on GTU, not in DB): ${added}`);
    console.log(`Fixed Google Drive syllabus links: ${fixedDrive}`);
    console.log(`Total subjects now: ${totalSubjects}`);
    console.log(`Total syllabus materials: ${totalSyll}`);
    console.log(`Remaining Google Drive syllabus links: ${driveSyllBus}`);

    if (!DRY_RUN) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('Database saved!');
    } else {
        console.log('(DRY RUN - not saved)');
    }
}

main();