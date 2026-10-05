/**
 * Regenerates public/sitemap.xml from the generated HTML files.
 * Uses each page's canonical URL so slug duplicates and aliases are
 * automatically collapsed, and skips noindex pages (login, signup, 404, etc.).
 *
 * Usage: node scripts/gen_sitemap.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cleanUrl, isThinPlaceholder } = require('./lib/seo');

// KB_ROOT lets the monitor's test harness regenerate a sitemap for a temp tree
// instead of the live public/ directory.
const ROOT_DIR = process.env.KB_ROOT || path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');
const DB_PATH = path.join(ROOT_DIR, 'data', 'site_db.json');

let SITE_URL = 'https://khudkibook.in';
try {
    if (fs.existsSync(DB_PATH)) {
        const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        if (db && db.config && db.config.siteUrl) {
            SITE_URL = db.config.siteUrl.replace(/\/+$/, '');
        }
    }
} catch (e) {
    console.warn('Could not read siteUrl from site_db.json, using fallback:', SITE_URL);
}

const SKIP_DIRS = new Set(['templates', 'data', 'assets', 'icons']);

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        const rel = path.relative(PUBLIC_DIR, abs);
        const first = rel.split(path.sep)[0];
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(first)) continue;
            walk(abs, out);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
            out.push(abs);
        }
    }
    return out;
}

function extractCanonical(html) {
    const m = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
    return m ? m[1] : null;
}

function isNoindex(html) {
    const m = html.match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
    return !!m && /noindex/i.test(m[1]);
}

// A page is a "thin placeholder" when its book material is still a "Coming Soon"
// stub with no real book or paper link. Such pages add no unique value and drag
// down content quality signals, so they stay out of the sitemap; `noindex_pass`
// puts the matching directive in the page itself.
// Only generated subject pages qualify -- never blog posts, indexes or other
// pages, which may legitimately mention "Coming Soon" or ship it inside inline
// scripts.

function w3cDate(ms) {
    return new Date(ms).toISOString().split('T')[0];
}

// Priority/changefreq are matched against clean (slashless) paths, since that is
// the form every <loc> now carries.
function priorityFor(loc, isRoot) {
    const pathOnly = loc.replace(SITE_URL, '');
    if (isRoot || loc === SITE_URL + '/') return '1.0';
    if (/^\/(syllabus|papers|ddcet)$/.test(pathOnly)) return '0.9';
    // The live GTU notices page is the site's news surface and is rewritten
    // whenever GTU publishes a circular, so it deserves to be recrawled often.
    if (/^\/gtu-notices$/.test(pathOnly)) return '0.9';
    if (/homepage$/.test(pathOnly)) return '0.8';
    return '0.6';
}

function changeFreqFor(loc, isRoot) {
    const pathOnly = loc.replace(SITE_URL, '');
    if (isRoot || loc === SITE_URL + '/') return 'weekly';
    if (/^\/gtu-notices$/.test(pathOnly)) return 'hourly';
    if (/homepage$/.test(pathOnly)) return 'weekly';
    return 'monthly';
}

const files = walk(PUBLIC_DIR);
const seen = new Map();

/**
 * The file that actually answers a canonical URL once cleanUrls has redirected
 * the `.html` form away.
 */
function servedFileFor(canonical) {
    const rel = canonical.slice(SITE_URL.length).replace(/^\/+/, '');
    if (!rel) return path.join(PUBLIC_DIR, 'index.html');
    const direct = path.join(PUBLIC_DIR, `${rel}.html`);
    if (fs.existsSync(direct)) return direct;
    return path.join(PUBLIC_DIR, rel, 'index.html');
}

for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (isNoindex(html)) continue;
    let canonical = extractCanonical(html);
    if (!canonical) continue;

    // Normalize domain to SITE_URL
    canonical = canonical.replace(/^https?:\/\/(?:www\.)?(?:khudkibook\.in|khudkibook\.web\.app|khudkibook\.com)/i, SITE_URL);
    if (!canonical.startsWith(SITE_URL)) continue;

    // Firebase cleanUrls 301s every `.html` to its slashless form, so a `.html`
    // <loc> would submit a redirect for every URL on the site. Normalize to the
    // form that actually answers 200. This also folds `/index.html` into `/`.
    canonical = cleanUrl(canonical, SITE_URL);
    if (!canonical.startsWith(SITE_URL)) continue;
    if (seen.has(canonical)) continue;

    // Judge the page that will actually be served at this URL, not whichever
    // alias happened to be walked first. A code-named twin can carry real
    // material while the slug-named file it canonicalises to is an empty stub;
    // submitting the canonical in that state would advertise a Coming Soon page.
    const served = servedFileFor(canonical);
    if (!fs.existsSync(served)) continue;
    const servedHtml = served === file ? html : fs.readFileSync(served, 'utf8');
    if (isNoindex(servedHtml) || isThinPlaceholder(servedHtml)) continue;

    seen.set(canonical, served);
}

/**
 * When each file's CONTENT last changed, from git history.
 *
 * Deliberately not fs.mtime: `actions/checkout` writes every file fresh on each
 * CI run, so an mtime-based <lastmod> is rewritten with the checkout time every
 * 15 minutes. That makes the sitemap dirty on every run (a commit and a 33k-file
 * Firebase deploy each time) and, worse, tells search engines every page on the
 * site changed just now.
 *
 * One `git log` pass builds the whole map, so this costs ~0.3s rather than a
 * subprocess per file. Files git has never seen (freshly generated) fall back to
 * their mtime, which is correct for them: they genuinely are new.
 */
function buildLastmodMap() {
    const map = new Map();
    let out = '';
    try {
        out = execFileSync('git', ['log', '--pretty=format:%cI', '--name-only', '--no-merges'], {
            cwd: ROOT_DIR,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } catch (e) {
        // No git available (tarball export, fresh shallow CI checkout with no
        // history). Fall back to mtimes rather than failing the build.
        return null;
    }
    let date = null;
    for (const line of out.split('\n')) {
        if (!line) { date = null; continue; }
        if (/^\d{4}-\d{2}-\d{2}T/.test(line)) { date = line.trim(); continue; }
        if (!date) continue;
        // git log walks newest-first, so the first sighting of a path is the most
        // recent commit that touched it.
        if (!map.has(line)) map.set(line, date);
    }
    return map;
}

const lastmodByPath = buildLastmodMap();
const lastmodFor = (file, fallbackMs) => {
    if (!lastmodByPath) return fallbackMs;
    const rel = path.relative(ROOT_DIR, file);
    const iso = lastmodByPath.get(rel);
    if (iso) {
        const t = Date.parse(iso);
        if (Number.isFinite(t)) return t;
    }
    return fallbackMs;
};

const entries = [...seen.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([loc, file]) => {
        const isRoot = loc === SITE_URL + '/';
        let mtime;
        try {
            mtime = lastmodFor(file, fs.statSync(file).mtimeMs);
        } catch (e) {
            mtime = Date.now();
        }
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${w3cDate(mtime)}</lastmod>\n    <changefreq>${changeFreqFor(loc, isRoot)}</changefreq>\n    <priority>${priorityFor(loc, isRoot)}</priority>\n  </url>`;
    });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

fs.writeFileSync(SITEMAP_PATH, xml);
console.log(`Sitemap written: ${SITEMAP_PATH} (${seen.size} URLs)`);