/**
 * Assemble a single full-book.html from all generated unit pages.
 *
 * Reads public/books/<code>/unit-<n>[<-gu>].html, extracts each <article>,
 * re-scopes anchor ids with a per-unit prefix (u1-…, u2-…) so sections/scroll
 * links don't collide, and staples them into one page with a combined TOC.
 *
 * Keeps the SAME visual/print/watermark/protection layer as unit pages by
 * reusing the per-unit <style> and the page shell conventions.
 *
 * Run:
 *   node scripts/ai_book/assemble_book.js --code 4360302            (English)
 *   node scripts/ai_book/assemble_book.js --code 4360302 --lang gu   (Gujarati)
 *   node scripts/ai_book/assemble_book.js --code 4360302 --lang both
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SITE_URL = 'https://www.khudkibook.com'; // canonical site host

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { lang: 'both' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code') opts.code = args[++i];
    else if (args[i] === '--lang') opts.lang = args[++i];
    else if (args[i] === '--force') opts.force = true;
  }
  return opts;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function matchOne(re, str, i) {
  const m = str.match(re);
  return m ? m[i] : '';
}

function extractArticle(html) {
  const m = html.match(/<article class="kb-article">([\s\S]*?)<\/article>/);
  return m ? m[1] : '';
}

function extractStyle(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

function extractTocSecs(html) {
  const out = [];
  const re = /<a class="toc-item toc-sec" href="#(sec-[^"]+)"[^>]*>[\s\S]*?<\/a>/g;
  let m;
  while ((m = re.exec(html))) out.push({ href: m[1], label: m[0].replace(/<[^>]+>/g, '').trim() });
  return out;
}

// Removes a top-level <div …>…</div> block starting at index `start` (the index
// of the opening tag's '<'). Balances nested <div>/</div> tags via token scan.
function removeDivBlock(html, start) {
  let depth = 0;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') depth--;
    else depth++;
    if (depth === 0) return html.slice(0, start) + html.slice(re.lastIndex);
  }
  return html;
}

// Strip the in-article ad (wrapper .ad-slot-wrapper.ad-inarticle … </div>).
function stripAds(content) {
  const re = /<div class="ad-slot-wrapper[^>]*ad-inarticle[^>]*">/g;
  let m;
  while ((m = re.exec(content))) content = removeDivBlock(content, m.index);
  return content;
}
// Renames document ids + anchor hrefs so simultaneous units don't collide.
// Handles section headings, mermaid containers and any "to-" scroll targets.
function rescope(html, prefix) {
  return html
    .replace(/id="(sec-[^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/href="#(sec-[^"]+)"/g, `href="#${prefix}-$1"`)
    .replace(/id="(mermaid-[^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/href="#(mermaid-[^"]+)"/g, `href="#${prefix}-$1"`)
    .replace(/data-target="#to-([^"]+)"/g, `data-target="#${prefix}-to-$1"`)
    .replace(/id="(to-[^"]+)"/g, `id="${prefix}-$1"`);
}

function roman(n) {
  const r = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  return r[n - 1] || String(n);
}

function buildFullBook({ code, lang, def, unitsHtml }) {
  const isGu = lang === 'gu';
  const fileName = `full-book${isGu ? '-gu' : ''}.html`;
  const langAttr = isGu ? 'gu' : 'en';
  const totalUnits = unitsHtml.length;

  const totalMin = unitsHtml.reduce((s, u) => s + u.min, 0);
  const totalWords = unitsHtml.reduce((s, u) => s + u.words, 0);

  const tocHtml = unitsHtml.map(u => {
    const ud = u.ud;
    const chapterHref = `#${u.prefix}-sec-${ud.n}`;
    const items = u.tocSecs
      .filter(x => !x.href.endsWith(`sec-${ud.n}`))
      .map(x => `<a class="toc-item toc-sec" href="#${u.prefix}-${x.href}"><i class="fas fa-chevron-right"></i> ${esc(x.label)}</a>`)
      .join('\n');
    return `<details class="kb-unit-block" open>
      <summary>${ud.n}. <a class="kb-unit-link" href="${chapterHref}">${esc(def.subject)} – Unit ${roman(ud.n)}: ${esc(ud.title)}</a></summary>
      ${items}
    </details>`;
  }).join('\n');

  const articles = unitsHtml.map(u => {
    const ud = u.ud;
    const titleEsc = esc(`${ud.n}. Unit – ${roman(ud.n)}: ${ud.title}`);
    const marksNote = ud.marks ? `<p><em>This unit carries approximately <strong>${esc(ud.marks)}</strong>.</em></p>` : '';
    return `<article class="kb-article kb-unit" id="unit-${ud.n}">
<h2 id="${u.prefix}-sec-${ud.n}">${titleEsc}</h2>
${marksNote}
${u.content}
</article>`;
  }).join('\n\n');

  // Reuse one progress/scrollspy/protection script (adapted for the merged doc).
  const clientScript = `
  (function () {
    var bar = document.getElementById('kb-progress');
    function onScroll() {
      var st = window.scrollY || document.documentElement.scrollTop;
      var h = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;
      if (bar && h > 0) bar.style.width = Math.min(100, st / h * 100) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var links = [].slice.call(document.querySelectorAll('.kb-toc a.toc-sec'));
    var heads = [].slice.call(document.querySelectorAll('.kb-article h2[id],.kb-article h3[id]'));
    var map = {};
    heads.forEach(function (s) { map['#' + s.id] = s; });
    if ('IntersectionObserver' in window && links.length && heads.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var t = '#' + e.target.id;
          links.forEach(function (a) { a.classList.toggle('toc-active', a.getAttribute('href') === t); });
        });
      }, { rootMargin: '-15% 0px -75% 0px' });
      heads.forEach(function (s) { io.observe(s); });
    }

    var art = document.querySelector('.kb-book');
    var toastEl = document.getElementById('kb-toast');
    function toast() {
      if (!toastEl) return;
      toastEl.classList.add('show');
      clearTimeout(toastEl._h);
      toastEl._h = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
    }
    function inArt(el) { return art && el && (el === art || art.contains(el)); }
    document.addEventListener('contextmenu', function (e) { if (inArt(e.target)) { e.preventDefault(); toast(); } });
    document.addEventListener('copy', function (e) { if (inArt(e.target)) { e.preventDefault(); toast(); } });
    document.addEventListener('cut', function (e) { if (inArt(e.target)) { e.preventDefault(); toast(); } });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && inArt(document.activeElement)) { e.preventDefault(); toast(); }
    });
  })();
  `;

  const hasMermaid = unitsHtml.some(u => u.content.includes('class="mermaid"'));
  const mermaidScript = hasMermaid ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>document.addEventListener('DOMContentLoaded',function(){try{mermaid.initialize({startOnLoad:true,theme:'neutral',fontFamily:'inherit'});}catch(e){}});</script>` : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: `${def.subject} – Complete AI Self-Study Book`,
    inLanguage: langAttr,
    numberOfPages: '1',
    wordCount: totalWords,
    publisher: { '@type': 'Organization', name: 'KhudKibook' },
    about: def.subject,
    author: { '@type': 'Organization', name: 'KhudKibook AI ' }
  };

  const dir = path.join(ROOT, 'public', 'books', String(code));
  const style = extractStyle(unitsHtml[0].rawHtml) || '';

  const out = `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(def.subject)} – Full Book (All ${totalUnits} Units) | KhudKibook</title>
  <meta name="description" content="Complete AI-generated GTU self-study book for ${esc(def.subject)} (${code}) — all ${totalUnits} units in one page. Diagrams, solved examples and unit-end questions included.">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${SITE_URL}/books/${code}/${fileName}">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Gujarati:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="icon" type="image/png" href="/images/favicon.png">
  <style>
${style}
  .kb-unit-block{margin-bottom:8px;border:1px solid var(--border);border-radius:10px;padding:4px 6px;background:var(--bg-soft)}
  .kb-unit-block summary{cursor:pointer;font-weight:700;padding:6px 8px;color:var(--text-primary)}
  .kb-unit-block .kb-unit-link{color:var(--accent)}
  .kb-unit{margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid var(--border)}
  .kb-book-head .kb-sub.merged{white-space:normal}
  </style>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <nav id="nav" class="navbar-root no-print"></nav>
  <div class="kb-progress-bar" id="kb-progress"></div>

  <main class="kb-book">
    <nav class="nv759 no-print" aria-label="Breadcrumb">
      <div class="nvl153">
        <a href="/">Home</a> &raquo; ${esc(def.branchLabel)} &raquo; <a href="${esc(def.page)}">${esc(def.subject)}</a> &raquo; Full Book
      </div>
    </nav>

    <div class="kb-book-head">
      <div class="kb-kicker">KhudKibook · GTU AI Self Study Book</div>
      <h1>${esc(def.subject)} — Full Book</h1>
      <div class="kb-sub merged">${esc(def.branchLabel)} · All ${totalUnits} Units in One Page · ${esc(String(def.code))}</div>
      <div class="kb-meta">
        <span><i class="fas fa-clock"></i> ~${totalMin} min read</span>
        <span><i class="fas fa-file-lines"></i> ${totalWords.toLocaleString()} words</span>
        <a class="kb-print-btn no-print" href="javascript:window.print()"><i class="fas fa-download"></i> Download PDF</a>
      </div>
      <div style="margin-top:10px"><span class="kb-badge"><i class="fas fa-robot"></i> AI-generated study material · always cross-check with official syllabus</span></div>
    </div>

    <div class="kb-layout">
      <aside class="kb-toc no-print">
        <h4>Chapters</h4>
        ${tocHtml}
        <a class="back-link" href="${esc(def.page)}"><i class="fas fa-arrow-left"></i> Back to ${esc(def.subject)}</a>
      </aside>

      <div class="kb-articles">
        ${articles}
      </div>
    </div>
  </main>

  <footer id="footer" class="no-print"></footer>

  <div class="print-watermark" aria-hidden="true">
    <span>KHUDKIBOOK</span><span>KHUDKIBOOK</span><span>KHUDKIBOOK</span><span>KHUDKIBOOK</span>
  </div>
  <div class="kb-toast no-print" id="kb-toast">Protected by KhudKibook – please purchase the original.</div>

  <script type="text/javascript" src="/ru444ts.js?v=2.1" defer></script>
  <script type="text/javascript" src="/select.js?v=2.1" defer></script>
  <script type="text/javascript" src="/ad-injector.js?v=2.1" defer></script>
  ${mermaidScript}
  <script>${clientScript}</script>
</body>
</html>
`;
  return { fileName, out };
}

function main() {
  const opts = parseArgs();
  if (!opts.code) { console.error('Usage: node scripts/ai_book/assemble_book.js --code 4360302 [--lang en|gu|both]'); process.exit(1); }
  const code = String(opts.code);
  const udPath = path.join(ROOT, 'data', 'ai_books', code, 'unitdef.json');
  if (!fs.existsSync(udPath)) { console.error('Missing', udPath, '— run parse_syllabus.js first'); process.exit(1); }
  const def = JSON.parse(fs.readFileSync(udPath, 'utf8'));

  const langs = opts.lang === 'both' ? ['en'] : [opts.lang];
  for (const lang of langs) {
    const suffix = lang === 'gu' ? '-gu' : '';
    const perUnit = [];
    for (const ud of def.units) {
      const file = path.join(ROOT, 'public', 'books', code, `unit-${ud.n}${suffix}.html`);
      if (!fs.existsSync(file)) {
        if (lang === 'gu') { console.log(`[skip] no ${file} — run translate_gu + build first`); continue; }
        console.log(`[warn] ${file} missing — generating full book with available units only`);
        continue;
      }
      const rawHtml = fs.readFileSync(file, 'utf8');
      let content = extractArticle(rawHtml);
      if (!content) { console.error('[FATAL] no <article> in', file); process.exit(1); }
      const prefix = `u${ud.n}`;
      if (ud.n !== 1) {
        // AdSense caps ads at 3 slots/page: keep only unit 1's in-article ad.
        content = stripAds(content);
      }
      content = rescope(content, prefix);
      const min = parseInt(matchOne(/(\d+)\s*min read/, rawHtml), 10) || 0;
      const words = (content.replace(/<[^>]+>/g, ' ').match(/\S+\s*/g) || []).length;
      perUnit.push({ n: ud.n, ud, prefix, content, rawHtml, min, words,
        tocSecs: extractTocSecs(rawHtml) });
    }
    if (!perUnit.length) { console.error(`[FATAL] no units found for lang ${lang}`); continue; }
    const { fileName, out } = buildFullBook({ code, lang, def, unitsHtml: perUnit });
    const target = path.join(ROOT, 'public', 'books', code, fileName);
    fs.writeFileSync(target, out);
    console.log('Wrote', target, `(${perUnit.length} units, EN`, `)`);
  }
}

if (require.main === module) main();
module.exports = { extractArticle, extractStyle, rescope, buildFullBook };