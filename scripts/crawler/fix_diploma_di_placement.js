/**
 * Relocates GTU Diploma "DI" curriculum subjects to the branch GTU lists them under.
 *
 * The GTU subject sync (sync_gtu_subjects.js) cannot fix a diploma branch that has
 * no GTU counterpart -- those resolve to `null` and are deliberately left alone, so
 * any DI subjects sitting inside them stay put forever. A second gap: several GTU
 * diploma codes have NO page on the site at all (Chemical, Environmental,
 * Metallurgy, Plastics, Textile Processing / Manufacturing, Automation & Robotics,
 * Costume Design), so even a mapped branch that was given another branch's DI
 * subjects had nowhere correct to move them to.
 *
 * This script closes both gaps:
 *
 *   1. Creates the missing GTU diploma branches, pre-filled with the DI subjects
 *      GTU lists for them (from gtu_full_subjects.json), so the later sync pass has
 *      a real home to file subjects into.
 *   2. Moves every branch-specific DI code (the subject code embeds its GTU branch,
 *      e.g. DI01006011 -> Civil) out of whichever branch it currently sits in and
 *      into the single branch that owns that code. Common codes (DI01000011 and
 *      friends, where the embedded branch is "00") stay in every branch, as GTU
 *      offers them everywhere.
 *
 * Materials (books / papers / syllabus) are carried on the subject code, so the
 * union is preserved no matter which branch a subject moves between.
 *
 * Sync with the crawl is still run afterwards:
 *   node scripts/crawler/sync_gtu_subjects.js --courses DI --years 2024-2026
 * so that templates rebuild with the merged materials, live syllabus links are
 * swapped in, and semester ordering is verified.
 *
 * Usage:
 *   node scripts/crawler/fix_diploma_di_placement.js            # execute
 *   node scripts/crawler/fix_diploma_di_placement.js --dry-run  # preview only
 */

const fs = require('fs');
const path = require('path');
const { buildGtuBranchNameLookup, resolveDbBranchCodes } = require('./branch_map');

const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'site_db.json');
const DB_BACKUP = path.join(DATA_DIR, 'site_db_backup.json');
const CRAWLED_FILE = path.join(DATA_DIR, 'gtu_full_subjects.json');
const PROGRAMS_FILE = path.join(DATA_DIR, 'gtu_programs_branches.json');
const OG_IMAGE = 'https://chauhanpriyanshu001.github.io/pic.github.io/bg.webp';

const DRY_RUN = process.argv.includes('--dry-run');

// GTU Diploma codes that have no home branch on the site yet. Keyed by the code
// embedded in every DI subject it owns (code[5:7]) so the branch id is derivable
// from a subject code alone. Names must normalise exactly to GTU's own names
// (data/gtu_programs_branches.json -> DI) or the branch will not claim its code.
const NEW_BRANCHES = {
    '05': { id: 'chemical', name: 'Chemical Engineering', shortName: 'CHEMICAL' },
    '13': { id: 'environmental', name: 'Environmental Engineering', shortName: 'ENVIRONMENTAL' },
    '21': { id: 'metallurgy', name: 'Metallurgy Engineering', shortName: 'METALLURGY' },
    '23': { id: 'plastics', name: 'Plastics Engineering', shortName: 'PLASTICS' },
    '28': { id: 'textile-processing', name: 'Textile Processing Technology', shortName: 'TEXTILE PROCESSING' },
    '29': { id: 'textile-manufacturing', name: 'Textile Manufacturing Technology', shortName: 'TEXTILE MANUFACTURING' },
    '41': { id: 'automation-and-robotics', name: 'Automation And Robotics', shortName: 'AUTOMATION & ROBOTICS' },
    '51': { id: 'costume-design', name: 'Computer Aided Costume Design Dress Making', shortName: 'CACDDM' },
};

function slugify(name) {
    return String(name || '')
        .toLowerCase()
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

function generateSEO(branchName, semName, subjectName, subjectCode) {
    const label = String(branchName || '').trim();
    return {
        title: `${subjectName} (${subjectCode}) - GTU ${label} ${semName} Free Books & Papers | Khudkibook`,
        description: `Download free ${subjectName} study material for GTU Diploma ${label} ${semName}. Get textbooks, question papers, syllabus PDF at Khudkibook.`,
        keywords: `gtu ${String(subjectName || '').toLowerCase()}, ${subjectCode}, gtu ${String(label).toLowerCase()} ${String(semName || '').toLowerCase()}, diploma ${String(label).toLowerCase()} books, gtu papers`
    };
}

function semSEO(branchName, semName) {
    const label = String(branchName || '').trim();
    return {
        title: `GTU ${label} ${semName} - Books, Syllabus & Papers | Khudkibook`,
        description: `Download free study material for GTU Diploma ${label} ${semName}. Books, Notes, Question Papers & Syllabus at Khudkibook.`,
        keywords: `gtu ${String(label).toLowerCase()}, ${String(semName).toLowerCase()}, gtu diploma books, gtu old papers ${String(label).toLowerCase()}`
    };
}

/** The embedded GTU branch in a DI subject code: "DI01006011" -> "06". */
function embeddedBranch(code) {
    return String(code).slice(5, 7);
}

function main() {
    if (!fs.existsSync(DB_FILE)) { console.error('DB not found'); process.exit(1); }
    if (!fs.existsSync(CRAWLED_FILE)) { console.error('Crawled data not found.'); process.exit(1); }

    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const crawled = JSON.parse(fs.readFileSync(CRAWLED_FILE, 'utf8'));
    const programs = JSON.parse(fs.readFileSync(PROGRAMS_FILE, 'utf8'));

    const gtuUnv = db.universities.find(u => u.id === 'gtu');
    if (!gtuUnv) { console.error('No GTU university in DB'); process.exit(1); }
    const dom = gtuUnv.domains.find(d => d.id === 'diploma');
    if (!dom) { console.error('No diploma domain in DB'); process.exit(1); }

    // ---- Crawl indexes ----
    const crawlBc = crawled.DI || {};
    const ownerByCode = new Map(); // DI code -> Set(GTU branch codes offering it)
    for (const [bc, sems] of Object.entries(crawlBc)) {
        for (const subs of Object.values(sems)) {
            for (const s of subs) {
                if (!s || !s.code || !String(s.code).startsWith('DI')) continue;
                if (!ownerByCode.has(s.code)) ownerByCode.set(s.code, new Set());
                ownerByCode.get(s.code).add(bc);
            }
        }
    }

    // ---- Branch resolution ----
    const lookup = buildGtuBranchNameLookup(programs);
    let resolved = resolveDbBranchCodes(dom, 'DI', lookup);

    const claimed = new Set([...resolved.values()].filter(Boolean));

    // Every DI placement currently in the DB, tagged with the GTU owners of its
    // code. `owners` is the set of GTU branch codes that list the code (a code can
    // be shared: DI01021011 Applied Chemistry belongs to branches 06/13/21/22/52).
    const placements = [];
    for (const b of dom.branches) {
        for (const sm of b.semesters) {
            for (const s of sm.subjects) {
                const code = String(s.code || '');
                if (!code.startsWith('DI')) continue;
                const emb = embeddedBranch(code);
                const owners = ownerByCode.get(code);
                placements.push({
                    branchId: b.id, semId: sm.id, obj: s,
                    emb, common: emb === '00',
                    owners,
                });
            }
        }
    }

    // Branch codes that appear in DI codes but have no DB branch claiming them yet.
    const needNew = new Set();
    for (const p of placements) if (!p.common && !claimed.has(p.emb)) needNew.add(p.emb);
    for (const code of ownerByCode.keys()) {
        const emb = embeddedBranch(code);
        if (emb !== '00' && !claimed.has(emb)) needNew.add(emb);
    }

    console.log('=== NEW DIPLOMA BRANCHES REQUIRED ===');
    for (const bc of [...needNew].sort()) {
        const spec = NEW_BRANCHES[bc];
        console.log(`  ${bc} -> ${spec ? spec.id + '  ("' + spec.name + '")' : 'NO SPEC'}`);
    }
    const unhandled = [...needNew].filter(bc => !NEW_BRANCHES[bc]);
    if (unhandled.length) {
        console.error(`No NEW_BRANCHES spec for: ${unhandled.join(', ')}. Add one before running.`);
        process.exit(1);
    }

    // ---- Build a template record for every DI code (union of materials) ----
    const templateByCode = new Map();
    for (const b of dom.branches) {
        for (const sm of b.semesters) {
            for (const s of sm.subjects) {
                const code = String(s.code || '');
                if (!code.startsWith('DI')) continue;
                if (!templateByCode.has(code)) templateByCode.set(code, s);
            }
        }
    }

    function buildSubjectRecord(bcSubject, branch, sem) {
        const code = String(bcSubject.code);
        const base = templateByCode.get(code);
        const rec = base
            ? JSON.parse(JSON.stringify(base))
            : { code, name: bcSubject.name || code, slug: slugify(bcSubject.name || code), image: OG_IMAGE };
        rec.code = code;
        rec.name = bcSubject.name || code;
        rec.slug = slugify(rec.name);
        rec.image = rec.image || OG_IMAGE;
        rec.credit = (bcSubject.credit != null ? bcSubject.credit : undefined) ?? (rec.credit != null ? rec.credit : 0);
        rec.marks = (bcSubject.total != null ? parseInt(bcSubject.total) : undefined) ?? (rec.marks != null ? rec.marks : 0);
        rec.isElective = isElective(bcSubject);
        rec.categories = bcSubject.category || 'General';
        rec.effFrom = bcSubject.effFrom || '';
        rec.seo = generateSEO(branch.name, sem.name, rec.name, code);
        return rec;
    }

    // ---- Create the missing branches, pre-filled from the crawl ----
    const created = [];
    for (const bc of [...needNew].sort()) {
        const spec = NEW_BRANCHES[bc];
        const sems = crawlBc[bc] || {};
        const semesters = [];
        for (const [semNum, subs] of Object.entries(sems)) {
            if (!Array.isArray(subs) || !subs.length) continue;
            const sem = { id: `sem${semNum}`, name: `Semester ${semNum}`, seo: semSEO(spec.name, `Semester ${semNum}`), subjects: [] };
            for (const s of subs) {
                if (!s || !String(s.code || '').startsWith('DI')) continue;
                sem.subjects.push(buildSubjectRecord(s, { name: spec.name }, sem));
            }
            if (sem.subjects.length) semesters.push(sem);
        }
        if (!dom.branches.some(b => b.id === spec.id)) {
            dom.branches.push({
                id: spec.id, name: spec.name, shortName: spec.shortName, image: OG_IMAGE, semesters,
            });
            created.push({ bc, id: spec.id, semesters: semesters.length, subjects: semesters.reduce((n, s) => n + s.subjects.length, 0) });
        }
    }
    for (const c of created) console.log(`  created ${c.id} (${c.subjects} DI subjects in ${c.semesters} semesters)`);

    // Re-resolve so the new branches claim their codes.
    resolved = resolveDbBranchCodes(dom, 'DI', lookup);
    const branchByCode = new Map();
    for (const [id, code] of resolved) if (code) branchByCode.set(code, id);

    if (created.length) {
        if (DRY_RUN) console.log('\n[DRY-RUN] New branches listed above are NOT written.');
    }

    // ---- Relocate branch-specific DI subjects to their rightful branch ----
    const moves = [];
    let keptCommon = 0;
    for (const p of placements) {
        if (p.common) { keptCommon++; continue; }
        const here = resolved.get(p.branchId);
        const owners = p.owners;

        // A branch GTU actually matches (`here`) legitimately holds a code only if
        // GTU lists the code for that branch. Shared codes stay in every branch
        // whose code is among the owners.
        if (here !== null && here !== undefined && owners && owners.has(here)) continue;

        // No owner info: never seen by GTU's crawl -- leave it rather than lose it.
        if (!owners || !owners.size) { keptCommon++; continue; }

        // Pick a home: a claimed GTU branch among the owners that doesn't already
        // hold the code. Branches with no GTU counterpart resolve to null and are
        // only ever a source, never a home.
        const targets = [...owners].filter(o => branchByCode.has(o));
        if (!targets.length) {
            console.log(`  no claimed owner branch for ${p.obj.code} (${p.obj.name}) -- left in place`);
            continue;
        }
        const targetId = branchByCode.get(targets[0]);
        const target = dom.branches.find(b => b.id === targetId);
        let tSem = target.semesters.find(s => s.id === p.semId);
        if (!tSem) {
            tSem = { id: p.semId, name: `Semester ${p.semId.replace(/\D/g, '')}`, seo: semSEO(target.name, `Semester ${p.semId.replace(/\D/g, '')}`), subjects: [] };
            target.semesters.push(tSem);
        }
        const dupInTarget = tSem.subjects.some(s => String(s.code) === p.obj.code);
        if (!dupInTarget) tSem.subjects.push(p.obj);
        moves.push({ code: p.obj.code, name: p.obj.name, from: p.branchId, fromSem: p.semId, to: targetId, dup: dupInTarget });
    }

    if (moves.length) {
        console.log('\n=== DI SUBJECT RELOCATIONS ===');
        const byPair = {};
        for (const m of moves) {
            const k = `${m.to} <- ${m.from}${m.dup ? ' (dedupe)' : ''}`;
            (byPair[k] = byPair[k] || []).push(m);
        }
        for (const [k, list] of Object.entries(byPair).sort((a, b) => b[1].length - a[1].length)) {
            console.log(`  ${String(list.length).padStart(4)}  ${k}   e.g. ${list.slice(0, 2).map(m => m.code).join(', ')}`);
        }
    }

    // ---- Drop the subjects that were moved away / are duplicates ----
    const removed = [];
    for (const p of placements) {
        if (p.common) continue;
        const here = resolved.get(p.branchId);
        const owners = p.owners;
        if (here !== null && here !== undefined && owners && owners.has(here)) continue;
        if (!owners || !owners.size) continue;
        const branch = dom.branches.find(b => b.id === p.branchId);
        const sm = branch.semesters.find(s => s.id === p.semId);
        if (!sm) continue;
        const before = sm.subjects.length;
        sm.subjects = sm.subjects.filter(s => String(s.code) !== p.obj.code);
        if (sm.subjects.length !== before) removed.push(`${p.branchId}/${p.semId}/${p.obj.code}`);
    }

    // ---- Prune emptied semesters/branches, then sort like the sync does ----
    for (const b of [...dom.branches]) {
        b.semesters = b.semesters.filter(s => Array.isArray(s.subjects) && s.subjects.length > 0);
        for (const sm of b.semesters) sm.subjects.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
        b.semesters.sort((a, b) => (parseInt(a.id.replace(/\D/g, '')) || 0) - (parseInt(b.id.replace(/\D/g, '')) || 0));
    }
    dom.branches = dom.branches.filter(b => b.semesters && b.semesters.length > 0);
    dom.branches.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`\n=== SUMMARY (${DRY_RUN ? 'DRY RUN' : 'executed'}) ===`);
    console.log(`common DI placements kept in place: ${keptCommon}`);
    console.log(`branch-specific DI subjects relocated: ${moves.length} (${moves.filter(m => m.dup).length} dedupes)`);
    console.log(`stale subject entries removed from sources: ${removed.length}`);

    // ---- Post-fix audit ----
    const audit = { foreign: 0, missing: 0, placements: 0 };
    const haveByBranch = new Map();
    for (const b of dom.branches) {
        const set = new Set();
        for (const sm of b.semesters) for (const s of sm.subjects) set.add(String(s.code));
        haveByBranch.set(b.id, set);
        for (const sm of b.semesters) for (const s of sm.subjects) {
            const code = String(s.code);
            if (!code.startsWith('DI')) continue;
            audit.placements++;
            const emb = embeddedBranch(code);
            if (emb === '00') continue;
            const here = resolved.get(b.id);
            const owners = ownerByCode.get(code);
            if (here === null || here === undefined || !owners || !owners.has(here)) audit.foreign++;
        }
    }
    for (const code of ownerByCode.keys()) {
        const emb = embeddedBranch(code);
        if (emb === '00') continue;
        for (const owner of ownerByCode.get(code)) {
            const home = branchByCode.get(owner);
            if (home && !haveByBranch.get(home).has(code)) audit.missing++;
        }
    }
    console.log(`DI placements now: ${audit.placements}`);
    console.log(`DI placements in wrong branch: ${audit.foreign}`);
    console.log(`DI codes missing from their home branch: ${audit.missing}`);

    if (DRY_RUN) {
        console.log('\n(DRY RUN - not saved)');
        return;
    }
    fs.writeFileSync(DB_BACKUP, fs.readFileSync(DB_FILE));
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log('\nBackup saved to site_db_backup.json');
    console.log('Database saved!');
}

main();