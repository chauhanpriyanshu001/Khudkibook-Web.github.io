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
 * 2. UNPLACE subjects sitting in a branch GTU does not offer them to, and ADD them
 *    to the branch GTU does. See "Branch mapping" below -- this is the pass that
 *    used to be missing and it is what left Diploma IT's subjects under Biomedical.
 * 3. ADD subjects from the fresh crawl whose code is missing from the DB.
 * 4. FIX every Google Drive syllabus link -> official GTU S3 syllabus link.
 * 5. Prune empty semesters/branches left behind.
 *
 * Branch mapping
 * --------------
 * A crawl branch (GTU branch code, e.g. "16") has to be attached to exactly one DB
 * branch. The previous implementation picked the DB branch with the greatest
 * subject-code overlap. That is self-reinforcing and it was wrong:
 *
 *   - GTU branch 16 (INFORMATION TECHNOLOGY) shares most of its subject codes with
 *     every other diploma branch, so its overlap score was decided by which DB
 *     branch happened to be largest at the time, not by anything to do with
 *     Information Technology.
 *   - The winner then received 142 subjects, which raised its overlap score for
 *     every later run, so the wrong answer could never correct itself.
 *   - Result: 116 of Information Technology's 142 subjects were absent from
 *     /it and 86 of them (Python Programming, Web Development using PHP, Database
 *     Management, OOP with JAVA, ...) were published under /biomedical. Ties fell
 *     through to `domain.branches[0]`.
 *
 * The mapping is now resolved by NAME against data/gtu_programs_branches.json,
 * which is GTU's own branch list: the DB branch whose name normalises to the same
 * string as GTU's branch name owns that branch code. There is no scoring and no
 * ordering dependency, so the result is the same on every run. A DB branch with no
 * GTU counterpart (rubber, nano, ds, ...) or one that duplicates a branch already
 * claimed (ai-ml alongside the AI & ML branch) resolves to nothing and is then left
 * strictly alone -- never added to, never pruned.
 *
 * Usage:
 *   node scripts/crawler/sync_gtu_subjects.js            # execute (creates backup)
 *   node scripts/crawler/sync_gtu_subjects.js --dry-run  # preview without writing
 *   node scripts/crawler/sync_gtu_subjects.js --branch it --dry-run   # one branch
 *   node scripts/crawler/sync_gtu_subjects.js --courses DI --years 2021-2026 --dry-run
 *
 * --years restricts the work to subjects whose GTU "effective from" academic year
 * starts inside the range, so an older curriculum sitting in the wrong branch is
 * left alone while the 2021-2026 intake is put right.
 */

const fs = require('fs');
const path = require('path');
const { normalizeBranchName, buildGtuBranchNameLookup, resolveDbBranchCodes } = require('./branch_map');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const DB_BACKUP = path.join(DATA_DIR, 'site_db_backup.json');
const CRAWLED_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');
const PROGRAMS_FILE = path.join(DATA_DIR, 'gtu_programs_branches.json');
const OG_IMAGE = 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';
const SYLLABUS_PREFIX = 'https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/';

const DRY_RUN = process.argv.includes('--dry-run');
const BRANCH_FILTER = (() => {
    const i = process.argv.indexOf('--branch');
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1].trim().toLowerCase() : null;
})();
const COURSE_FILTER = (() => {
    const i = process.argv.indexOf('--courses');
    if (i === -1 || !process.argv[i + 1]) return null;
    const wanted = process.argv[i + 1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    return wanted.length ? new Set(wanted) : null;
})();
// GTU "effective from" is an academic year such as "2024-25"; the leading four
// digits are the start year, so 2021-2026 covers 2021-22 through 2026-27.
const YEAR_RANGE = (() => {
    const i = process.argv.indexOf('--years');
    if (i === -1 || !process.argv[i + 1]) return null;
    const m = String(process.argv[i + 1]).match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (!m) { console.error(`--years expects a range like 2021-2026, got "${process.argv[i + 1]}"`); process.exit(1); }
    const from = parseInt(m[1], 10), to = parseInt(m[2], 10);
    if (to < from) { console.error(`--years range ends before it starts: ${process.argv[i + 1]}`); process.exit(1); }
    return { from, to };
})();
const DOMAIN_BY_COURSE = { BE: 'be', DI: 'diploma', ME: 'me' };
const DOMAIN_BY_COURSE_REVERSE = { be: 'BE', diploma: 'DI', me: 'ME' };
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

// domain id -> subject code -> Set(GTU branch codes that offer it)
function buildSubjectOwnerIndex(crawlBranchIdx) {
    const owners = {};
    for (const [domId, branches] of Object.entries(crawlBranchIdx)) {
        const idx = new Map();
        for (const [bc, sems] of Object.entries(branches)) {
            for (const subs of Object.values(sems)) {
                for (const s of subs) {
                    if (!s.code) continue;
                    if (!idx.has(s.code)) idx.set(s.code, new Set());
                    idx.get(s.code).add(bc);
                }
            }
        }
        owners[domId] = idx;
    }
    return owners;
}

// The academic year a GTU record takes effect, e.g. "2024-25" -> 2024.
function effectiveFromYear(subject) {
    const m = String((subject && subject.effFrom) || '').match(/\d{4}/);
    return m ? parseInt(m[0], 10) : null;
}

// domain id -> Set(subject codes in scope for this run).
// Without --courses/--years this is "everything", so the default behaviour is
// unchanged. With them it is the set of subjects GTU introduced in the requested
// intake, which is what decides whether a placement may be moved or added.
function buildScopeIndex(crawlBranchIdx) {
    const scope = {};
    for (const [domId, branches] of Object.entries(crawlBranchIdx)) {
        const set = new Set();
        for (const [bc, sems] of Object.entries(branches)) {
            for (const subs of Object.values(sems)) {
                for (const s of subs) {
                    if (!s.code) continue;
                    if (!YEAR_RANGE) { set.add(s.code); continue; }
                    const year = effectiveFromYear(s);
                    if (year !== null && year >= YEAR_RANGE.from && year <= YEAR_RANGE.to) set.add(s.code);
                }
            }
        }
        scope[domId] = set;
    }
    return scope;
}

// Some domains hold first-year service subjects in one shared branch rather than
// repeating them per branch: B.E. keeps Chemistry, Mathematics, Physics and the
// rest in `common` ("Common (All Branches)"). Those codes belong to every branch
// in spirit, so Pass 2 must not fan them out into all of them, and the audit must
// not call them missing.
function isSharedBranch(branch) {
    return /^(common|shared)\b/i.test(branch.id || '') ||
        /\ball branches\b/i.test(branch.name || '');
}

function collectSharedCodes(domain) {
    const shared = new Set();
    for (const branch of domain.branches) {
        if (!isSharedBranch(branch)) continue;
        for (const sem of branch.semesters) {
            for (const s of sem.subjects || []) shared.add(s.code);
        }
    }
    return shared;
}

// domain id -> subject code -> { best, byBranch, materials }
// Pass 1b drops misplaced placements and Pass 2 rebuilds them, so without this the
// rebuilt record would be a bare stub holding only a syllabus link: doing it that
// way silently threw away 1,572 book links and 5,074 paper links in a dry run.
// Materials hang off the subject code, so the union of every record for that code
// is carried to each branch GTU places it in. `byBranch` prefers the record the
// branch already had, and `best` is the fallback for a branch that never had one;
// the merged list is the floor, so no link is dropped no matter which branch a
// subject is moving between.
function buildSubjectTemplateIndex(gtuUnv) {
    const templates = {};
    for (const domain of gtuUnv.domains) {
        const idx = new Map();
        const seen = new Map();
        for (const branch of domain.branches) {
            for (const sem of branch.semesters) {
                for (const sub of sem.subjects || []) {
                    if (!sub.code) continue;
                    if (!idx.has(sub.code)) {
                        idx.set(sub.code, { best: sub, byBranch: new Map(), materials: [] });
                        seen.set(sub.code, new Set());
                    }
                    const slot = idx.get(sub.code);
                    const rank = (sub.materials || []).length;
                    if (!slot.best || rank > (slot.best.materials || []).length) slot.best = sub;
                    if (!slot.byBranch.has(branch.id)) slot.byBranch.set(branch.id, sub);
                    for (const m of sub.materials || []) {
                        const key = `${m.type}|${m.link}|${m.year || ''}|${m.label || ''}`;
                        if (seen.get(sub.code).has(key)) continue;
                        seen.get(sub.code).add(key);
                        slot.materials.push(m);
                    }
                }
            }
        }
        templates[domain.id] = idx;
    }
    return templates;
}

// Rebuild a subject for its rightful branch, reusing the existing record's fields
// and the union of its materials, and refreshing only what names the branch or
// semester.
function buildSubjectRecord(template, source, branch, sem, course, mergedMaterials) {
    const name = (source && source.name) || (template && template.name) || (source && source.code);
    const code = (source && source.code) || (template && template.code);
    const base = template ? JSON.parse(JSON.stringify(template)) : { code, name, image: OG_IMAGE };

    base.code = code;
    base.name = name;
    base.slug = slugify(name || code);
    base.image = base.image || OG_IMAGE;
    base.credit = (source && source.credit) || base.credit || 0;
    base.marks = (source && source.total ? parseInt(source.total) : undefined) ?? base.marks ?? 0;
    base.isElective = source ? isElective(source) : (base.isElective || false);
    base.categories = (source && source.category) || base.categories || 'General';
    // GTU states which intake a curriculum starts with. 133 diploma codes carry
    // two different effective years, so it is kept per branch placement rather
    // than per code -- the year belongs to the (code, branch, semester) triple.
    base.effFrom = (source && source.effFrom) || base.effFrom || '';
    base.seo = generateSEO(branch.name, sem.name, name, code, course);

    const materials = Array.isArray(mergedMaterials) && mergedMaterials.length
        ? JSON.parse(JSON.stringify(mergedMaterials))
        : (Array.isArray(base.materials) ? base.materials : []);
    if (!materials.some(m => m.type === 'syllabus')) {
        materials.unshift({ type: 'syllabus', label: 'Syllabus', link: `${SYLLABUS_PREFIX}${code}.pdf`, year: 'all' });
    }
    if (materials.length) base.materials = materials;
    return base;
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

// domain id -> GTU branch code -> DB branch id, restricted to GTU branches that a
// DB branch actually claims. Previously this was max subject-code overlap, which
// mapped Information Technology onto Biomedical and could never recover.
function mapCrawlToDbBranches(dbDomains, gtuNameLookup) {
    const mappings = {};
    for (const domain of dbDomains) {
        const domId = domain.id;
        if (!DOMAIN_BY_COURSE_REVERSE[domId]) continue;
        const course = DOMAIN_BY_COURSE_REVERSE[domId];
        if (COURSE_FILTER && !COURSE_FILTER.has(course)) { mappings[domId] = null; continue; }
        mappings[domId] = { dbCodes: resolveDbBranchCodes(domain, course, gtuNameLookup) };
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
    const programs = fs.existsSync(PROGRAMS_FILE)
        ? JSON.parse(fs.readFileSync(PROGRAMS_FILE, 'utf8'))
        : { programs: {} };
    const gtuNameLookup = buildGtuBranchNameLookup(programs);
    const mappings = mapCrawlToDbBranches(gtuUnv.domains, gtuNameLookup);
    const ownerIdx = buildSubjectOwnerIndex(crawlBranchIdx);
    const scopeIdx = buildScopeIndex(crawlBranchIdx, ownerIdx);

    if (BRANCH_FILTER && !Object.values(mappings).some(m => m.dbCodes.has(BRANCH_FILTER))) {
        console.error(`No GTU-mapped branch matching "${BRANCH_FILTER}". Nothing to do.`);
        process.exit(1);
    }

    const inScope = branchId => !BRANCH_FILTER || branchId.toLowerCase() === BRANCH_FILTER;

    // Branches that are about to lose every subject. Recorded before any mutation so
    // the report can name them: an emptied branch drops its pages, and that is a
    // visible consequence even when the relocation itself is correct.
    const toEmpty = [];
    for (const domain of gtuUnv.domains) {
        if (!mappings[domain.id]) continue;
        const { dbCodes } = mappings[domain.id];
        const owners = ownerIdx[domain.id];
        for (const branch of domain.branches) {
            const gtuCode = dbCodes.get(branch.id);
            if (gtuCode === null || gtuCode === undefined || !inScope(branch.id)) continue;
            const kept = branch.semesters.flatMap(s => s.subjects || [])
                .filter(x => { const o = owners.get(x.code); return !o || o.has(gtuCode); });
            if (!kept.length) {
                const lost = branch.semesters.flatMap(s => s.subjects || []).length;
                const gtuHas = Object.values(crawlBranchIdx[domain.id][gtuCode] || {}).reduce((a, v) => a + v.length, 0);
                toEmpty.push({ domain: domain.id, id: branch.id, name: branch.name, lost, gtuHas });
            }
        }
    }

    let removed = 0, fixedDrive = 0, added = 0, relocated = 0;

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

    // Template index is taken after Pass 1 so it already carries the repaired
    // syllabus links, and before Pass 1b starts dropping placements.
    const templates = buildSubjectTemplateIndex(gtuUnv);

    // ---- Pass 1b: Unplace subjects GTU does not offer to this branch ----
    // Runs after the stale-code pass so every surviving code is known to exist on
    // GTU. A subject is only dropped from a branch when GTU still offers it, just
    // not here -- that makes this a relocation, and Pass 2 puts it back in the
    // semester GTU lists it under. Branches with no GTU counterpart resolve to null
    // and are skipped, so nothing is lost if a branch cannot be identified.
    const relocations = [];
    let unreachable = 0;
    for (const domain of gtuUnv.domains) {
        const domId = domain.id;
        if (!mappings[domId]) continue;
        const { dbCodes } = mappings[domId];
        const owners = ownerIdx[domId];
        const scope = scopeIdx[domId];

        // GTU branch codes this domain can actually file a subject under. A subject
        // GTU assigns only to a branch that has no DB counterpart has nowhere to go;
        // relocating it would delete it, so it is left where it is and reported.
        const reachable = new Set();
        for (const code of dbCodes.values()) if (code !== null) reachable.add(code);

        for (const branch of domain.branches) {
            const gtuCode = dbCodes.get(branch.id);
            if (gtuCode === null || gtuCode === undefined || !inScope(branch.id)) continue;

            for (const sem of branch.semesters) {
                const kept = [];
                for (const sub of sem.subjects) {
                    if (!scope.has(sub.code)) { kept.push(sub); continue; }
                    const ownersOf = owners.get(sub.code);
                    if (ownersOf && !ownersOf.has(gtuCode)) {
                        if (![...ownersOf].some(c => reachable.has(c))) { unreachable++; kept.push(sub); continue; }
                        relocated++;
                        relocations.push({ branch: branch.id, gtuCode, code: sub.code, name: sub.name, owners: [...ownersOf] });
                        continue;
                    }
                    kept.push(sub);
                }
                sem.subjects = kept;
            }
            branch.semesters = branch.semesters.filter(s => s.subjects && s.subjects.length > 0);
        }
        domain.branches = domain.branches.filter(b => b.semesters && b.semesters.length > 0);
    }

    // ---- Pass 1c: Collapse duplicate placements onto GTU's semester ----
    // GTU lists first-year basic-science subjects under both semesters (GROUP-1 /
    // GROUP-2 variants), so for those the site's pick is legitimate and is left
    // alone. Only subjects GTU lists in exactly one semester are moved, which is
    // what catches Diploma IT holding 4331601/4331602/4331603 (Essential of
    // Digital Marketing, OOP with JAVA, Fundamental of Machine Learning) in
    // semester 4 when GTU schedules them in semester 3.
    let semFixed = 0;
    for (const domain of gtuUnv.domains) {
        const domId = domain.id;
        if (!mappings[domId]) continue;
        const { dbCodes } = mappings[domId];
        const sharedCodes = collectSharedCodes(domain);

        for (const branch of domain.branches) {
            const gtuCode = dbCodes.get(branch.id);
            if (gtuCode === null || gtuCode === undefined || !inScope(branch.id)) continue;

            const semsOf = new Map();
            for (const [semNum, subs] of Object.entries(crawlBranchIdx[domId][gtuCode] || {})) {
                for (const s of subs) {
                    if (!s.code || sharedCodes.has(s.code) || !scopeIdx[domId].has(s.code)) continue;
                    if (!semsOf.has(s.code)) semsOf.set(s.code, new Set());
                    semsOf.get(s.code).add(parseInt(semNum));
                }
            }
            const unambiguous = new Map();
            for (const [code, sems] of semsOf) if (sems.size === 1) unambiguous.set(code, [...sems][0]);
            if (!unambiguous.size) continue;

            for (const sem of branch.semesters) {
                const here = parseInt((sem.id || '').replace(/\D/g, ''));
                const kept = [];
                for (const sub of sem.subjects) {
                    const want = unambiguous.get(sub.code);
                    if (want !== undefined && want !== here) { semFixed++; continue; }
                    kept.push(sub);
                }
                sem.subjects = kept;
            }
            branch.semesters = branch.semesters.filter(s => s.subjects && s.subjects.length > 0);
        }
        domain.branches = domain.branches.filter(b => b.semesters && b.semesters.length > 0);
    }

    // ---- Pass 2: Add missing subjects from crawl, per mapped branch ----
    // Deduplication is per branch, not per domain. A code shared by 28 GTU
    // branches (DI05000011 Skill-Based Training, for example) has to appear in all
    // 28 of them; the old domain-wide `existingCodes` set let only the first
    // branch through, which is how that subject reached 28 branches but not `it`.
    for (const domain of gtuUnv.domains) {
        const domId = domain.id;
        if (!mappings[domId]) continue;
        const { dbCodes } = mappings[domId];
        const sharedCodes = collectSharedCodes(domain);

        for (const branch of domain.branches) {
            if (!inScope(branch.id)) continue;
            const gtuCode = dbCodes.get(branch.id);
            if (gtuCode === null || gtuCode === undefined) continue;
            const sems = crawlBranchIdx[domId][gtuCode];
            if (!sems) continue;

            const existingInBranch = new Set();
            for (const sem of branch.semesters) {
                for (const s of sem.subjects) existingInBranch.add(s.code);
            }

            for (const [semNum, subs] of Object.entries(sems)) {
                let targetSem = branch.semesters.find(s => parseInt((s.id || '').replace(/\D/g, '')) === parseInt(semNum));
                if (!targetSem) {
                    targetSem = {
                        id: `sem${semNum}`,
                        name: `Semester ${semNum}`,
                        seo: { title: '', description: '', keywords: '' },
                        subjects: []
                    };
                    branch.semesters.push(targetSem);
                }
                const existingInSem = new Set(targetSem.subjects.map(s => s.code));

                const course = COURSE_BY_DOMAIN[domId];
                for (const s of subs) {
                    if (!s.code || sharedCodes.has(s.code) || !scopeIdx[domId].has(s.code)) continue;
                    if (existingInBranch.has(s.code) || existingInSem.has(s.code)) continue;
                    const slot = templates[domId].get(s.code);
                    const template = slot ? (slot.byBranch.get(branch.id) || slot.best) : null;
                    targetSem.subjects.push(buildSubjectRecord(template, s, branch, targetSem, course, slot && slot.materials));
                    added++;
                    existingInBranch.add(s.code);
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

    // ---- Verify: every mapped branch must now hold exactly what GTU lists ----
    const audit = [];
    for (const domain of gtuUnv.domains) {
        const domId = domain.id;
        if (!mappings[domId]) continue;
        const { dbCodes } = mappings[domId];
        const owners = ownerIdx[domId];
        const sharedCodes = collectSharedCodes(domain);

        for (const branch of domain.branches) {
            const gtuCode = dbCodes.get(branch.id);
            if (gtuCode === null || gtuCode === undefined) continue;
            const want = new Set();
            for (const subs of Object.values(crawlBranchIdx[domId][gtuCode] || {})) {
                for (const s of subs) {
                    if (!sharedCodes.has(s.code) && scopeIdx[domId].has(s.code)) want.add(s.code);
                }
            }
            const have = new Map();
            for (const sem of branch.semesters) {
                for (const s of sem.subjects) have.set(s.code, sem.id);
            }
            let missing = 0, wrongSem = 0, foreign = 0;
            for (const code of want) {
                const at = have.get(code);
                if (!at) { missing++; continue; }
                const gtuSems = Object.entries(crawlBranchIdx[domId][gtuCode])
                    .filter(([, subs]) => subs.some(s => s.code === code))
                    .map(([n]) => parseInt(n));
                if (gtuSems.length && !gtuSems.includes(parseInt((at || '').replace(/\D/g, '')))) wrongSem++;
            }
            for (const [code] of have) {
                if (!scopeIdx[domId].has(code)) continue;
                const ownersOf = owners.get(code);
                if (ownersOf && !ownersOf.has(gtuCode)) foreign++;
            }
            audit.push({ branch: branch.id, name: branch.name, gtuCode, want: want.size, have: have.size, missing, wrongSem, foreign });
        }
    }
    const sum = k => audit.reduce((n, a) => n + a[k], 0);
    const clean = audit.filter(a => a.missing === 0 && a.wrongSem === 0 && a.foreign === 0).length;

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

    if (COURSE_FILTER || YEAR_RANGE) {
        console.log('=== SCOPE ===');
        if (COURSE_FILTER) console.log(`  courses: ${[...COURSE_FILTER].join(', ')}`);
        if (YEAR_RANGE) console.log(`  effective-from years: ${YEAR_RANGE.from}-${YEAR_RANGE.to} inclusive, matched on the leading year ("2024-25" counts as 2024)`);
        if (BRANCH_FILTER) console.log(`  branch: ${BRANCH_FILTER}`);
        for (const domain of gtuUnv.domains) {
            if (!mappings[domain.id]) continue;
            console.log(`  [${domain.id}] in-scope subject codes: ${scopeIdx[domain.id].size}`);
        }
    }

    console.log('\n=== BRANCH MAPPING (GTU name -> DB branch) ===');
    for (const domain of gtuUnv.domains) {
        if (!mappings[domain.id]) continue;
        const { dbCodes } = mappings[domain.id];
        const mapped = [...dbCodes].filter(([, c]) => c !== null);
        const unmapped = [...dbCodes].filter(([, c]) => c === null).map(([id]) => id);
        console.log(`\n  [${domain.id}] mapped ${mapped.length}, left untouched ${unmapped.length}`);
        if (unmapped.length) console.log(`    untouched: ${unmapped.join(', ')}`);
    }

    console.log('\n=== GTU SUBJECT SYNC SUMMARY ===');
    console.log(`Removed stale subjects (not on GTU): ${removed}`);
    console.log(`Unplaced from wrong branch (re-added in Pass 2): ${relocated}`);
    console.log(`Moved off a duplicated semester (re-added in Pass 2): ${semFixed}`);
    console.log(`Left in place (GTU owner branch has no DB page yet): ${unreachable}`);
    console.log(`Added missing subjects (on GTU, not in DB): ${added}`);
    console.log(`Fixed Google Drive syllabus links: ${fixedDrive}`);
    console.log(`Total subjects now: ${totalSubjects}`);
    console.log(`Total syllabus materials: ${totalSyll}`);
    console.log(`Remaining Google Drive syllabus links: ${driveSyllBus}`);

    console.log('\n=== POST-SYNC BRANCH AUDIT ===');
    if (YEAR_RANGE) {
        console.log(`  (in-scope only: effective-from ${YEAR_RANGE.from}-${YEAR_RANGE.to}. Older subjects are`);
        console.log('   left where they are by design, so they are not counted here.)');
    }
    if (BRANCH_FILTER) {
        console.log(`(scoped to --branch ${BRANCH_FILTER}: other branches were NOT synced,`);
        console.log(' so their figures below are pre-existing state, not something this run caused)');
    }
    console.log(`branches matching GTU exactly: ${clean}/${audit.length}`);
    console.log(`subjects still missing: ${sum('missing')}   in wrong semester: ${sum('wrongSem')}   in wrong branch: ${sum('foreign')}`);
    const problems = audit.filter(a => a.missing || a.wrongSem || a.foreign)
        .sort((a, b) => (b.missing + b.foreign) - (a.missing + a.foreign));
    if (problems.length) {
        console.log('\n  branch'.padEnd(40) + 'GTU  want  have  miss  sem  foreign');
        for (const a of problems) {
            console.log('  ' + a.branch.padEnd(38) + String(a.gtuCode).padEnd(6) +
                String(a.want).padStart(4) + String(a.have).padStart(6) +
                String(a.missing).padStart(6) + String(a.wrongSem).padStart(5) +
                String(a.foreign).padStart(9));
        }
    }

    if (toEmpty.length) {
        console.log(`\n=== BRANCHES EMPTIED BY THE MOVE (${toEmpty.length}) ===`);
        console.log('  GTU lists no subjects for these, so the branch is pruned and its pages go away.');
        for (const b of toEmpty) {
            console.log(`  [${b.domain}] ${b.id}  "${b.name}"  pages lost: ${b.lost}  subjects GTU lists: ${b.gtuHas}`);
        }
    }

    if (relocations) {
        console.log(`\n=== RELOCATIONS (${relocations.length}) ===`);
        const byPair = new Map();
        for (const r of relocations) {
            const k = `${r.branch} (GTU ${r.gtuCode}) -> GTU ${r.owners.join('/')}`;
            if (!byPair.has(k)) byPair.set(k, []);
            byPair.get(k).push(r);
        }
        for (const [k, list] of [...byPair].sort((a, b) => b[1].length - a[1].length)) {
            console.log(`  ${String(list.length).padStart(4)}  ${k}`);
        }
        if (process.argv.includes('--show-relocations')) {
            for (const r of relocations) {
                console.log(`      ${r.code}  ${r.name}  [${r.branch} -> GTU ${r.owners.join('/')}]`);
            }
        }
    }

    if (!DRY_RUN) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('\nDatabase saved!');
    } else {
        console.log('\n(DRY RUN - not saved)');
    }
}

main();