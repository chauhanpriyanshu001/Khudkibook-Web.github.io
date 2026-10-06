/**
 * Give every subject that has no syllabus material at all the official GTU
 * syllabus link for its code.
 *
 * Why this is needed
 * ------------------
 * site_db.json is the source of truth for the Syllabus button on every subject
 * page (scripts/generate.js picks the first `type: "syllabus"` material). A
 * subject that reaches the site through a path that did not go through
 * sync_gtu_subjects.js -- or whose material was lost in an older migration --
 * ends up with no Syllabus button at all, even though GTU publishes the PDF at
 * the same predictable bucket path for every code:
 *
 *   https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/<code>.pdf
 *
 * This script closes that gap. It only ever ADDS a syllabus material, and only
 * after confirming the URL actually returns a PDF, so a code whose object was
 * never made public (the bucket answers 403 for those) is left alone rather than
 * gaining a dead link. A dead syllabus link is worse than no link: the button
 * renders, the student clicks, and gets an error page.
 *
 * Usage:
 *   node scripts/crawler/add_syllabus_links.js --dry-run
 *   node scripts/crawler/add_syllabus_links.js
 *   node scripts/crawler/add_syllabus_links.js --concurrency 6
 *   node scripts/crawler/add_syllabus_links.js --force   # re-verify existing links
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DB_PATH = path.join(ROOT, 'data', 'site_db.json');
const BACKUP_PATH = path.join(ROOT, 'data', 'site_db_backup.json');
const SYLLABUS_PREFIX = 'https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/';
const UA = 'Khudkibook-SyllabusLinkBot/1.0 (+https://khudkibook.in)';

function arg(name, fallback) {
    const i = process.argv.indexOf(name);
    return i === -1 ? fallback : process.argv[i + 1];
}

const DRY = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const CONCURRENCY = Math.max(1, parseInt(arg('--concurrency', '6'), 10) || 6);

const isSyllabus = (m) => String(m.type || '').toLowerCase() === 'syllabus';

function hasSyllabusMaterial(sub) {
    return (sub.materials || []).some(isSyllabus);
}

/** A real syllabus PDF, not the bucket's 403 error body served as XML. */
async function verify(code, tries = 2) {
    for (let i = 0; i < tries; i++) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 25000);
            const res = await fetch(`${SYLLABUS_PREFIX}${code}.pdf`, {
                signal: ctrl.signal,
                headers: { 'User-Agent': UA }
            }).finally(() => clearTimeout(timer));
            if (res.status === 404 || res.status === 403) return false;
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const type = res.headers.get('content-type') || '';
            return /pdf|octet-stream/i.test(type);
        } catch (e) {
            if (i === tries - 1) return false;
            await new Promise(r => setTimeout(r, 600 * (i + 1)));
        }
    }
    return false;
}

async function main() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

    // Collect every placement that needs a syllabus link. The same code usually
    // appears in several branches, so verify each code once and then apply the
    // result to all of its placements.
    const placements = [];
    for (const u of db.universities || []) {
        for (const d of u.domains || []) {
            for (const b of d.branches || []) {
                for (const s of b.semesters || []) {
                    for (const sub of s.subjects || []) {
                        const code = sub.code && String(sub.code).trim();
                        if (!code) continue;
                        if (!FORCE && hasSyllabusMaterial(sub)) continue;
                        placements.push({ domain: d.id, branch: b.shortName || b.name, sem: s.id, code, sub });
                    }
                }
            }
        }
    }

    const codes = [...new Set(placements.map(p => p.code))];
    console.log(`Placements needing a syllabus link: ${placements.length}`);
    console.log(`Distinct codes to check: ${codes.length}`);
    if (DRY) console.log('[dry-run] no changes will be written');

    const ok = new Set();
    let cursor = 0;
    let checked = 0;
    async function worker() {
        while (cursor < codes.length) {
            const code = codes[cursor++];
            if (await verify(code)) ok.add(code);
            checked++;
            if (checked % 20 === 0 || checked === codes.length) {
                console.log(`  verified ${checked}/${codes.length}, ${ok.size} live`);
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    let added = 0;
    for (const p of placements) {
        if (!ok.has(p.code)) continue;
        p.sub.materials = p.sub.materials || [];
        // Guard against a syllabus entry that exists under a different label.
        if (p.sub.materials.some(m => isSyllabus(m) && String(m.link || '').includes(p.code))) continue;
        p.sub.materials.unshift({
            type: 'syllabus',
            label: 'Syllabus',
            link: `${SYLLABUS_PREFIX}${p.code}.pdf`,
            year: 'all'
        });
        added++;
    }

    const dead = codes.filter(c => !ok.has(c));
    console.log(`\nVerified live: ${ok.size} / ${codes.length}`);
    console.log(`No public syllabus PDF (left alone): ${dead.length}${dead.length ? ' -> ' + dead.slice(0, 20).join(' ') : ''}`);
    console.log(`Syllabus materials added: ${added} placement(s)`);

    if (DRY || !added) {
        console.log(DRY ? '[dry-run] done' : 'Nothing to write');
        return;
    }

    fs.writeFileSync(BACKUP_PATH, JSON.stringify(db, null, 1));
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 1));
    console.log(`\n✓ site_db.json updated (backup at ${path.relative(ROOT, BACKUP_PATH)})`);
    console.log('  next: node scripts/generate.js && node scripts/gen_sitemap.js');
}

if (require.main === module) {
    main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
}
