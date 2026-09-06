/**
 * Regenerates public/sitemap.xml from the generated HTML files.
 * Uses each page's canonical URL so slug duplicates and aliases are
 * automatically collapsed, and skips noindex pages (login, signup, 404, etc.).
 *
 * Usage: node scripts/gen_sitemap.js
 */
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '../public');
const SITEMAP_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');
const SITE_URL = 'https://khudkibook.web.app';

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

function w3cDate(ms) {
    return new Date(ms).toISOString().split('T')[0];
}

function priorityFor(loc, isRoot) {
    const pathOnly = loc.replace(SITE_URL, '');
    if (isRoot || loc === SITE_URL + '/') return '1.0';
    if (/^\/(syllabus|papers|ddcet)\.html?$/.test(pathOnly)) return '0.9';
    if (/homepage\.html$/.test(loc)) return '0.8';
    if (/\/index\.html$/.test(loc)) return '0.7';
    return '0.6';
}

function changeFreqFor(loc, isRoot) {
    if (isRoot || loc === SITE_URL + '/') return 'weekly';
    if (/homepage\.html$/.test(loc)) return 'weekly';
    if (/\/index\.html$/.test(loc)) return 'weekly';
    return 'monthly';
}

const files = walk(PUBLIC_DIR);
const seen = new Map();

for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    if (isNoindex(html)) continue;
    const canonical = extractCanonical(html);
    if (!canonical || !canonical.startsWith(SITE_URL)) continue;
    if (!seen.has(canonical)) {
        seen.set(canonical, fs.statSync(file).mtimeMs);
    }
}

const entries = [...seen.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([loc, mtime]) => {
        const isRoot = loc === SITE_URL + '/';
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${w3cDate(mtime)}</lastmod>\n    <changefreq>${changeFreqFor(loc, isRoot)}</changefreq>\n    <priority>${priorityFor(loc, isRoot)}</priority>\n  </url>`;
    });

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

fs.writeFileSync(SITEMAP_PATH, xml);
console.log(`Sitemap written: ${SITEMAP_PATH} (${seen.size} URLs)`);