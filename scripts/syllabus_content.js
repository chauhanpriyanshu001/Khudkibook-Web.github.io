/**
 * Build a syllabus-content cache for every subject code on the site.
 *
 * Why this exists
 * ---------------
 * 92% of the site's subject pages rendered as "Coming Soon" shells around an
 * empty body. The pages were not empty of *links* -- every one of them links
 * the official GTU syllabus PDF -- they were empty of *content*. Google and the
 * AdSense reviewer both see a page of a title, a breadcrumb and a list of
 * sibling subjects, and score that as thin.
 *
 * The syllabus PDFs are the one source of genuinely per-subject, factual,
 * original-to-the-page content we have. This script downloads each unique code's
 * PDF once, runs it through the existing syllabus parser, and stores the result
 * in data/syllabus_content.json so the page generator can inline it as HTML.
 *
 * It is deliberately factual: units, titles, topic lists, teaching hours and
 * weightage, all read out of the official GTU document. No generated prose.
 *
 * Usage:
 *   node scripts/syllabus_content.js              # fetch whatever is missing
 *   node scripts/syllabus_content.js --limit 50   # trial run on 50 codes
 *   node scripts/syllabus_content.js --concurrency 8
 *
 * Re-running is cheap: completed codes are skipped, so the script can be
 * interrupted and resumed.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'site_db.json');
const OUT_PATH = path.join(ROOT, 'data', 'syllabus_content.json');
const CACHE_DIR = path.join(ROOT, 'data', 'syllabus_cache');
const SYL_URL = (code) => `https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/${code}.pdf`;

function arg(name, fallback) {
    const i = process.argv.indexOf(name);
    return i === -1 ? fallback : process.argv[i + 1];
}

const LIMIT = parseInt(arg('--limit', '0'), 10) || 0;
const CONCURRENCY = Math.max(1, parseInt(arg('--concurrency', '6'), 10) || 6);

/**
 * Every distinct subject code on the site, with the syllabus link recorded for
 * it. One entry per code, not per page: 17,242 subject pages share 8,104 codes,
 * so this is the unit of work that matters.
 */
function collectCodes() {
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const byCode = new Map();

    for (const u of db.universities || []) {
        for (const d of u.domains || []) {
            for (const b of d.branches || []) {
                for (const s of b.semesters || []) {
                    for (const sub of s.subjects || []) {
                        const code = sub.code && String(sub.code).trim();
                        if (!code) continue;
                        if (byCode.has(code)) continue;

                        const syl = (sub.materials || []).find(
                            (m) => String(m.type || '').toLowerCase() === 'syllabus' && /^https?:/.test(m.link || '')
                        );

                        byCode.set(code, {
                            code,
                            name: sub.name || '',
                            // Prefer the link recorded in our own database; fall
                            // back to the well-known bucket pattern.
                            syllabusUrl: (syl && syl.link) || SYL_URL(code)
                        });
                    }
                }
            }
        }
    }
    return [...byCode.values()];
}

/**
 * GTU syllabus PDFs repeat their content outline in more than one layout
 * (a numbered list, then a tabular block, then a module summary). Keeping all
 * of it produces pages with the same bullet three times, which reads as
 * keyword stuffing rather than content. Keep first occurrences only, and drop
 * entries that add no words over one already kept.
 */
function dedupeTopics(topics) {
    const seen = new Set();
    const out = [];
    for (const raw of topics) {
        const t = String(raw || '')
            .replace(/\s+/g, ' ')
            .trim();
        // Drop pure noise: numbering, page artefacts, single characters.
        if (!t || t.length < 3) continue;
        if (!/[a-z]{3}/i.test(t)) continue;
        // Strip the leading outline numbering for comparison purposes only.
        const norm = t.toLowerCase().replace(/^[\d.]+\s*/, '').replace(/[^a-z0-9]+/g, '');
        if (norm.length < 4 || seen.has(norm)) continue;
        seen.add(norm);
        out.push(t);
    }
    return out;
}

/**
 * Trim a unit to what is actually worth rendering on the page. Long topic
 * lists from scanned PDFs often run to 100+ entries of OCR noise; a page of
 * 400 bullets is no more useful than a page of 20, and it dilutes the subject.
 */
function cleanUnit(u) {
    const topics = dedupeTopics(u.topics || []).slice(0, 40);
    const uos = (u.uos || []).map((x) => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 25);
    let title = String(u.title || '').replace(/\s+/g, ' ').trim();
    // Some layouts leave the title as bare numbering or a stray page number.
    if (!title || /^\d+$/.test(title) || title.length < 3) return null;
    if (title.length > 140) title = title.slice(0, 140).trim() + '...';

    return {
        n: u.n || null,
        title,
        hours: Number.isFinite(u.hours) ? u.hours : null,
        marks: Number.isFinite(u.marks) ? u.marks : null,
        topics,
        uos
    };
}

/**
 * Words of body content on the page, used to decide whether a parsed syllabus is
 * substantial enough to be worth rendering. Below this the page stays a stub.
 */
function contentWords(units) {
    let n = 0;
    for (const u of units) {
        n += u.title ? u.title.split(/\s+/).length : 0;
        for (const t of u.topics) n += t.split(/\s+/).length;
        for (const o of u.uos) n += o.split(/\s+/).length;
    }
    return n;
}

async function fetchWithRetry(url, tries = 3) {
    let lastErr = null;
    for (let i = 0; i < tries; i++) {
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 45000);
            const res = await fetch(url, {
                signal: ctrl.signal,
                headers: { 'User-Agent': 'Khudkibook-SyllabusBot/1.0 (+https://khudkibook.in)' }
            }).finally(() => clearTimeout(timer));
            if (res.status === 404) return { missing: true };
            // The bucket answers 403 for objects that were never made public.
            // Verified per-object rather than per-client: 3130607 and 3316301
            // return 200 for the same request that gets 403 for 3326305, and the
            // status is identical with no User-Agent, a bot UA and a browser UA.
            if (res.status === 403) return { missing: true };
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return { bytes: Buffer.from(await res.arrayBuffer()) };
        } catch (e) {
            lastErr = e;
            // Back off a little between tries; the bucket throttles bursts.
            await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        }
    }
    throw lastErr || new Error('failed');
}

async function processOne(entry) {
    const cacheFile = path.join(CACHE_DIR, `${entry.code}.json`);

    // Already done in a previous run.
    if (fs.existsSync(cacheFile)) {
        try {
            return { code: entry.code, status: 'cached' };
        } catch (e) { /* fall through and refetch */ }
    }

    const { parseUnits, parseUnitsLegacy, parseUnitsDegree, parseUnitsTabular, parseUnitsCourseDetails, pdfToText } = require('./ai_book/parse_syllabus');

    const got = await fetchWithRetry(entry.syllabusUrl);
    if (got.missing) {
        fs.writeFileSync(cacheFile, JSON.stringify({ code: entry.code, status: 'missing' }));
        return { code: entry.code, status: 'missing' };
    }

    let text;
    try {
        text = await pdfToText(got.bytes);
    } catch (e) {
        fs.writeFileSync(cacheFile, JSON.stringify({ code: entry.code, status: 'unreadable', error: String(e.message).slice(0, 200) }));
        return { code: entry.code, status: 'unreadable' };
    }

    // Try every layout the parser knows, in the same order parse_syllabus.js
    // uses, and keep the first that yields units.
    let units = [];
    let layout = null;
    for (const [name, fn] of [
        ['numbered', parseUnits],
        ['legacy', parseUnitsLegacy],
        ['degree', parseUnitsDegree],
        ['tabular', parseUnitsTabular],
        ['courseDetails', parseUnitsCourseDetails]
    ]) {
        let got2 = [];
        try {
            got2 = fn(text, entry.code) || [];
        } catch (e) {
            got2 = [];
        }
        if (got2.length) {
            units = got2;
            layout = name;
            break;
        }
    }

    units = units.map(cleanUnit).filter(Boolean);
    const words = contentWords(units);

    // A parse that produced nothing, or only fragments, should leave the page
    // exactly as it was. Rendering three-word scraps as a "Syllabus" section
    // reads as machine-generated filler, which is the thing being fixed here.
    //
    // The title limit is generous because some curricula put a full descriptive
    // sentence in the title cell; cleanUnit() truncates at 140 chars, so this
    // only rejects rows that are pure noise.
    const avgTopicLen = units.length
        ? units.reduce((n, u) => n + (u.topics.length ? u.topics.reduce((m, t) => m + t.length, 0) / u.topics.length : 0), 0) / units.length
        : 0;
    const quality =
        units.length >= 2 && words >= 120 && avgTopicLen >= 12 &&
        units.every((u) => u.title.length <= 140);

    if (!quality) {
        fs.writeFileSync(cacheFile, JSON.stringify({ code: entry.code, status: 'lowquality', layout, units: units.length, words, avgTopicLen: Math.round(avgTopicLen) }));
        return { code: entry.code, status: 'lowquality' };
    }

    const payload = {
        code: entry.code,
        status: 'ok',
        name: entry.name,
        syllabusUrl: entry.syllabusUrl,
        level: null,
        layout,
        units,
        words,
        parsedAt: new Date().toISOString()
    };
    fs.writeFileSync(cacheFile, JSON.stringify(payload));
    return { code: entry.code, status: 'ok', units: units.length, words };
}

async function main() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

    const all = collectCodes();
    console.log(`Subject codes on site: ${all.length}`);
    if (LIMIT) console.log(`Limiting this run to ${LIMIT}`);

    const queue = LIMIT ? all.slice(0, LIMIT) : all;

    const stats = { ok: 0, cached: 0, missing: 0, empty: 0, unreadable: 0, error: 0 };
    let done = 0;
    const started = Date.now();

    // Simple worker pool: CONCURRENCY codes in flight at a time.
    let cursor = 0;
    async function worker() {
        while (cursor < queue.length) {
            const entry = queue[cursor++];
            try {
                const r = await processOne(entry);
                stats[r.status] = (stats[r.status] || 0) + 1;
            } catch (e) {
                stats.error++;
                console.error(`  [error] ${entry.code}: ${String(e.message).slice(0, 120)}`);
            }
            done++;
            if (done % 25 === 0 || done === queue.length) {
                const rate = done / ((Date.now() - started) / 1000);
                const eta = Math.round((queue.length - done) / Math.max(rate, 0.001));
                console.log(
                    `  ${done}/${queue.length}  ok=${stats.ok} cached=${stats.cached} missing=${stats.missing || 0} ` +
                    `empty=${stats.empty || 0} err=${stats.error}  ${rate.toFixed(1)}/s  eta ${Math.round(eta / 60)}m`
                );
            }
        }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    console.log('\nDone.', stats);

    // Roll the per-code cache files up into one file the generator reads, so it
    // does not have to open 8,000 of them on every run.
    const merged = {};
    for (const entry of all) {
        const f = path.join(CACHE_DIR, `${entry.code}.json`);
        if (!fs.existsSync(f)) continue;
        try {
            const rec = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (rec.status === 'ok') merged[entry.code] = rec;
        } catch (e) { /* skip a corrupt cache entry */ }
    }
    fs.writeFileSync(OUT_PATH, JSON.stringify(merged));
    console.log(`Merged ${Object.keys(merged).length} usable syllabus into ${path.relative(ROOT, OUT_PATH)}`);
}

if (require.main === module) {
    main().catch((e) => {
        console.error('[FATAL]', e);
        process.exit(1);
    });
}

module.exports = { collectCodes, dedupeTopics, cleanUnit, contentWords };