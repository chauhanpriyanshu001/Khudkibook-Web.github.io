/**
 * AdSense "Low value content" remediation for the Khudkibook site.
 *
 * Keeps the AI-generated book files on disk but removes every trace of them
 * from the crawlable/indexable site so Google no longer treats them as
 * published "Article"/"Book" pages.
 *
 * What it does:
 *   1. Strips AI book materials (m.ai === true OR link starts with /books/)
 *      from data/site_db.json and data/site_db_backup.json (source of truth).
 *   2. Removes <a href="/books/"> nodes from every generated subject page and
 *      swaps left-behind empty "English Book" modals back to a "Coming Soon"
 *      state with a "Book (Soon)" button.
 *   3. Drops /books/ entries from public/main.json and public/data/home_books.json.
 *   4. Sets <meta name="robots" content="noindex, nofollow"> on every HTML file
 *      under public/books/ and removes the Article/Book JSON-LD from them.
 *   5. Adds `Disallow: /books/` to public/robots.txt (idempotent).
 *   6. Fixes public/books/3110002/book.json so it no longer references units
 *      that have no HTML file (broken links).
 *
 * Usage: node scripts/adsense_fix.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');

const EMPTY_STATE = (label) => `
  <div style="text-align:center; padding:30px 15px;">
    <i class="fas fa-clock" style="font-size:2.5rem; color:var(--accent); opacity:0.7; margin-bottom:12px; display:block;"></i>
    <h4 style="margin:0 0 8px; color:var(--text); font-size:1.1rem;">${label} Coming Soon</h4>
    <p style="color:var(--text-muted); font-size:0.9rem; margin:0 0 18px;">We are working hard to add this material. Stay tuned for updates!</p>
  </div>`;

const isAiMaterial = (m) =>
  !!m && (m.ai === true || /^\/books\//.test(String(m.link || '')));

// ---------------------------------------------------------------- 1. site_db
function cleanDbFile(file) {
  if (!fs.existsSync(file)) return { file, removed: 0, available: 0 };
  const db = JSON.parse(fs.readFileSync(file, 'utf8'));
  let removed = 0;
  const branches = [];
  for (const unv of db.universities || []) {
    for (const dom of unv.domains || []) {
      for (const b of dom.branches || []) branches.push(b);
    }
    for (const b of unv.branches || []) branches.push(b);
  }
  for (const b of branches) {
    for (const sem of b.semesters || []) {
      for (const sub of sem.subjects || []) {
        const before = (sub.materials || []).length;
        sub.materials = (sub.materials || []).filter((m) => !isAiMaterial(m));
        removed += before - (sub.materials || []).length;
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(db, null, 2));
  return { file, removed };
}

// --------------------------------------------------- 2. generated subject pages
function stripBookLinksFromPage(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/books/')) return false;
  const original = html;

  // Drop every <a href="/books/...">…</a> (AI book links).
  html = html.replace(/<a\s+href="\/books\/[^"]*"[^>]*>[\s\S]*?<\/a>\s*/g, '');

  // If the modal-book has no links left, restore a "Coming Soon" state and
  // relabel the ENG-Book button so the UI is honest.
  const modalMatch = html.match(/<div class="m741852" id="modal-book">([\s\S]*?)<\/div>\s*<\/div>/);
  if (modalMatch && !/<a\s+href=/.test(modalMatch[1])) {
    const inner = modalMatch[1];
    const withEmpty = inner.replace(
      /<div class="yr-body">[\s\S]*?<\/div>/,
      `<div class="yr-body">${EMPTY_STATE('English Book')}</div>`
    );
    html = html.replace(modalMatch[0], `<div class="m741852" id="modal-book">${withEmpty}</div>\n                        </div>`);
    html = html.replace(/<i class="fas fa-book"><\/i> ENG-Book<\/button>/, '<i class="fas fa-book"></i> Book (Soon)</button>');
  }

  if (html !== original) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, cb);
    else cb(abs);
  }
}

// ----------------------------------------------------- 3. json search/catalog files
function stripBooksFromJsonArrayFile(file) {
  if (!fs.existsSync(file)) return { file, removed: 0 };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let removed = 0;
  const stripArray = (arr) => {
    if (!Array.isArray(arr)) return arr;
    const out = arr.filter((v) => {
      if (typeof v === 'string' && v.startsWith('/books/')) { removed++; return false; }
      return true;
    });
    return out;
  };
  const cleanEntry = (e) => {
    if (!e || typeof e !== 'object') return e;
    if (Array.isArray(e.booksLink)) e.booksLink = stripArray(e.booksLink);
    if (Array.isArray(e.GujbooksLink)) e.GujbooksLink = stripArray(e.GujbooksLink);
    return e;
  };
  if (Array.isArray(data)) data.forEach(cleanEntry);
  else Object.keys(data).forEach((k) => {
    if (Array.isArray(data[k])) data[k].forEach(cleanEntry);
  });
  fs.writeFileSync(file, JSON.stringify(data, null, Array.isArray(data) ? 0 : 2));
  return { file, removed };
}

// ------------------------------------------- 4. de-index AI book pages themselves
function deindexBookHtml(file) {
  if (!file.endsWith('.html')) return false;
  let html = fs.readFileSync(file, 'utf8');
  const original = html;

  // a) robots -> noindex.
  html = html.replace(
    /<meta\s+name="robots"\s+content="([^"]*)"/i,
    `<meta name="robots" content="noindex, nofollow"`
  );
  if (!/noindex/i.test(html)) {
    html = html.replace('<meta name="viewport"', '<meta name="robots" content="noindex, nofollow" />\n  <meta name="viewport"');
  }

  // b) drop Article/Book JSON-LD (they advertise the page as published content).
  html = html.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>\s*/g,
    (_whole, json) => /"@type"\s*:\s*"(?:Article|Book)"/.test(json) ? '' : _whole
  );

  if (html !== original) {
    fs.writeFileSync(file, html);
    return true;
  }
  return false;
}

// ---------------------------------------------------------- 5. robots.txt
function ensureRobotsBooksDisallow() {
  const file = path.join(PUBLIC, 'robots.txt');
  let txt = fs.readFileSync(file, 'utf8');
  if (!/Disallow:\s*\/books\/?/.test(txt)) {
    txt = txt.replace('Disallow: /admin-panel/', 'Disallow: /admin-panel/\nDisallow: /books/');
    fs.writeFileSync(file, txt);
    return true;
  }
  return false;
}

// -------------------------------------------- 6. fix broken book.json manifests
function fixManifests() {
  const booksRoot = path.join(PUBLIC, 'books');
  let fixed = 0;
  for (const e of fs.readdirSync(booksRoot, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dir = path.join(booksRoot, e.name);
    const manifest = path.join(dir, 'book.json');
    if (!fs.existsSync(manifest)) continue;
    const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    const existing = new Set(fs.readdirSync(dir).filter((f) => f.endsWith('.html')));
    const before = JSON.stringify(m);
    m.units = (m.units || []).filter((u) => existing.has(u.file));
    m.pages = (m.pages || []).filter((p) => existing.has(p.file));
    if (JSON.stringify(m) !== before) {
      fs.writeFileSync(manifest, JSON.stringify(m, null, 1));
      fixed++;
    }
  }
  return fixed;
}

// ------------------------------------------------------------------- main
function main() {
  console.log('--- AdSense remediation ---');

  console.log('\n[1] Cleaning AI book materials from site_db...');
  for (const f of ['site_db.json', 'site_db_backup.json']) {
    const r = cleanDbFile(path.join(DATA, f));
    console.log(`    ${f}: removed ${r.removed} AI book material(s)`);
  }

  console.log('\n[2] Stripping /books/ links from generated subject pages...');
  const skipDirs = new Set(['templates', 'assets', 'icons', 'books', 'common']);
  let pages = 0, scanned = 0;
  const scan = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) continue;
        scan(abs);
      } else if (e.name.endsWith('.html')) {
        scanned++;
        if (scanned % 2000 === 0) process.stdout.write(`        scanned ${scanned}...\n`);
        if (stripBookLinksFromPage(abs)) pages++;
      }
    }
  };
  scan(PUBLIC);
  console.log(`    scanned ${scanned} page(s), updated ${pages}`);
  if (pages) {
    console.log('\n    NOTE: found /books/ links still present at runtime — manual review may be needed.');
  }

  console.log('\n[3] Removing /books/ entries from catalog JSON...');
  for (const f of ['main.json', path.join('data', 'home_books.json')]) {
    const r = stripBooksFromJsonArrayFile(path.join(PUBLIC, f));
    console.log(`    ${f}: removed ${r.removed} entry(ies)`);
  }

  console.log('\n[4] De-indexing public/books/**\\.html (noindex + schema removed)...');
  let books = 0;
  walk(path.join(PUBLIC, 'books'), (f) => { if (deindexBookHtml(f)) books++; });
  console.log(`    updated ${books} AI book page(s)`);

  console.log('\n[5] robots.txt Disallow /books/...');
  console.log(ensureRobotsBooksDisallow() ? '    added' : '    already present');

  console.log('\n[6] Fixing book.json manifests with dangling units...');
  console.log(`    fixed ${fixManifests()} manifest(s)`);

  console.log('\nDone. Re-run `node scripts/gen_sitemap.js` to drop /books/ from the sitemap.');
}

main();