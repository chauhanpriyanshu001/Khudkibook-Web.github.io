#!/usr/bin/env node
/**
 * GTU Watch — continuously monitors gtu.ac.in and pushes what it finds onto
 * Khudkibook.
 *
 * Pipeline per run:
 *   1. Poll the GTU public JSON feed for the newest circulars.
 *   2. Diff against data/gtu_monitor_state.json by notice id -> "new" notices.
 *   3. Classify each new notice into a topic (result / exam form / syllabus /
 *      calendar / admission / fees / noise).
 *   4. Merge new notices into data/gtu_notices.json (archive) and
 *      public/data/gtu_notices.json (what the website reads).
 *   5. For every newsworthy topic, write or refresh one canonical blog post and
 *      upsert it into public/blog/posts.json.
 *   6. Regenerate the notices RSS feed and public/sitemap.xml.
 *   7. Report what changed, so CI can commit and deploy.
 *
 * Modes:
 *   node scripts/monitor/gtu_watch.js              one run, human-readable log
 *   node scripts/monitor/gtu_watch.js --json       one run, JSON summary on stdout
 *   node scripts/monitor/gtu_watch.js --watch      stay alive and poll forever
 *   node scripts/monitor/gtu_watch.js --backfill N seed state with the newest N
 *                                           notices without publishing anything
 *   node scripts/monitor/gtu_watch.js --force      ignore state, republish
 *   node scripts/monitor/gtu_watch.js --dry-run    never write files
 */

const fs = require('fs');
const path = require('path');
const { fetchCirculars, enrich } = require('./gtu_source');
const blogGen = require('./blog_gen');

// KB_ROOT lets the test harness point the whole pipeline at a temp directory.
const ROOT = process.env.KB_ROOT || path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');

const STATE_FILE = path.join(DATA_DIR, 'gtu_monitor_state.json');
const TOPICS_FILE = path.join(DATA_DIR, 'gtu_topics.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'gtu_notices.json');
// Gitignored: per-run telemetry (timestamps, counters, last error). Kept out of
// the committed tree so a quiet poll produces no git diff.
const STATUS_FILE = path.join(DATA_DIR, 'gtu_monitor_status.json');
const PUBLIC_NOTICES = path.join(PUBLIC_DIR, 'data/gtu_notices.json');
const PUBLIC_CATEGORIES = path.join(PUBLIC_DIR, 'data/gtu_categories.json');
const POSTS_FILE = path.join(PUBLIC_DIR, 'blog/posts.json');
const BLOG_DIR = path.join(PUBLIC_DIR, 'blog');
const RSS_FILE = path.join(PUBLIC_DIR, 'gtu-notices.xml');
const SITEMAP = path.join(PUBLIC_DIR, 'sitemap.xml');

const SITE_URL = 'https://khudkibook.in';

// Topics that already have a hand-written article which is better than anything
// the generator would produce. The generator must not emit a rival page for
// these — two pages chasing the same keyword is worse than one good page — but
// the notices feed should still point readers at the hand-written guide.
//
// Key is the topic key from gtu_source.topicFor(); value is the existing slug.
// Empty by default: results are owned by the generator, which now publishes a
// NEW post per result event (see gtu_source resultKind) instead of appending to
// an old one. Add an entry here only for a page you wrote by hand.
const TOPIC_ALIASES = {};

// How many notices the website ships. The archive keeps everything.
const PUBLIC_NOTICE_LIMIT = 400;
// Cap on remembered ids, so the state file cannot grow without bound.
const SEEN_ID_LIMIT = 4000;
const MAX_SEEN_AGE_DAYS = 120;

const DEFAULTS = {
    pages: 2,
    intervalMinutes: 15,
    maxPostsPerRun: 4,
    // A topic whose newest circular is older than this is history, not news.
    // Without this guard a cold start (empty state, deeper pages fetched for the
    // first time) would happily publish a post about a result from last year.
    maxTopicAgeDays: 10
};

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/**
 * Write only when the serialised bytes actually differ.
 *
 * This is what makes an idle poll a genuine no-op for git. Without it every
 * 15-minute CI run rewrites identical content (or content differing only in a
 * timestamp) and the workflow commits 96 empty diffs a day.
 */
function writeJSONIfChanged(file, data) {
    const next = JSON.stringify(data, null, 2);
    if (readJSON(file, null) !== null && fs.readFileSync(file, 'utf8') === next) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    return true;
}

/** Run telemetry that must never reach the committed tree. */
function writeStatus(patch) {
    try {
        writeJSON(STATUS_FILE, Object.assign(readJSON(STATUS_FILE, {}), patch));
    } catch (e) {
        // Telemetry is best-effort; never fail a run over it.
    }
}

function loadState() {
    const s = readJSON(STATE_FILE, null);
    if (s && Array.isArray(s.seenIds)) return s;
    return { seenIds: [], lastMaxId: 0, lastPublishedAt: null, published: 0 };
}

function loadTopics() {
    const t = readJSON(TOPICS_FILE, null);
    if (t && typeof t === 'object' && !Array.isArray(t)) return t;
    return {};
}

/** Union of stored notice ids and the ids referenced by published topics. */
function knownIds(state, topics) {
    const set = new Set(state.seenIds.map(Number).filter(Number.isFinite));
    for (const t of Object.values(topics)) {
        if (!t || !Array.isArray(t.noticeIds)) continue;
        for (const id of t.noticeIds) set.add(Number(id));
    }
    return set;
}

function pruneSeenIds(ids) {
    const sorted = Array.from(new Set(ids.map(Number).filter(Number.isFinite)))
        .sort((a, b) => b - a)
        .slice(0, SEEN_ID_LIMIT);
    return sorted;
}

function archiveMerge(existing, incoming, cap = 5000) {
    const byId = new Map();
    for (const n of existing) if (n && n.id != null) byId.set(Number(n.id), n);
    for (const n of incoming) if (n && n.id != null) byId.set(Number(n.id), n);
    return Array.from(byId.values())
        .sort((a, b) => String(b.postedAt || b.date || '').localeCompare(String(a.postedAt || a.date || '')) || b.id - a.id)
        .slice(0, cap);
}

function pruneArchive(archive) {
    const cutoff = new Date(Date.now() - MAX_SEEN_AGE_DAYS * 86400000).toISOString().slice(0, 10);
    const keep = archive.filter(n => (n.date || '') >= cutoff);
    return keep.length ? keep : archive.slice(0, PUBLIC_NOTICE_LIMIT);
}

/** The shape public/data/gtu_notices.json is trimmed down to. */
function toPublicNotice(n) {
    return {
        id: n.id,
        title: n.title,
        date: n.date,
        postedAt: n.postedAt,
        category: n.category,
        topic: n.topic ? n.topic.type : 'other',
        link: n.link,
        documents: n.documents || [],
        important: !!n.important,
        post: n.post || null
    };
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function escHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** "25 Sep 2026" from "2026-09-25". Mirrors splitDate() in the notices page. */
function noticeDateLabel(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return String(iso || '');
    return `${m[3]} ${MONTHS_SHORT[Number(m[2]) - 1] || ''} ${m[1]}`;
}

/**
 * Write the newest notices straight into gtu-notices.html between the
 * kn-static markers. The page otherwise builds its list in JavaScript, so a
 * crawler that does not run scripts — and any reader with JS disabled — would
 * see an empty page. The client script replaces this block on load, so the
 * interactive behaviour is unchanged.
 */
function renderNoticesIntoPage(notices, limit = 25) {
    const page = path.join(PUBLIC_DIR, 'gtu-notices.html');
    if (!fs.existsSync(page)) return null;

    const start = '<!-- kn-static:start -->';
    const end = '<!-- kn-static:end -->';
    const html = fs.readFileSync(page, 'utf8');
    const a = html.indexOf(start);
    const b = html.indexOf(end);
    if (a === -1 || b === -1 || b < a) return null;

    const items = notices.slice(0, limit).map(n => {
        const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(n.date || ''));
        const day = d ? d[3] : '--';
        const mon = d ? (MONTHS_SHORT[Number(d[2]) - 1] || '') : '';
        const pdf = (n.documents && n.documents.length) ? n.documents[0].url : n.link;
        const cat = n.category || 'General';
        return `          <div class="kn-item">
            <div class="kn-when"><div class="kn-day">${escHtml(day)}</div><div class="kn-mon">${escHtml(mon)}</div></div>
            <div class="kn-body">
              <h3>${escHtml(n.title)}</h3>
              <div class="kn-meta">
                <span class="kn-cat">${escHtml(cat)}</span>
                <span>Announced by GTU on ${escHtml(noticeDateLabel(n.date))}</span>
              </div>
              <div class="kn-acts">
                ${pdf ? `<a class="kn-btn kn-btn-pdf" href="${escHtml(pdf)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-file-pdf"></i> Official PDF</a>` : ''}
                ${n.post ? `<a class="kn-btn kn-btn-post" href="${escHtml(n.post)}"><i class="fas fa-newspaper"></i> Read our guide</a>` : ''}
              </div>
            </div>
          </div>`;
    }).join('\n');

    // Everything between the markers is replaced, so the previous build's
    // static list (or the loading placeholder) never lingers.
    const out = html.slice(0, a + start.length) + '\n' + items + '\n          ' + html.slice(b);
    if (out === html) return null;
    fs.writeFileSync(page, out);
    return path.relative(ROOT, page);
}

function buildRss(notices) {
    const items = notices.slice(0, 100).map(n => {
        const link = n.link || n.sourcePage || 'https://gtu.ac.in/academics/circulars';
        const guid = `${SITE_URL}/gtu-notices.html#n${n.id}`;
        return `    <item>
      <title>${xmlEsc(n.title)}</title>
      <link>${xmlEsc(guid)}</link>
      <guid isPermaLink="false">${xmlEsc(guid)}</guid>
      <pubDate>${new Date((n.postedAt || n.date || Date.now() / 1000) + '').toUTCString()}</pubDate>
      <category>${xmlEsc(n.category || 'General')}</category>
      <description>${xmlEsc(`${n.title} — official GTU circular. Source: ${link}`)}</description>
    </item>`;
    }).join('\n');

    // Derived from the newest item, NOT the wall clock. A wall-clock build date
    // would change on every poll and dirty the tree every 15 minutes.
    const newest = notices.reduce((a, n) => {
        const t = Date.parse((n.postedAt || n.date || '') + '');
        return Number.isFinite(t) && t > a ? t : a;
    }, 0);

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GTU Notices — Khudkibook</title>
    <link>${SITE_URL}/gtu-notices.html</link>
    <atom:link href="${SITE_URL}/gtu-notices.xml" rel="self" type="application/rss+xml" />
    <description>Official Gujarat Technological University circulars, results, exam forms and syllabus updates — monitored from the GTU feed and published within minutes. GTU records no clock time on its circulars, so the timestamp on each item is the date GTU announced it, not the moment Khudkibook checked.</description>
    <language>en-in</language>
    <lastBuildDate>${new Date(newest || Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function xmlEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // XML 1.0 forbids most control characters outright.
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

async function runOnce(opts = {}) {
    const log = opts.json ? () => {} : (m => console.log(m));
    const pages = opts.pages || DEFAULTS.pages;
    const maxPosts = opts.maxPosts == null ? DEFAULTS.maxPostsPerRun : opts.maxPosts;
    const maxTopicAgeDays = opts.maxTopicAgeDays == null ? DEFAULTS.maxTopicAgeDays : opts.maxTopicAgeDays;

    // Cold start: no state file yet. Seed from the feed instead of publishing,
    // so the first run on a fresh checkout does not emit posts about circulars
    // that are already weeks or months old. Pass --force to publish anyway.
    if (!fs.existsSync(STATE_FILE) && !opts.force) {
        log('[watch] no state file — seeding from the GTU feed without publishing');
        const seed = await backfill(pages * 50, { log, dryRun: opts.dryRun });
        return { ok: true, seeded: true, ...seed, published: [], postsPublished: [], postsRefreshed: [], written: [], skipped: [] };
    }

    const state = loadState();
    const topics = loadTopics();

    log(`[watch] polling GTU (${pages} page(s) of 50)…`);
    const fetched = await fetchCirculars(pages, { log: opts.json ? () => {} : (m) => console.log(m) });
    log(`[watch] fetched ${fetched.length} notice(s)`);

    const enriched = fetched.map(enrich);
    const known = opts.force ? new Set() : knownIds(state, topics);

    const fresh = enriched.filter(n => !known.has(n.id));
    if (fresh.length === 0) log('[watch] no new notices');

    const existingArchive = readJSON(ARCHIVE_FILE, []);
    const archiveBefore = Array.isArray(existingArchive) ? existingArchive : [];

    // A poll only sees the newest N notices, so re-attach earlier circulars to
    // their topics — otherwise refreshing a post would drop the PDFs it listed
    // last time round.
    const groups = blogGen.buildGroups(enriched);
    blogGen.expandGroups(groups, archiveBefore);
    const newsworthy = groups.filter(g => g.newsworthy);
    log(`[watch] ${fresh.length} new notice(s), ${groups.length} topic(s), ${newsworthy.length} newsworthy`);

    const result = {
        ok: true,
        fetched: fetched.length,
        newNotices: fresh.length,
        topics: groups.length,
        newsworthyTopics: newsworthy.length,
        postsPublished: [],
        postsRefreshed: [],
        written: [],
        skipped: []
    };

    if (opts.dryRun) {
        const ageCutoffDry = new Date(Date.now() - maxTopicAgeDays * 86400000).toISOString().slice(0, 10);
        for (const g of newsworthy) {
            if (g.latestDate && g.latestDate < ageCutoffDry) {
                result.skipped.push({ key: g.key, type: g.type, reason: `history — newest circular is ${g.latestDate}` });
                continue;
            }
            const entry = { slug: g.slug, type: g.type, notices: g.members.length, title: blogGen.titleFor(g), newCirculars: g.members.filter(m => !known.has(m.id)).length };
            (topics[g.key] ? result.postsRefreshed : result.postsPublished).push(entry);
        }
        return result;
    }

    // ---- 1. Archive ---------------------------------------------------------
    const archive = archiveMerge(archiveBefore, enriched);
    writeJSON(ARCHIVE_FILE, archive);
    result.written.push(path.relative(ROOT, ARCHIVE_FILE));

    // ---- 2. Publish blog posts for newsworthy topics -----------------------
    // Newest / highest priority first, and capped per run so one busy afternoon
    // cannot flood the site.
    const ageCutoff = new Date(Date.now() - maxTopicAgeDays * 86400000).toISOString().slice(0, 10);
    const publishable = newsworthy
        .filter(g => {
            if (g.latestDate && g.latestDate < ageCutoff) {
                result.skipped.push({ key: g.key, type: g.type, reason: `history — newest circular is ${g.latestDate}, older than ${maxTopicAgeDays} days` });
                return false;
            }
            if (TOPIC_ALIASES[g.key]) {
                // A hand-written article already owns this keyword. Record the
                // topic (so notices link to it) but never generate a rival page.
                result.skipped.push({ key: g.key, reason: `aliased to hand-written /blog/${TOPIC_ALIASES[g.key]}.html` });
                return false;
            }
            const t = topics[g.key];
            const isNewTopic = !t;
            const hasNew = g.members.some(m => !known.has(m.id));
            if (!isNewTopic && !hasNew) {
                result.skipped.push({ key: g.key, reason: 'no new circulars for this topic' });
                return false;
            }
            return true;
        })
        .slice(0, Math.max(0, maxPosts));

    for (const g of publishable) {
        const prevMeta = (readJSON(POSTS_FILE, []) || []).find(p => p.slug === g.slug) || null;
        // Preserve the original publish date across refreshes.
        g.publishDate = (prevMeta && prevMeta.date) || blogGen.today();

        const post = blogGen.buildPost(g);
        if (!post) {
            result.skipped.push({ key: g.key, reason: `no writer for topic type "${g.type}"` });
            continue;
        }
        const file = path.join(BLOG_DIR, `${g.slug}.html`);
        const existed = fs.existsSync(file);

        fs.mkdirSync(BLOG_DIR, { recursive: true });
        fs.writeFileSync(file, post.html);
        blogGen.upsertPostMeta(post, POSTS_FILE);
        result.written.push(path.relative(ROOT, file));

        topics[g.key] = {
            key: g.key,
            type: g.type,
            slug: g.slug,
            title: post.title,
            noticeIds: Array.from(new Set([...(topics[g.key] ? topics[g.key].noticeIds : []), ...g.members.map(m => m.id)])),
            firstSeen: (topics[g.key] && topics[g.key].firstSeen) || new Date().toISOString(),
            lastPublished: new Date().toISOString()
        };

        const entry = { slug: g.slug, type: g.type, notices: g.members.length, title: post.title, url: `/blog/${g.slug}.html` };
        if (existed) result.postsRefreshed.push(entry);
        else result.postsPublished.push(entry);
        log(`[watch] ${existed ? 'refreshed' : 'published'} /blog/${g.slug}.html (${g.members.length} circular(s))`);
    }

    // Aliased topics still need a topics[] row so step 3 can point their
    // notices at the hand-written article instead of leaving them unlinked.
    for (const g of newsworthy) {
        const alias = TOPIC_ALIASES[g.key];
        if (!alias) continue;
        const prev = topics[g.key];
        topics[g.key] = {
            key: g.key,
            type: g.type,
            slug: alias,
            title: prev ? prev.title : blogGen.titleFor(g),
            aliased: true,
            noticeIds: Array.from(new Set([...(prev ? prev.noticeIds : []), ...g.members.map(m => m.id)])),
            firstSeen: (prev && prev.firstSeen) || new Date().toISOString(),
            lastPublished: (prev && prev.lastPublished) || new Date().toISOString()
        };
    }
    writeJSON(TOPICS_FILE, topics);

    // ---- 3. Website notice feed -------------------------------------------
    const slugByTopicKey = new Map(Object.values(topics).map(t => [t.key, t.slug]));
    const publicNotices = pruneArchive(archive).slice(0, PUBLIC_NOTICE_LIMIT).map(n => {
        const key = n.topic && n.topic.key;
        return toPublicNotice({ ...n, post: key && slugByTopicKey.has(key) ? `/blog/${slugByTopicKey.get(key)}.html` : null });
    });
    writeJSON(PUBLIC_NOTICES, publicNotices);
    result.written.push(path.relative(ROOT, PUBLIC_NOTICES));

    // ---- 4. RSS ------------------------------------------------------------
    fs.writeFileSync(RSS_FILE, buildRss(publicNotices));
    result.written.push(path.relative(ROOT, RSS_FILE));

    // ---- 4b. Server-render the newest notices into the page ---------------
    // Keeps the board readable for crawlers and no-JS visitors; the client
    // script takes over from there.
    const pageTouched = renderNoticesIntoPage(publicNotices);
    if (pageTouched) result.written.push(pageTouched);

    // ---- 5. Category list (used by the notices page filter) ---------------
    const catMap = new Map();
    for (const n of archive) {
        if (!n.category) continue;
        if (!catMap.has(n.category)) catMap.set(n.category, { name: n.category, count: 0 });
        catMap.get(n.category).count++;
    }
    writeJSON(PUBLIC_CATEGORIES, Array.from(catMap.values()).sort((a, b) => b.count - a.count));
    result.written.push(path.relative(ROOT, PUBLIC_CATEGORIES));

    // ---- 6. Sitemap --------------------------------------------------------
    try {
        const { execFileSync } = require('child_process');
        // Resolved from __dirname, not ROOT: with KB_ROOT pointed at a temp tree
        // there is no scripts/ directory there, but gen_sitemap.js itself honours
        // KB_ROOT and so still writes to the right public/sitemap.xml.
        execFileSync(process.execPath, [path.join(__dirname, '../gen_sitemap.js')], { stdio: 'pipe' });
        result.written.push(path.relative(ROOT, SITEMAP));
    } catch (e) {
        // A stale sitemap is not worth failing the whole run over, but it must
        // not vanish silently either — CI only sees stdout.
        log(`[watch] sitemap regen failed: ${e.message}`);
        result.warnings = (result.warnings || []).push(`sitemap regen failed: ${e.message}`);
    }

    // ---- 7. State ----------------------------------------------------------
    // gtu_monitor_state.json holds only what the system needs to remember across
    // runs, so an idle poll leaves it byte-identical and git sees no change.
    // Run-by-run telemetry (timestamps, counters, last error) goes to
    // gtu_monitor_status.json, which is gitignored — otherwise CI would commit
    // a diff 96 times a day for 96 empty polls.
    const allIds = pruneSeenIds([...state.seenIds, ...fetched.map(n => n.id)]);
    const nextState = {
        seenIds: allIds,
        lastMaxId: Math.max(state.lastMaxId || 0, ...fetched.map(n => n.id), 0),
        published: (state.published || 0) + result.postsPublished.length,
        lastPublishedAt: result.postsPublished.length ? new Date().toISOString() : state.lastPublishedAt
    };
    writeJSONIfChanged(STATE_FILE, nextState);
    writeJSONIfChanged(TOPICS_FILE, topics);
    result.written.push(path.relative(ROOT, STATE_FILE), path.relative(ROOT, TOPICS_FILE));

    writeStatus({
        lastRunAt: new Date().toISOString(),
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        lastRunSummary: {
            fetched: result.fetched,
            newNotices: result.newNotices,
            published: result.postsPublished.length,
            refreshed: result.postsRefreshed.length
        }
    });

    log(`[watch] done — ${result.postsPublished.length} new post(s), ${result.postsRefreshed.length} refreshed, ${result.newNotices} new notice(s)`);
    return result;
}

/** Seed state from the newest N notices without publishing anything. */
async function backfill(n, opts = {}) {
    const log = opts.log || (m => console.log(m));
    const fetched = await fetchCirculars(Math.max(1, Math.ceil(n / 50)), { log });
    const prev = loadState();
    const state = {
        seenIds: pruneSeenIds(fetched.map(x => x.id)),
        lastMaxId: Math.max(...fetched.map(x => x.id), 0),
        published: prev.published || 0,
        lastPublishedAt: prev.lastPublishedAt || null
    };
    if (!opts.dryRun) writeJSONIfChanged(STATE_FILE, state);
    writeStatus({ lastRunAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), lastError: null, backfilledCount: fetched.length });
    log(`[watch] backfilled state with ${fetched.length} notice(s); nothing published.`);
    return { backfilled: fetched.length, maxId: state.lastMaxId };
}

async function watchLoop(opts = {}) {
    const minutes = opts.intervalMinutes || DEFAULTS.intervalMinutes;
    const log = opts.log || (m => console.log(m));
    log(`[watch] entering watch loop, every ${minutes} minute(s). Ctrl-C to stop.`);

    let stopping = false;
    const stop = () => {
        if (stopping) return;
        stopping = true;
        log('\n[watch] stopping…');
        process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    while (!stopping) {
        try {
            await runOnce({ ...opts, watch: true });
        } catch (e) {
            console.error(`[watch] run failed: ${e.message}`);
            // Record the failure so a broken feed is visible in the repo state.
            const state = loadState();
            state.lastRunAt = new Date().toISOString();
            state.lastError = { message: e.message, at: state.lastRunAt };
            state.runs = (state.runs || 0) + 1;
            try { writeJSON(STATE_FILE, state); } catch (_) { /* ignore */ }
        }
        // Jitter so many runners never line up on the same second.
        const jitterMs = Math.floor(Math.random() * 30000);
        const sleepMs = minutes * 60000 + jitterMs;
        log(`[watch] next run in ${Math.round(sleepMs / 1000)}s`);
        await new Promise(r => setTimeout(r, sleepMs));
    }
}

/**
 * Re-render every post that already exists, from the saved notice archive and
 * the current template. A normal run only touches a post when a new circular
 * lands, so editing blog_gen.js would otherwise never reach the live site until
 * GTU happened to post something. This path never fetches GTU, never invents a
 * new post and never changes a publish date, so it is safe to run at any time.
 */
async function rebuildPosts({ log = () => {}, dryRun = false } = {}) {
    const archive = readJSON(ARCHIVE_FILE, []) || [];
    const posts = readJSON(POSTS_FILE, []) || [];
    if (!Array.isArray(archive) || !archive.length) {
        log('[rebuild] notice archive is empty — nothing to rebuild');
        return { ok: true, rebuilt: [], written: [], skipped: [] };
    }

    // Restrict to slugs that are already published, so a template change can
    // never bring a suppressed or history topic back to life.
    const wanted = new Set(posts.map(p => p.slug));
    const groups = blogGen.buildGroups(archive).filter(g => wanted.has(g.slug));

    const result = { ok: true, rebuilt: [], written: [], skipped: [] };
    for (const g of groups) {
        const prev = posts.find(p => p.slug === g.slug) || null;
        g.publishDate = (prev && prev.date) || blogGen.today();

        const post = blogGen.buildPost(g);
        if (!post) {
            result.skipped.push({ key: g.key, reason: `no writer for topic type "${g.type}"` });
            continue;
        }
        if (!dryRun) {
            const file = path.join(BLOG_DIR, `${g.slug}.html`);
            fs.mkdirSync(BLOG_DIR, { recursive: true });
            fs.writeFileSync(file, post.html);
            blogGen.upsertPostMeta(post, POSTS_FILE);
            result.written.push(path.relative(ROOT, file));
        }
        result.rebuilt.push({ slug: g.slug, notices: g.members.length });
    }

    // Anything in posts.json that the monitor does not own is a hand-written
    // article. Say so plainly, so "skipped" never reads as a lost circular.
    const owned = new Set(Object.values(loadTopics()).map(t => t.slug));
    const missing = [...wanted].filter(s => !result.rebuilt.some(r => r.slug === s));
    for (const slug of missing) {
        result.skipped.push(owned.has(slug)
            ? { slug, reason: 'no archived circulars for this post' }
            : { slug, reason: 'hand-written post, not generated by the monitor' });
    }
    log(`[rebuild] ${result.rebuilt.length} post(s) re-rendered, ${result.skipped.length} skipped`);
    return result;
}

function parseArgs(argv) {
    const opts = { json: false, watch: false, force: false, dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--json') opts.json = true;
        else if (a === '--watch') opts.watch = true;
        else if (a === '--force') opts.force = true;
        else if (a === '--dry-run') opts.dryRun = true;
        else if (a === '--pages') opts.pages = parseInt(argv[++i], 10);
        else if (a === '--interval') opts.intervalMinutes = parseInt(argv[++i], 10);
        else if (a === '--max-posts') opts.maxPosts = parseInt(argv[++i], 10);
        else if (a === '--backfill') opts.backfill = parseInt(argv[++i], 10);
        else if (a === '--rebuild-posts') opts.rebuildPosts = true;
        else if (a === '--help' || a === '-h') opts.help = true;
    }
    return opts;
}

const HELP = `
GTU Watch — monitor gtu.ac.in and publish updates to Khudkibook

  node scripts/monitor/gtu_watch.js                  run once
  node scripts/monitor/gtu_watch.js --json           run once, JSON summary only
  node scripts/monitor/gtu_watch.js --watch          poll forever (default every 15 min)
  node scripts/monitor/gtu_watch.js --watch --interval 5
  node scripts/monitor/gtu_watch.js --pages 3        pull 3 x 50 notices
  node scripts/monitor/gtu_watch.js --max-posts 2    cap posts published per run
  node scripts/monitor/gtu_watch.js --dry-run        show what would happen, write nothing
  node scripts/monitor/gtu_watch.js --backfill 100   seed state with newest 100, publish nothing
  node scripts/monitor/gtu_watch.js --rebuild-posts  re-render existing posts after a template edit
  node scripts/monitor/gtu_watch.js --force          ignore state and republish
`;

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
        console.log(HELP);
        return;
    }
    if (opts.backfill) {
        await backfill(opts.backfill, { log: opts.json ? () => {} : console.log, dryRun: opts.dryRun });
        return;
    }
    if (opts.rebuildPosts) {
        const r = await rebuildPosts({ log: opts.json ? () => {} : console.log, dryRun: opts.dryRun });
        if (opts.json) console.log(JSON.stringify(r, null, 2));
        return;
    }
    if (opts.watch) {
        await watchLoop(opts);
        return;
    }
    const result = await runOnce(opts);
    if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('[watch] FATAL', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = { runOnce, backfill, rebuildPosts, renderNoticesIntoPage, noticeDateLabel, watchLoop, loadState, loadTopics, STATE_FILE, TOPICS_FILE, ARCHIVE_FILE, PUBLIC_NOTICES, RSS_FILE, DEFAULTS, TOPIC_ALIASES };
