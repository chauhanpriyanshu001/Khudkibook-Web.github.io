#!/usr/bin/env node
/**
 * Clean up the diploma database after the 2021-2026 syllabus sync.
 *
 * 1. Drop branches that have no GTU diploma syllabus (their subjects are
 *    copies of other branches -- e.g. ict-iot held costume-design codes).
 * 2. Replace Google Drive paper materials with the direct GTU uploads links
 *    collected in data/gtu_full_papers_progress.json.
 * 3. De-duplicate materials (same type + link) while keeping the richest
 *    syllabus metadata.
 *
 * C-prefixed subjects (the 2022 revision) are served from the base code's
 * crawl; only C-prefixed PDFs are attached to them, and the normal code keeps
 * the normal PDFs.
 *
 * Usage:
 *   node scripts/crawler/cleanup_diploma_2021_2026.js           # dry run
 *   node scripts/crawler/cleanup_diploma_2021_2026.js --write
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DB_FILE = path.join(ROOT, 'data', 'site_db.json');
const PROGRESS_FILE = path.join(ROOT, 'data', 'gtu_full_papers_progress.json');

const WRITE = process.argv.includes('--write');

const REMOVE_BRANCHES = new Set([
    'ai-data-science',
    'ai-ml',
    'chemical-green',
    'cs-ai',
    'ds',
    'electronics-telecom',
    'electronics',
    'ict-iot',
    'nano',
    'production',
    'rubber',
    'smart-energy'
]);

const ACTIVE_HOST = 'https://old26.gtu.ac.in';

function hostPath(link) {
    const m = String(link || '').match(/^https?:\/\/[^/]+(\/uploads\/.*)$/i);
    return m ? m[1] : null;
}

function paperFile(link) {
    const m = String(link || '').match(/\/([^/]+)\.pdf$/i);
    return m ? m[1] : '';
}

function sessionOf(p) {
    if (p && p.session) return String(p.session).toUpperCase();
    const label = String((p && p.label) || '');
    const season = /winter/i.test(label) ? 'W' : /summer/i.test(label) ? 'S' : '';
    const year = (label.match(/(20\d\d)/) || [])[1];
    return season && year ? `${season}${year}` : '';
}

function directPapersFor(code, papersByCode) {
    const c = String(code);
    let base = c;
    let wantC = false;
    if (/^C\d{7}$/i.test(c)) {
        base = c.slice(1);
        wantC = true;
    }
    const entries = papersByCode[base] || [];
    const seen = new Set();
    const out = [];
    for (const p of entries) {
        const file = paperFile(p.link);
        const isC = /^C/i.test(file);
        if (wantC !== isC) continue;
        if (!wantC && !/^\d/.test(file)) continue;
        const hp = hostPath(p.link);
        if (!hp || seen.has(hp)) continue;
        seen.add(hp);
        out.push({
            type: 'paper',
            label: p.label || ((sessionOf(p).startsWith('W') ? 'Winter ' : 'Summer ') + (sessionOf(p).slice(1)) + ' Exam Paper'),
            link: `${ACTIVE_HOST}${hp}`,
            year: p.year || sessionOf(p).slice(1)
        });
    }
    out.sort((a, b) => {
        const sa = sessionOf(a), sb = sessionOf(b);
        return sa.localeCompare(sb);
    });
    return out;
}

function materialKey(m) {
    return `${m.type || ''}|${m.link || ''}`;
}

function cleanMaterials(materials, code, papersByCode, stats) {
    const mats = Array.isArray(materials) ? materials : [];
    const direct = directPapersFor(code, papersByCode);
    const kept = [];
    const seen = new Map();

    const add = (m) => {
        if (!m || !m.type || !m.link) return;
        const key = materialKey(m);
        const prev = seen.get(key);
        if (!prev) {
            seen.set(key, m);
            kept.push(m);
            return;
        }
        stats.duplicates++;
        if (m.type === 'syllabus') {
            const prevYears = (prev.academicYears || []).length;
            const nextYears = (m.academicYears || []).length;
            if (nextYears > prevYears) {
                const i = kept.indexOf(prev);
                kept[i] = m;
                seen.set(key, m);
            }
        }
    };

    for (const m of mats) {
        if (m.type !== 'paper') {
            add(m);
            continue;
        }
        if (/drive\.google\.com/i.test(m.link || '')) {
            stats.drivePapers++;
            continue;
        }
        add(m);
    }

    if (direct.length) {
        for (const m of direct) add(m);
        stats.directPapers += direct.length;
        // Direct crawl is the source of truth for this code: remove paper
        // links that are not part of it (old hosts, extra Drive copies, ...).
        for (let i = kept.length - 1; i >= 0; i--) {
            const m = kept[i];
            if (m.type !== 'paper') continue;
            if (!direct.some(d => d.link === m.link)) {
                kept.splice(i, 1);
                stats.stalePapers++;
            }
        }
    }

    return kept;
}

function main() {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    const papersByCode = progress.papersByCode || {};

    const diploma = db.universities
        .flatMap(u => u.domains || [])
        .find(d => d.id === 'diploma');
    if (!diploma) throw new Error('diploma domain not found');

    const beforeBranches = diploma.branches.length;
    diploma.branches = diploma.branches.filter(b => !REMOVE_BRANCHES.has(b.id));
    const removedBranches = beforeBranches - diploma.branches.length;

    const stats = {
        branches: removedBranches,
        subjects: 0,
        materialsBefore: 0,
        materialsAfter: 0,
        duplicates: 0,
        drivePapers: 0,
        directPapers: 0,
        stalePapers: 0
    };

    for (const branch of diploma.branches) {
        for (const sem of branch.semesters || []) {
            for (const sub of sem.subjects || []) {
                stats.subjects++;
                const before = Array.isArray(sub.materials) ? sub.materials : [];
                stats.materialsBefore += before.length;
                sub.materials = cleanMaterials(before, sub.code, papersByCode, stats);
                stats.materialsAfter += sub.materials.length;
            }
        }
    }

    const leftDrivePapers = [];
    for (const branch of diploma.branches) {
        for (const sem of branch.semesters || []) {
            for (const sub of sem.subjects || []) {
                for (const m of sub.materials || []) {
                    if (m.type === 'paper' && /drive\.google\.com/i.test(m.link || '')) {
                        leftDrivePapers.push(`${branch.id}/${sem.id}/${sub.code}`);
                    }
                }
            }
        }
    }

    console.log(JSON.stringify({
        write: WRITE,
        branchesBefore: beforeBranches,
        branchesAfter: diploma.branches.length,
        ...stats,
        leftDrivePapers: leftDrivePapers.length
    }, null, 2));

    if (leftDrivePapers.length) {
        console.error('Drive paper links remain:', leftDrivePapers.slice(0, 20));
        process.exitCode = 1;
        return;
    }

    if (WRITE) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log(`Wrote ${DB_FILE}`);
    } else {
        console.log('Dry run. Pass --write to update data/site_db.json.');
    }
}

main();
