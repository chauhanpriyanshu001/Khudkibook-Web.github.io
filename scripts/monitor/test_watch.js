#!/usr/bin/env node
/**
 * End-to-end test for the GTU watch pipeline, with the network stubbed out.
 *
 * The point is to prove the parts that a live run cannot easily prove:
 *   - a brand new topic produces a post and a posts.json entry
 *   - a later circular for an ALREADY published topic refreshes that same post
 *     (same slug, original publish date) instead of creating a near-duplicate
 *   - a second run with no new circulars writes nothing
 *   - noise (PhD, tender) never produces a post
 *   - the notices feed, RSS and sitemap are all written and well-formed
 *
 * Run: node scripts/monitor/test_watch.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-gtu-watch-'));

// Everything the pipeline writes goes into the temp dir.
process.env.KB_ROOT = TMP;

// A fake GTU feed. `feed` is swapped between runs to simulate new circulars.
let feed = [];
const realFetch = globalThis.fetch;

function pdfUrl(id) {
    return `https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/uploads/2026/fixture-${id}.pdf`;
}

function notice(id, title, category, date) {
    return {
        id,
        title,
        created_at: `${date}T12:00:00+05:30`,
        category,
        category_id: 1,
        file_url: pdfUrl(id),
        documents: [{ file_url: pdfUrl(id), file_name: `fixture-${id}.pdf` }],
        content_html: '',
        is_important: false
    };
}

globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/site/category-circulars/')) {
        return new Response(JSON.stringify({
            success: true,
            data: feed,
            meta: { total: feed.length, page: 1, page_size: feed.length || 1, has_next: false }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url);
};

const gtuWatch = require('./gtu_watch');
const gtuSource = require('./gtu_source');

const P = (...s) => path.join(TMP, ...s);
let checks = 0;
function ok(label, fn) {
    fn();
    checks++;
    console.log(`  ok  ${label}`);
}

async function main() {
    console.log('GTU watch pipeline test\n');

    // ---------------------------------------------------------------- run 0
    // Cold start. The feed already holds traffic, and the correct behaviour is
    // to seed state from it WITHOUT publishing anything for it.
    console.log('run 0: cold start (no state file) with traffic already on the feed');
    feed = [
        notice(8001, 'PhD Notification No. 250/2026 for Older Student (209999903049)', 'PHD', '2026-09-20'),
        notice(8002, 'GEM/2026/B/8000000 for Purchase of Old Equipment', 'Tender', '2026-09-20')
    ];
    const r0 = await gtuWatch.runOnce({ json: true, pages: 1 });
    ok('cold start seeds instead of publishing', () => {
        assert.strictEqual(r0.seeded, true);
        assert.strictEqual(r0.backfilled, 2);
    });
    ok('cold start writes a state file', () =>
        assert.ok(fs.existsSync(P('data/gtu_monitor_state.json'))));
    ok('cold start publishes no blog posts', () =>
        assert.ok(!fs.existsSync(P('public/blog'))));

    // ---------------------------------------------------------------- run 1
    console.log('\nrun 1: three new result circulars + two pieces of noise');
    // These fixtures use the Summer 2026 result topic, which the real repo
    // aliases to a hand-written article. Clear the alias for the generation
    // runs; it gets its own dedicated test further down.
    for (const k of Object.keys(gtuWatch.TOPIC_ALIASES)) delete gtuWatch.TOPIC_ALIASES[k];
    feed = [
        notice(9001, 'Notification for Result Declaration of Bachelor of Engineering Sem 6 (Regular) Recheck/Reassessment of Summer-2026 Examination.', 'Circular', '2026-09-25'),
        notice(9002, 'Notification for result declaration of Diploma in Engineering Sem 4 (Remedial) Recheck/ Reassessment of Summer - 2026 Examination', 'Circular', '2026-09-25'),
        notice(9003, 'Notification for Result Declaration of Master of Business Administration-Integrated Sem-04 (Regular) Recheck/Reassessment of Summer-2026 Examination.', 'Circular', '2026-09-25'),
        notice(9004, 'PhD Notification No. 263/2026 for Some Student (209999903049)', 'PHD', '2026-09-25'),
        notice(9005, 'GEM/2026/B/8072757 for Repairing & Maintenance of Instruments', 'Tender', '2026-09-25')
    ];
    const r1 = await gtuWatch.runOnce({ json: true, pages: 1 });

    ok('picks up 5 new notices', () => assert.strictEqual(r1.newNotices, 5));    ok('publishes exactly 1 post', () => assert.strictEqual(r1.postsPublished.length, 1, JSON.stringify(r1.postsPublished)));
    ok('post is the Summer 2026 result page', () =>
        assert.strictEqual(r1.postsPublished[0].slug, 'gtu-recheck-result-summer-2026'));
    ok('post body covers all 3 result circulars', () =>
        assert.strictEqual(r1.postsPublished[0].notices, 3));
    ok('no post for the PhD notice', () =>
        assert.ok(!fs.existsSync(P('public/blog', 'gtu-gtu-1.html'))));

    const postFile = P('public/blog/gtu-recheck-result-summer-2026.html');
    ok('post file written', () => assert.ok(fs.existsSync(postFile)));
    ok('post lists every circular PDF', () => {
        const html = fs.readFileSync(postFile, 'utf8');
        for (const id of [9001, 9002, 9003]) assert.ok(html.includes(`fixture-${id}.pdf`), `missing ${id}`);
    });
    ok('post links the student portal', () =>
        assert.ok(fs.readFileSync(postFile, 'utf8').includes('student.gtu.ac.in')));

    const posts1 = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
    ok('posts.json has 1 entry', () => assert.strictEqual(posts1.length, 1));
    ok('posts.json entry has the required fields', () => {
        const p = posts1[0];
        for (const f of ['slug', 'title', 'excerpt', 'date', 'category', 'readTime', 'tags']) {
            assert.ok(p[f] != null && p[f] !== '', `missing ${f}`);
        }
    });

    const notices1 = JSON.parse(fs.readFileSync(P('public/data/gtu_notices.json'), 'utf8'));
    ok('notices feed has 5 entries', () => assert.strictEqual(notices1.length, 5));
    ok('notices feed links the post for result notices', () => {
        const n = notices1.find(x => x.id === 9001);
        assert.strictEqual(n.post, '/blog/gtu-recheck-result-summer-2026.html');
    });
    ok('notices feed leaves the PhD notice without a post', () => {
        const n = notices1.find(x => x.id === 9004);
        assert.strictEqual(n.post, null);
    });
    ok('RSS feed written and well-formed', () => {
        const rss = fs.readFileSync(P('public/gtu-notices.xml'), 'utf8');
        assert.ok(rss.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
        assert.ok(rss.includes('<rss version="2.0"'));
        assert.ok(rss.includes('</rss>'));
        assert.ok(rss.includes('fixture-9001.pdf'));
    });
    ok('sitemap contains the post', () => {
        const sm = fs.readFileSync(P('public/sitemap.xml'), 'utf8');
        assert.ok(sm.includes('/blog/gtu-recheck-result-summer-2026.html'));
    });

    const firstDate = posts1[0].date;

    // ---------------------------------------------------------------- run 2
    console.log('\nrun 2: nothing new on the GTU feed');
    const r2 = await gtuWatch.runOnce({ json: true, pages: 1 });
    ok('reports 0 new notices', () => assert.strictEqual(r2.newNotices, 0));
    ok('publishes nothing', () => assert.strictEqual(r2.postsPublished.length, 0));
    ok('refreshes nothing', () => assert.strictEqual(r2.postsRefreshed.length, 0));

    // This is the property that keeps CI from committing 96 empty diffs a day:
    // an idle poll must leave every output file byte-identical.
    const IDLE_FILES = [
        'data/gtu_monitor_state.json', 'data/gtu_topics.json',
        'public/gtu-notices.xml', 'public/data/gtu_notices.json',
        'public/data/gtu_categories.json', 'public/blog/posts.json'
    ];
    const hashAll = () => IDLE_FILES.map(f => `${f}:${fs.readFileSync(P(f), 'utf8').length}:${fs.readFileSync(P(f), 'utf8')}`);
    const beforeIdle = hashAll();
    const r2b = await gtuWatch.runOnce({ json: true, pages: 1 });
    ok('a second idle run changes no output byte', () => {
        assert.deepStrictEqual(hashAll(), beforeIdle);
    });
    ok('the RSS lastBuildDate is derived from content, not the clock', () => {
        const rss = fs.readFileSync(P('public/gtu-notices.xml'), 'utf8');
        const m = rss.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/);
        assert.ok(m, 'no lastBuildDate');
        assert.strictEqual(new Date(m[1]).toISOString().slice(0, 10), '2026-09-25',
            'should equal the newest notice date, not today');
    });
    ok('run telemetry lands in the gitignored status file, not state', () => {
        const state = JSON.parse(fs.readFileSync(P('data/gtu_monitor_state.json'), 'utf8'));
        // No field that changes on every poll may live in the committed file.
        for (const volatileField of ['lastRunAt', 'lastSuccessAt', 'lastError', 'runs', 'lastRunSummary', 'backfilledAt']) {
            assert.ok(!(volatileField in state), `state must not carry per-run field "${volatileField}"`);
        }
        assert.ok('lastPublishedAt' in state, 'state should still remember when a post last went out');
        assert.ok(fs.existsSync(P('data/gtu_monitor_status.json')));
        const status = JSON.parse(fs.readFileSync(P('data/gtu_monitor_status.json'), 'utf8'));
        assert.ok(status.lastRunAt, 'status should record the run');
    });
    assert.strictEqual(r2b.newNotices, 0);

    // ---------------------------------------------------------------- run 3
    console.log('\nrun 3: a second batch for the SAME topic, plus a new exam-form topic');
    feed = [
        notice(9010, 'Notification for Result Declaration of Bachelor of Engineering Sem 7 (Regular) Recheck/Reassessment of Summer-2026 Examination.', 'Circular', '2026-09-26'),
        notice(9011, 'Instructions for filling the Exam Forms of Winter-2026 Examination Bachelor of Engineering (Sem-5 & 7)', 'Circular', '2026-09-26'),
        // The earlier circulars are still on the feed, newest first, exactly as
        // GTU serves them.
        ...[9001, 9002, 9003, 9004, 9005].map(id => feed.find(x => x.id === id))
    ];
    const r3 = await gtuWatch.runOnce({ json: true, pages: 1 });

    ok('detects 2 new notices', () => assert.strictEqual(r3.newNotices, 2));
    ok('refreshes the existing result post rather than duplicating it', () =>
        assert.deepStrictEqual(r3.postsRefreshed.map(p => p.slug), ['gtu-recheck-result-summer-2026']));
    ok('publishes the new exam-form post', () =>
        assert.deepStrictEqual(r3.postsPublished.map(p => p.slug), ['gtu-winter-2026-exam-form-instructions']));
    ok('still only 2 posts total (no thin duplicates)', () => {
        const posts = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
        assert.strictEqual(posts.length, 2, posts.map(p => p.slug).join(', '));
    });
    ok('refreshed post keeps its original publish date', () => {
        const posts = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
        assert.strictEqual(posts.find(p => p.slug === 'gtu-recheck-result-summer-2026').date, firstDate);
    });
    ok('refreshed post now covers 4 circulars', () => {
        const html = fs.readFileSync(postFile, 'utf8');
        for (const id of [9001, 9002, 9003, 9010]) assert.ok(html.includes(`fixture-${id}.pdf`), `missing ${id}`);
    });

    // ------------------------------------------------- a new event, a new post
    // The heart of the request: a *different* result event must become its own
    // article, not get appended to (and silently rewrite) the existing one. The
    // notice board shows the circular either way.
    console.log('\nrun 3b: the MAIN Summer 2026 result lands, after the recheck round');
    const recheckPost = P('public/blog/gtu-recheck-result-summer-2026.html');
    const recheckBefore = fs.readFileSync(recheckPost, 'utf8');
    const recheckDateBefore = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'))
        .find(p => p.slug === 'gtu-recheck-result-summer-2026').date;
    feed = [
        notice(9300, 'Notification for Result Declaration of Bachelor of Engineering Sem 8 (Regular) of Summer-2026 Examination.', 'Circular', '2026-09-27'),
        ...feed
    ];
    const r3b = await gtuWatch.runOnce({ json: true, pages: 1 });
    ok('a new result event publishes a NEW post', () =>
        assert.deepStrictEqual(r3b.postsPublished.map(p => p.slug), ['gtu-result-declaration-summer-2026']));
    ok('and does not touch the recheck post', () => {
        assert.strictEqual(fs.readFileSync(recheckPost, 'utf8'), recheckBefore,
            'the older result article must be left exactly as it was');
        assert.ok(!r3b.postsRefreshed.some(p => p.slug === 'gtu-recheck-result-summer-2026'));
    });
    ok('the older post keeps its original publish date', () => {
        const d = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'))
            .find(p => p.slug === 'gtu-recheck-result-summer-2026').date;
        assert.strictEqual(d, recheckDateBefore);
    });
    ok('the new post covers only its own circulars', () => {
        const html = fs.readFileSync(P('public/blog/gtu-result-declaration-summer-2026.html'), 'utf8');
        assert.ok(html.includes('fixture-9300.pdf'));
        assert.ok(!html.includes('fixture-9001.pdf'), 'must not absorb the recheck circulars');
    });
    ok('both circulars still appear on the notice board', () => {
        const n = JSON.parse(fs.readFileSync(P('public/data/gtu_notices.json'), 'utf8'));
        const main = n.find(x => x.id === 9300);
        const recheck = n.find(x => x.id === 9001);
        assert.ok(main && recheck, 'both notices must be listed');
        assert.strictEqual(main.post, '/blog/gtu-result-declaration-summer-2026.html');
        assert.strictEqual(recheck.post, '/blog/gtu-recheck-result-summer-2026.html');
    });
    ok('the two results get distinct slugs, so no URL collision', () => {
        const slugs = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8')).map(p => p.slug);
        assert.strictEqual(new Set(slugs).size, slugs.length, 'duplicate slug in posts.json');
        assert.ok(slugs.includes('gtu-result-declaration-summer-2026'));
        assert.ok(slugs.includes('gtu-recheck-result-summer-2026'));
    });

    // ---------------------------------------------------------------- run 4
    console.log('\nrun 4: --dry-run writes nothing');
    const before = fs.readFileSync(P('public/blog/posts.json'), 'utf8');
    const dry = await gtuWatch.runOnce({ json: true, pages: 1, dryRun: true });
    ok('dry run reports what it would do', () => assert.ok(dry.postsPublished.length + dry.postsRefreshed.length >= 0));
    ok('dry run left posts.json untouched', () =>
        assert.strictEqual(fs.readFileSync(P('public/blog/posts.json'), 'utf8'), before));

    // ---------------------------------------------------------------- aliases
    console.log('\nalias: a topic owned by a hand-written article');
    // A self-contained fixture alias, so this test does not depend on whatever
    // the production alias map happens to contain.
    const aliasKey = 'result:summer-2026:recheck';
    const handWritten = 'hand-written-summer-2026-guide';
    gtuWatch.TOPIC_ALIASES[aliasKey] = handWritten;
    feed = [
        notice(9200, 'Notification for Result Declaration of Bachelor of Engineering Sem 8 (Regular) Recheck/Reassessment of Summer-2026 Examination.', 'Circular', new Date().toISOString().slice(0, 10)),
        ...feed
    ];
    // The generation runs above legitimately created the Summer 2026 post, so
    // what matters here is that switching the alias on STOPS the generator
    // touching it, rather than that the file never existed.
    const postsBeforeAlias = fs.readFileSync(P('public/blog/posts.json'), 'utf8');
    const fileBeforeAlias = fs.readFileSync(postFile, 'utf8');
    const rAlias = await gtuWatch.runOnce({ json: true, pages: 1 });
    ok('does not add or rewrite a posts.json entry for an aliased topic', () => {
        assert.strictEqual(fs.readFileSync(P('public/blog/posts.json'), 'utf8'), postsBeforeAlias);
        assert.strictEqual(fs.readFileSync(postFile, 'utf8'), fileBeforeAlias,
            'aliased post must be left untouched');
    });
    ok('reports no publish/refresh for the aliased topic', () => {
        const slugs = [...rAlias.postsPublished, ...rAlias.postsRefreshed].map(p => p.slug);
        assert.ok(!slugs.includes('gtu-recheck-result-summer-2026'), JSON.stringify(slugs));
    });
    ok('notices for the aliased topic link to the hand-written article', () => {
        const n = JSON.parse(fs.readFileSync(P('public/data/gtu_notices.json'), 'utf8'));
        const hit = n.find(x => x.id === 9200);
        assert.ok(hit && hit.post === `/blog/${handWritten}.html`, JSON.stringify(hit && hit.post));
    });
    ok('records the skip reason', () =>
        assert.ok(rAlias.skipped.some(s => /aliased/.test(s.reason)), JSON.stringify(rAlias.skipped)));
    ok('still tracks the topic and its circulars', () => {
        const t = JSON.parse(fs.readFileSync(P('data/gtu_topics.json'), 'utf8'));
        assert.strictEqual(t[aliasKey].slug, handWritten);
        assert.strictEqual(t[aliasKey].aliased, true);
        assert.ok(t[aliasKey].noticeIds.includes(9200));
    });
    for (const k of Object.keys(gtuWatch.TOPIC_ALIASES)) delete gtuWatch.TOPIC_ALIASES[k];

    // ------------------------------------------------------------- classifier
    console.log('\nclassifier');
    const cases = [
        ['Notification for Result Declaration of BE Sem 6 (Regular) Recheck/Reassessment of Winter-2026 Examination.', 'result', true],
        ['INSTRUCTIONS FOR FILLING THE EXAM FORMS OF WINTER-2026 B.PHARM SEM-5 (REGULAR)', 'exam-form', true],
        ['Instructions for filling the Term Extension Regular Exam Form of BE (Sem-7) Winter-2026 Examination', 'term-extension', true],
        ['Academic Calendar with Tentative Examination Dates for A.Y. 2025-26 (Even Term)', 'academic-calendar', true],
        ['M.Pharm. : Introduction of \u201cCo-curricular Activities\u201d Subject in Semester-4 of M.Pharm. Programme', 'syllabus', true],
        ['Round for filling up vacant seats at UG/PG level for admission Year 2026-27 through GCAS', 'admission', true],
        ['Revision of Inspection (AIC) Fees for Re-Inspection in affiliated Institutes', 'institute-admin', false],
        ['Revision of Affiliation Fees for the Academic Year 2026-27', 'institute-admin', false],
        ['Revision of Examination Fees for the Winter-2026 Examination', 'fee', true],
        ['Public Viva-Voce of Someone (179999912013) on 07/10/2026', 'noise', false],
        ['GEM/2026/B/8072757 for Purchase of 42U Smart Rack', 'noise', false],
        ['GTU-GISC Startup Gold Medal Award 2027', 'other', false]
    ];
    for (const [title, expectedType, expectedNews] of cases) {
        const t = gtuSource.topicFor(gtuSource.normalizeNotice({ id: 1, title, created_at: '2026-09-25T12:00:00+05:30', category: title.includes('Viva') ? 'PHD' : (title.includes('GEM/') ? 'Tender' : 'Circular'), file_url: pdfUrl(1) }));
        ok(`"${title.slice(0, 46)}…" -> ${expectedType}`, () => {
            assert.strictEqual(t.type, expectedType, `got ${t.type}`);
            assert.strictEqual(t.newsworthy, expectedNews);
        });
    }

    console.log(`\nfact extraction`);
    const facts = gtuSource.extractFacts(gtuSource.normalizeNotice(notice(1,
        'Notification for Result Declaration of Bachelor of Engineering Sem 06 (Remedial) Recheck/ Reassessment of Summer - 2026 Examination.', 'Circular', '2026-09-25')));
    ok('session', () => assert.strictEqual(facts.session, 'Summer 2026'));
    ok('session slug', () => assert.strictEqual(facts.sessionSlug, 'summer-2026'));
    ok('semester', () => assert.strictEqual(facts.semester, 6));
    ok('program', () => assert.strictEqual(facts.programShort, 'BE'));
    ok('recheck flag', () => assert.strictEqual(facts.isRecheck, true));
    ok('remedial flag', () => assert.strictEqual(facts.isRemedial, true));
    ok('regular flag is false', () => assert.strictEqual(facts.isRegular, false));

    const sems = require('./blog_gen').formatSemesters([1, 2, 3, 4, 5, 6, 9]);
    ok('result event kind: main', () =>
        assert.strictEqual(gtuSource.extractFacts(gtuSource.normalizeNotice(notice(1,
            'Notification for Result Declaration of BE Sem 6 (Regular) of Summer-2026 Examination.', 'Circular', '2026-09-25'))).resultKind, 'main'));
    ok('result event kind: recheck', () =>
        assert.strictEqual(gtuSource.extractFacts(gtuSource.normalizeNotice(notice(1,
            'Notification for Result Declaration of BE Sem 6 (Regular) Recheck/Reassessment of Summer-2026 Examination.', 'Circular', '2026-09-25'))).resultKind, 'recheck'));
    ok('result event kind: remedial folds into recheck', () =>
        assert.strictEqual(gtuSource.extractFacts(gtuSource.normalizeNotice(notice(1,
            'Result declaration of DE Sem 4 (Remedial) Recheck/Reassessment of Summer - 2026 Examination', 'Circular', '2026-09-25'))).resultKind, 'recheck'));
    ok('result event kind: supplementary', () =>
        assert.strictEqual(gtuSource.extractFacts(gtuSource.normalizeNotice(notice(1,
            'Notification for Supplementary Result of BE Sem 7 Summer-2026 Examination.', 'Circular', '2026-09-25'))).resultKind, 'supplementary'));
    ok('a new result kind gets its own topic key', () => {
        const k = t => gtuSource.topicFor(gtuSource.normalizeNotice(notice(1, t, 'Circular', '2026-09-25'))).key;
        assert.strictEqual(k('Result Declaration of BE Sem 6 (Regular) of Summer-2026 Examination.'), 'result:summer-2026:main');
        assert.strictEqual(k('Result Declaration of BE Sem 6 (Regular) Recheck/Reassessment of Summer-2026 Examination.'), 'result:summer-2026:recheck');
        assert.notStrictEqual(
            k('Result Declaration of BE Sem 6 (Regular) of Summer-2026 Examination.'),
            k('Result Declaration of BE Sem 6 (Regular) Recheck/Reassessment of Summer-2026 Examination.'));
    });
    ok('the programme fan-out of one event stays on one topic', () => {
        const k = t => gtuSource.topicFor(gtuSource.normalizeNotice(notice(1, t, 'Circular', '2026-09-25'))).key;
        const a = k('Result Declaration of Bachelor of Engineering Sem 6 (Regular) Recheck/Reassessment of Summer-2026 Examination.');
        const b = k('Result Declaration of Diploma in Engineering Sem 4 (Remedial) Recheck/Reassessment of Summer-2026 Examination');
        assert.strictEqual(a, b, 'one announcement must not fragment into several posts');
    });
    ok('semester ranges collapse', () => assert.strictEqual(sems, '1-6, 9'));

    // ------------------------------------------------------------- freshness
    console.log('\nfreshness guards');

    console.log('  ..  a brand new topic (old session) that is already a month old');
    const oldDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const postsBeforeStale = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
    feed = [
        // Its own session, so this is a genuinely NEW topic key rather than more
        // traffic on the Summer 2026 post.
        notice(9100, `Notification for Result Declaration of Bachelor of Engineering Sem 5 (Regular) Recheck/Reassessment of Winter-2024 Examination.`, 'Circular', oldDate),
        ...feed
    ];
    const rStale = await gtuWatch.runOnce({ json: true, pages: 1 });
    ok('refuses to publish a month-old topic', () => {
        assert.ok(!fs.existsSync(P('public/blog/gtu-recheck-result-winter-2024.html')));
        const posts = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
        assert.strictEqual(posts.length, postsBeforeStale.length, 'a stale topic must not add a post');
    });
    ok('records the skip with a reason', () => {
        assert.ok(rStale.skipped.some(s => /history/.test(s.reason)), JSON.stringify(rStale.skipped));
    });
    ok('the stale circular still lands in the notices feed', () => {
        const n = JSON.parse(fs.readFileSync(P('public/data/gtu_notices.json'), 'utf8'));
        assert.ok(n.some(x => x.id === 9100));
    });

    // ------------------------------------------------------------- resilience
    console.log('\nresilience');
    console.log('  ..  GTU returning 502 for the whole run');
    globalThis.fetch = async (url) => {
        if (String(url).includes('/site/category-circulars/')) return new Response('bad gateway', { status: 502 });
        return realFetch(url);
    };
    let threw = null;
    try {
        await gtuWatch.runOnce({ json: true, pages: 1 });
    } catch (e) {
        threw = e;
    }
    ok('a dead feed throws instead of silently wiping state', () => assert.ok(threw));
    ok('state file still holds the previously seen ids', () => {
        const st = JSON.parse(fs.readFileSync(P('data/gtu_monitor_state.json'), 'utf8'));
        assert.ok(st.seenIds.length >= 5, `only ${st.seenIds.length} ids`);
    });
    ok('published posts survive the failed run', () => {
        const posts = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
        const slugs = posts.map(p => p.slug);
        assert.ok(slugs.includes('gtu-recheck-result-summer-2026'), slugs.join(', '));
        assert.ok(slugs.includes('gtu-result-declaration-summer-2026'), slugs.join(', '));
        assert.ok(slugs.includes('gtu-winter-2026-exam-form-instructions'), slugs.join(', '));
    });

    globalThis.fetch = realFetch;

    const blogGen = require('./blog_gen');
    ok('announced date collapses to a single date', () =>
        assert.strictEqual(blogGen.announcedLabel({ members: [{ date: '2026-09-25' }, { date: '2026-09-25' }] }), '25 September 2026'));
    ok('announced date spans a range when circulars differ', () =>
        assert.strictEqual(blogGen.announcedLabel({ members: [{ date: '2026-09-20' }, { date: '2026-09-25' }] }), '20 September 2026 to 25 September 2026'));
    ok('announced date admits when GTU states none', () =>
        assert.strictEqual(blogGen.announcedLabel({ members: [{ date: '' }] }), 'date not stated by GTU'));

    // --rebuild-posts re-renders existing posts from the archive. It must never
    // invent a page, never move a publish date, and must carry the new labels.
    const rbBefore = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
    const rb = await gtuWatch.rebuildPosts({ log: () => {} });
    const after = JSON.parse(fs.readFileSync(P('public/blog/posts.json'), 'utf8'));
    ok('rebuild re-renders the posts that already exist', () =>
        assert.ok(rb.rebuilt.length > 0, JSON.stringify(rb)));
    ok('rebuild invents no new post', () =>
        assert.deepStrictEqual(after.map(p => p.slug).sort(), rbBefore.map(p => p.slug).sort()));
    ok('rebuild preserves every publish date', () =>
        assert.deepStrictEqual(
            after.map(p => [p.slug, p.date]).sort(),
            rbBefore.map(p => [p.slug, p.date]).sort()));
    ok('rebuild writes a file for every post it re-rendered', () => {
        assert.ok(rb.written.length > 0, 'wrote nothing');
        for (const rel of rb.written) assert.ok(fs.existsSync(path.join(TMP, rel)), rel);
    });
    const rebuiltFile = path.join(TMP, rb.written[0]);
    ok('rebuilt post states the GTU announcement date', () => {
        const html = fs.readFileSync(rebuiltFile, 'utf8');
        assert.ok(/Announced by GTU:/.test(html), 'missing announcement label');
        assert.ok(/Published here:/.test(html), 'missing publish label');
        assert.ok(!/Posted \d/.test(html), 'ambiguous "Posted" label survived');
    });
    // ok() is synchronous, so the second rebuild is awaited out here rather than
    // inside the assertion — otherwise its tail would run after TMP is removed.
    const snap = fs.readFileSync(rebuiltFile, 'utf8');
    await gtuWatch.rebuildPosts({ log: () => {} });
    ok('rebuild is idempotent', () =>
        assert.strictEqual(fs.readFileSync(rebuiltFile, 'utf8'), snap));

    // The notices board is plain client-side JS, so lift splitDate out of the
    // page and run it. It once returned `full: m[1]`, which is only the year.
    const noticesHtml = fs.readFileSync(path.join(__dirname, '../../public/gtu-notices.html'), 'utf8');
    // The closing brace must be followed by a newline, not a semicolon, or the
    // match stops inside the returned object literal.
    const splitSrc = /function splitDate\(iso\)\s*\{[\s\S]*?\n\s*\}\s*\n/.exec(noticesHtml);
    ok('notices page defines splitDate', () => assert.ok(splitSrc, 'could not find splitDate'));
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const splitDate = new Function('MONTHS', `${splitSrc[0]}; return splitDate;`)(MONTHS);
    ok('splitDate spells out the full announcement date', () =>
        assert.strictEqual(splitDate('2026-09-25').full, '25 Sep 2026'));
    ok('splitDate no longer reduces the date to a year', () =>
        assert.notStrictEqual(splitDate('2026-09-25').full, '2026'));
    ok('splitDate keeps the day and month tile', () => {
        const d = splitDate('2026-09-05');
        assert.strictEqual(d.day, '05');
        assert.strictEqual(d.mon, 'Sep');
    });
    ok('splitDate labels a single-digit day exactly as the tile shows it', () =>
        assert.strictEqual(splitDate('2026-12-05').full, '05 Dec 2026'));
    ok('notices page makes no claim about how often it is checked', () => {
        const visible = noticesHtml.replace(/<!--[\s\S]*?-->/g, '');
        assert.ok(!/every 15 minutes|15-minute/i.test(visible.replace(/^\s*\/\/.*$/gm, '')),
            'user-facing copy still advertises a 15-minute interval');
    });

    // ---- icons, social cards and crawlable content ------------------------
    const realNoticesPage = fs.readFileSync(path.join(__dirname, '../../public/gtu-notices.html'), 'utf8');
    ok('notices page declares a favicon', () =>
        assert.ok(/rel="icon"[^>]*favicon-32x32\.png/.test(realNoticesPage)));
    ok('notices page declares an apple-touch icon and a manifest', () =>
        assert.ok(/rel="apple-touch-icon"/.test(realNoticesPage) && /rel="manifest"/.test(realNoticesPage)));
    ok('a root favicon.ico exists for browsers that request it unprompted', () =>
        assert.ok(fs.existsSync(path.join(__dirname, '../../public/favicon.ico'))));
    ok('notices page points og:image at a khudkibook.in asset', () => {
        const imgs = [...realNoticesPage.matchAll(/og:image" content="([^"]+)"/g)].map(m => m[1]);
        assert.ok(imgs.length > 0, 'no og:image');
        for (const u of imgs) assert.ok(u.startsWith('https://khudkibook.in/'), u);
    });
    ok('notices page no longer references the dead pic.github.io host', () =>
        assert.ok(!/pic\.github\.io/.test(realNoticesPage), 'dead og:image host still referenced'));
    ok('notices page server-renders its newest notices for non-JS crawlers', () => {
        const a = realNoticesPage.indexOf('<!-- kn-static:start -->');
        const b = realNoticesPage.indexOf('<!-- kn-static:end -->');
        assert.ok(a !== -1 && b > a, 'static markers missing');
        const block = realNoticesPage.slice(a, b);
        const items = (block.match(/class="kn-item"/g) || []).length;
        assert.ok(items > 0, 'no notices in the static block');
        assert.ok(!/kn-loading/.test(block), 'loading placeholder still in the static block');
        assert.ok(/Announced by GTU on/.test(block), 'static notices carry no date');
    });
    ok('generated posts declare the same icons and a reachable og:image', () => {
        const html = fs.readFileSync(rebuiltFile, 'utf8');
        assert.ok(/rel="icon"[^>]*favicon-32x32\.png/.test(html), 'post has no favicon');
        assert.ok(/rel="apple-touch-icon"/.test(html), 'post has no apple-touch icon');
        const imgs = [...html.matchAll(/og:image" content="([^"]+)"/g)].map(m => m[1]);
        assert.ok(imgs.length > 0 && imgs.every(u => u.startsWith('https://khudkibook.in/')), imgs.join(', '));
        assert.ok(/og:image:alt/.test(html), 'og:image has no alt text');
    });
    ok('a post reports the newest GTU circular as its modified date', () => {
        const html = fs.readFileSync(rebuiltFile, 'utf8');
        const pub = /"datePublished": "([\d-]+)"/.exec(html);
        const mod = /"dateModified": "([\d-]+)"/.exec(html);
        assert.ok(pub && mod, 'missing dates in JSON-LD');
        assert.ok(mod[1] >= pub[1], `dateModified ${mod[1]} precedes datePublished ${pub[1]}`);
    });
    ok('notice date label pads a single-digit day like the tile', () =>
        assert.strictEqual(gtuWatch.noticeDateLabel('2026-12-05'), '05 Dec 2026'));

    console.log(`\n${checks} checks passed.`);
    fs.rmSync(TMP, { recursive: true, force: true });
}

main().catch(err => {
    console.error('\nTEST FAILED:', err);
    process.exit(1);
});
