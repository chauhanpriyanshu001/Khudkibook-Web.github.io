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
const { subjectTheme, syllabusKeywords, coverMotif } = require('./book_theme');

const ROOT = path.join(__dirname, '..', '..');
const SITE_URL = 'https://khudkibook.in'; // canonical site host

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
  const theme = subjectTheme(def.subject, def.branchLabel);
  const keywords = syllabusKeywords(def, 6);
  const themeVars = `--kb-accent:${theme.accent};--kb-accent-2:${theme.accent2};`;

  const tocHtml = unitsHtml.map(u => {
    const ud = u.ud;
    const chapterHref = `#${u.prefix}-sec-${ud.n}`;
    const items = u.tocSecs
      .filter(x => !x.href.endsWith(`sec-${ud.n}`))
      .map(x => `<a class="toc-item toc-sec" href="#${u.prefix}-${x.href}"><i class="fas fa-chevron-right"></i> ${esc(x.label)}</a>`)
      .join('\n');
    return `<details class="kb-unit-block" open>
      <summary><a class="kb-unit-link" href="${chapterHref}"><span class="toc-number">${ud.n}</span> ${esc(ud.title)}</a></summary>
      ${items}
    </details>`;
  }).join('\n');

  const articles = unitsHtml.map(u => {
    const ud = u.ud;
    const romanTitle = `Unit ${roman(ud.n)}: ${ud.title}`;
    const marksNote = ud.marks ? `<p><em>This unit carries approximately <strong>${esc(ud.marks)}</strong>.</em></p>` : '';
    return `<article class="kb-article kb-unit" id="unit-${ud.n}">
<div class="kb-unit-head">
  <div class="kb-unit-num">${ud.n}</div>
  <div>
    <h2 class="kb-unit-title" id="${u.prefix}-sec-${ud.n}">${esc(romanTitle)}</h2>
  </div>
</div>
${marksNote}
${u.content}
</article>`;
  }).join('\n\n');

  const hasMermaid = unitsHtml.some(u => u.content.includes('class="mermaid"'));
  const mermaidScript = hasMermaid ? `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
(function () {
  function kbSanitizeMermaid(src) {
    return String(src || '')
      .replace(/(-->|\\+-->|==>)\\s*([A-Za-z0-9_]+)\\[([^\\]]*)\\]\\s*\\(([^)]*)\\)/g, function (m, arrow, id, label, note) {
        var noteT = (note || '').trim(), labelT = (label || '').trim();
        var merged = noteT && labelT ? labelT + ' - ' + noteT : (labelT || noteT);
        return arrow + ' ' + id + '[' + merged + ']';
      })
      .replace(/\\(\\)/g, '')
      .replace(/[ \\t]{2,}/g, ' ');
  }
  function init() {
    if (!window.mermaid) return;
    mermaid.initialize({ startOnLoad: false, theme: 'neutral', fontFamily: 'inherit', securityLevel: 'strict', flowchart: { curve: 'basis', htmlLabels: true, useMaxWidth: true, nodeSpacing: 28, rankSpacing: 32, padding: 18 } });
    var nodes = [].slice.call(document.querySelectorAll('.mermaid'));
    nodes.forEach(function (el) {
      if (el.dataset.kbRun) return;
      el.dataset.kbRun = '1';
      el.textContent = kbSanitizeMermaid(el.textContent);
      mermaid.run({ nodes: [el] }).then(function () {
        var svg = el.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('width', '100%');
        svg.removeAttribute('height');
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxWidth = '100%';
        svg.style.overflow = 'visible';
      }).catch(function () {
        el.classList.add('mermaid-failed');
        el.innerHTML = '<div style="padding:10px;color:#9ca3af;font-style:italic;font-size:.85rem">Diagram could not render — see source below.</div>' + el.innerHTML;
      });
    });
  }
  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);
  setTimeout(init, 1400);
  document.addEventListener('DOMContentLoaded', init);
})();
</script>` : '';

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

  const syllabusRows = (def.units || []).map(u => `<tr><td>${esc(`Unit ${u.n}`)}</td><td>${esc(u.title || '')}</td><td>${esc(u.marks || u.weightage || 'As per GTU syllabus')}</td></tr>`).join('');
  const objectiveList = (def.uos || []).slice(0, 8).map(x => `<li>${esc(String(x).replace(/^\d+[a-z]?\.\s*/i, ''))}</li>`).join('');
  const keywordPills = keywords.map(x => `<span class="kb-cover-topic">${esc(x)}</span>`).join('');
  const cover = `  
    <div class="kb-book-cover">
      ${coverMotif(theme)}
      <div class="kb-cover-inner">
        <div class="kb-brand-lockup"><span class="kb-brand-mark">KB</span><span>KHUDKIBOOK</span></div>
        <div class="kb-cover-kicker">GTU ${esc(theme.key.toUpperCase())} · AI SELF-STUDY BOOK</div>
        <div class="kb-cover-subject-icon">${esc(theme.icon)}</div>
        <div class="kb-cover-title">${esc(def.subject)}</div>
        <div class="kb-cover-rule"></div>
        <div class="kb-cover-meta">Subject Code ${esc(String(code))} · ${esc(def.branchLabel)}</div>
        <div class="kb-cover-units">Complete Study Book · ${totalUnits} Units</div>
        <div class="kb-cover-topics">${keywordPills}</div>
        <div class="kb-cover-badge"><i class="fas fa-robot"></i> AI-generated study material · cross-check with official syllabus</div>
      </div>
    </div>`;

  const frontMatter = `
    <section class="kb-front-matter kb-paper" id="kb-overview">
      <div class="kb-brand-page-mark">KHUDKIBOOK <span>STUDENT EDITION</span></div>
      <p class="kb-eyebrow">About this book</p>
      <h1>${esc(def.subject)}</h1>
      <p class="kb-lead">A clear, exam-oriented self-study book for GTU students. Every chapter is arranged from the official syllabus into simple explanations, worked examples, diagrams, revision points and exam-style questions.</p>
      <div class="kb-front-grid">
        <div><strong>${totalUnits}</strong><span>syllabus units</span></div>
        <div><strong>${totalWords.toLocaleString()}</strong><span>study words</span></div>
        <div><strong>${Math.max(1, Math.ceil(totalWords / 500))}</strong><span>print pages approx.</span></div>
      </div>
      <h2>How to use this book</h2>
      <ol class="kb-reading-steps">
        <li>Read the unit overview before starting a chapter.</li>
        <li>Study the worked examples and diagrams, then attempt the unit-end questions.</li>
        <li>Use the page-turn reader for focused study or download the watermarked PDF for offline revision.</li>
        <li>Always verify formulas, standards and exam requirements against the official GTU syllabus and prescribed textbooks.</li>
      </ol>
      <div class="kb-disclaimer"><strong>Academic note:</strong> This is a KhudKibook learning aid, not an official GTU publication. It is designed to make syllabus-aligned study easier, not to replace official references.</div>
    </section>
    <section class="kb-front-matter kb-paper" id="kb-syllabus">
      <p class="kb-eyebrow">At a glance</p>
      <h2>Syllabus and learning map</h2>
      <p class="kb-muted">The chapters below are generated from the syllabus definition stored for subject code <strong>${esc(String(code))}</strong>.</p>
      <table class="kb-syllabus-table"><thead><tr><th>Unit</th><th>Coverage</th><th>Weight / marks</th></tr></thead><tbody>${syllabusRows}</tbody></table>
      ${objectiveList ? `<h3>Learning outcomes</h3><ul>${objectiveList}</ul>` : ''}
      <div class="kb-keyword-row">${keywordPills}</div>
    </section>`;

  const readerScript = `
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

    // Add class to body for sticky bottom toolbar behavior
    var b = document.body;
    b.classList.add('kb-reader');

    // Reader mode turns chapters into substantial, book-like pages. The
    // regular continuous layout remains the default for accessibility and
    // printing; the toggle is a progressive enhancement for screen reading.
    var readerToggle = document.getElementById('kb-reader-toggle');
    var pageControls = document.getElementById('kb-page-controls');
    var pages = [].slice.call(document.querySelectorAll('.kb-articles .kb-unit'));
    var pageIndex = Math.max(0, Math.min(pages.length - 1, Number(localStorage.getItem('kb:' + ${JSON.stringify(String(code))} + ':page') || 0)));
    var pageMode = false;
    function paintPage(direction) {
      if (!pages.length) return;
      pages.forEach(function (p, i) { p.classList.toggle('kb-page-active', i === pageIndex); p.classList.remove('kb-turn-next', 'kb-turn-prev'); });
      var current = pages[pageIndex];
      if (current) { current.classList.add(direction === 'prev' ? 'kb-turn-prev' : 'kb-turn-next'); current.setAttribute('tabindex', '-1'); current.focus({ preventScroll: true }); }
      var label = document.getElementById('kb-page-label');
      if (label) label.textContent = 'Chapter ' + (pageIndex + 1) + ' of ' + pages.length;
      var prev = document.getElementById('kb-page-prev'), next = document.getElementById('kb-page-next');
      if (prev) prev.disabled = pageIndex === 0;
      if (next) next.disabled = pageIndex === pages.length - 1;
      localStorage.setItem('kb:' + ${JSON.stringify(String(code))} + ':page', String(pageIndex));
    }
    function setPageMode(on) {
      pageMode = !!on;
      b.classList.toggle('kb-page-mode', pageMode);
      if (readerToggle) {
        readerToggle.innerHTML = pageMode ? '<i class="fas fa-scroll"></i> Continuous view' : '<i class="fas fa-book-open"></i> Page view';
        readerToggle.setAttribute('aria-pressed', pageMode ? 'true' : 'false');
      }
      if (pageControls) pageControls.style.display = pageMode ? 'flex' : 'none';
      if (pageMode) paintPage('next');
      else pages.forEach(function (p) { p.classList.add('kb-page-active'); p.removeAttribute('tabindex'); });
    }
    if (pageControls) pageControls.style.display = 'none';
    if (readerToggle) readerToggle.addEventListener('click', function () { setPageMode(!pageMode); });
    var prevBtn = document.getElementById('kb-page-prev'), nextBtn = document.getElementById('kb-page-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { if (pageIndex > 0) { pageIndex--; paintPage('prev'); } });
    if (nextBtn) nextBtn.addEventListener('click', function () { if (pageIndex < pages.length - 1) { pageIndex++; paintPage('next'); } });
    document.addEventListener('keydown', function (e) {
      if (!pageMode || (e.target && /input|textarea|select/i.test(e.target.tagName))) return;
      if (e.key === 'ArrowLeft' && pageIndex > 0) { pageIndex--; paintPage('prev'); }
      if (e.key === 'ArrowRight' && pageIndex < pages.length - 1) { pageIndex++; paintPage('next'); }
    });
    document.querySelectorAll('.kb-unit-link').forEach(function (link, index) {
      link.addEventListener('click', function (e) {
        if (!pageMode) return;
        e.preventDefault(); pageIndex = index; paintPage('next');
      });
    });

    // Mobile chapter drawer toggle
    var tocDrawer = document.getElementById('kb-mobile-toc');
    var tocOpen = document.getElementById('kb-toc-open');
    var tocClose = document.getElementById('kb-toc-close');
    if (tocOpen && tocDrawer) {
      tocOpen.addEventListener('click', function () { tocDrawer.classList.add('open'); });
    }
    if (tocClose && tocDrawer) {
      tocClose.addEventListener('click', function () { tocDrawer.classList.remove('open'); });
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
  })();
  `;

  const out = `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(def.subject)} Full Book – All ${totalUnits} Units (${code}) | KhudKibook</title>
  <meta name="description" content="Complete AI-generated GTU self-study book for ${esc(def.subject)} (${code}) — all ${totalUnits} units in one readable page. Diagrams, solved examples and unit-end questions included.">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#4f46e5">
  <link rel="canonical" href="${SITE_URL}/books/${code}/${fileName}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@600;700;800&family=Noto+Sans+Gujarati:wght@400;500;700&display=swap" rel="stylesheet">
  <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <link rel="stylesheet" href="/be619.css?v=2.1" />
  <link rel="icon" type="image/png" href="/assets/brand/favicon-32x32.png?v=2" />
  <style>
  /* ============ FIXED BASE (does not depend on unit-page vars) ============ */
  .kb-book{max-width:920px;margin:0 auto;padding:0 16px 60px}
  html{scroll-behavior:smooth}
  .kb-progress-bar{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#4f46e5,#7c3aed);z-index:1200;transition:width .1s linear}

  /* ---------- Book cover (reader-style) ---------- */
  .kb-book-cover{background:linear-gradient(135deg,var(--kb-accent,#312e81) 0%,var(--kb-accent-2,#4f46e5) 100%);border-radius:20px;color:#fff;padding:0;margin:18px 0 24px;box-shadow:0 20px 44px color-mix(in srgb,var(--kb-accent,#4f46e5) 32%,transparent);overflow:hidden;position:relative;min-height:520px;display:flex;align-items:center}
  .kb-book-cover::before{content:"";position:absolute;inset:0;background:radial-gradient(1200px 400px at 85% -10%,rgba(255,255,255,.18),transparent 60%),radial-gradient(600px 300px at 0% 110%,rgba(124,58,237,.5),transparent 55%);pointer-events:none}
  .kb-cover-inner{position:relative;padding:52px 40px 44px;text-align:center;width:100%;z-index:2}
  .kb-brand-lockup{display:inline-flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.18em;font-size:.78rem;margin-bottom:22px}
  .kb-brand-mark{display:inline-grid;place-items:center;width:32px;height:32px;border-radius:10px;background:#fff;color:var(--kb-accent,#4338ca);font-size:.72rem;letter-spacing:-.04em}
  .kb-cover-kicker{font-size:.74rem;letter-spacing:.28em;text-transform:uppercase;opacity:.8;font-weight:700;margin-bottom:16px}
  .kb-cover-subject-icon{font-size:4rem;line-height:1;margin:0 auto 16px;text-shadow:0 8px 30px rgba(0,0,0,.25)}
  .kb-cover-title{font-family:'Outfit',sans-serif;font-size:clamp(1.7rem,4.5vw,2.8rem);font-weight:800;line-height:1.16;letter-spacing:-.01em}
  .kb-cover-rule{width:64px;height:3px;border-radius:99px;background:rgba(255,255,255,.7);margin:18px auto}
  .kb-cover-meta{font-size:.95rem;font-weight:600;opacity:.94;margin-top:2px}
  .kb-cover-units{display:inline-flex;align-items:center;gap:8px;margin-top:12px;font-size:.82rem;font-weight:700;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.32);padding:7px 16px;border-radius:999px}
  .kb-cover-topics{display:flex;flex-wrap:wrap;justify-content:center;gap:7px;margin:18px auto 0;max-width:720px}
  .kb-cover-topic{font-size:.72rem;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.24);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .kb-cover-badge{margin-top:18px;display:inline-flex;align-items:center;gap:8px;font-size:.78rem;font-weight:600;background:rgba(0,0,0,.22);padding:8px 16px;border-radius:999px}
  .kb-motif{position:absolute;inset:0;opacity:.24;pointer-events:none}
  .kb-motif-grid{background-image:linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px);background-size:34px 34px;transform:perspective(420px) rotateX(58deg) translateY(45%);transform-origin:center bottom}
  .kb-motif-wave{position:absolute;right:4%;bottom:7%;font-size:7rem;letter-spacing:-.35em;transform:rotate(-12deg);white-space:nowrap}
  .kb-motif-gear{position:absolute;right:5%;top:8%;font-size:12rem;opacity:.16}
  .kb-motif-blueprint{position:absolute;right:5%;bottom:5%;font-size:6rem;letter-spacing:1.2rem}
  .kb-motif-circuit i,.kb-motif-circuit b,.kb-motif-molecule i,.kb-motif-molecule b{position:absolute;display:block;border-radius:50%;background:#fff;box-shadow:0 0 0 8px rgba(255,255,255,.08)}
  .kb-motif-circuit i:nth-child(1),.kb-motif-molecule i:nth-child(1){width:14px;height:14px;left:10%;top:22%}.kb-motif-circuit i:nth-child(2),.kb-motif-molecule i:nth-child(2){width:10px;height:10px;right:14%;top:32%}.kb-motif-circuit i:nth-child(3),.kb-motif-molecule i:nth-child(3){width:18px;height:18px;right:24%;bottom:14%}
  .kb-motif-circuit b,.kb-motif-molecule b{height:2px;width:40%;border-radius:0;opacity:.75}.kb-motif-circuit b:nth-of-type(1){left:10%;top:24%;transform:rotate(18deg)}.kb-motif-circuit b:nth-of-type(2){right:18%;top:34%;transform:rotate(48deg)}
  .kb-motif-molecule b{width:24%;left:20%;top:46%;transform:rotate(-28deg)}.kb-motif-molecule b:nth-of-type(2){left:57%;top:46%;transform:rotate(28deg)}
  .kb-paper{background:#fff;border:1px solid var(--border,#e5e9f2);border-radius:16px;padding:34px 38px;margin:0 0 22px;box-shadow:0 1px 3px rgba(15,23,42,.08);line-height:1.7;position:relative}
  .kb-paper::after{content:"";position:absolute;inset:10px;border:1px solid rgba(79,70,229,.08);border-radius:11px;pointer-events:none}
  .kb-brand-page-mark{font-size:.72rem;font-weight:800;letter-spacing:.18em;color:var(--kb-accent,#4338ca);margin-bottom:28px}.kb-brand-page-mark span{color:#94a3b8;font-weight:600;margin-left:8px}
  .kb-eyebrow{font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;font-weight:800;color:var(--kb-accent,#4338ca);margin-bottom:6px}.kb-paper h1,.kb-paper h2{font-family:'Outfit',sans-serif;color:#1e1b4b}.kb-paper h1{font-size:2rem;margin:0 0 12px}.kb-paper h2{font-size:1.35rem;border-bottom:2px solid #eef1fb;padding-bottom:8px;margin:24px 0 10px}.kb-paper h3{font-size:1.05rem;margin:22px 0 8px}.kb-lead{font-size:1.05rem;color:#475569;max-width:760px}.kb-muted{color:#64748b}.kb-front-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.kb-front-grid div{border:1px solid #e5e7eb;border-radius:12px;padding:14px;background:#f8fafc}.kb-front-grid strong{display:block;font-size:1.35rem;color:var(--kb-accent,#4338ca)}.kb-front-grid span{font-size:.78rem;color:#64748b}.kb-reading-steps{padding-left:22px}.kb-disclaimer{border-left:4px solid #f59e0b;background:#fffbeb;padding:12px 14px;border-radius:0 10px 10px 0;font-size:.86rem;color:#78350f;margin-top:22px}.kb-syllabus-table{width:100%;border-collapse:collapse;font-size:.88rem}.kb-syllabus-table th,.kb-syllabus-table td{border:1px solid #e2e8f0;padding:9px;text-align:left;vertical-align:top}.kb-syllabus-table th{background:#f1f5f9;color:#1e293b}.kb-keyword-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.kb-keyword-row .kb-cover-topic{color:var(--kb-accent,#4338ca);background:#eef2ff;border-color:#c7d2fe}

  /* ---------- Toolbar ---------- */
  .kb-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;justify-content:space-between;margin:0 0 18px}
  .kb-toolbar .kb-tb-group{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
  .kb-tb-btn,.kb-print-btn{display:inline-flex;gap:8px;align-items:center;background:#fff;color:var(--accent,#4f46e5);border:1px solid var(--border,#e5e9f2);padding:9px 15px;border-radius:999px;font-weight:700;font-size:.82rem;text-decoration:none;box-shadow:0 1px 3px rgba(15,23,42,.08);transition:.15s}
  .kb-tb-btn:hover,.kb-print-btn:hover{transform:translateY(-1px);border-color:var(--border-accent,rgba(79,70,229,.35));box-shadow:0 6px 16px rgba(15,23,42,.12)}
  .kb-tb-stat{display:inline-flex;gap:8px;align-items:center;background:#fff;border:1px solid var(--border,#e5e9f2);padding:9px 14px;border-radius:999px;font-weight:600;font-size:.82rem;color:var(--text-secondary,#475569);box-shadow:0 1px 3px rgba(15,23,42,.08)}
  .kb-page-controls{display:flex;align-items:center;justify-content:center;gap:14px;margin:0 0 18px}.kb-page-label{font-size:.82rem;font-weight:800;color:#64748b;min-width:110px;text-align:center}

  /* ---------- Mobile chapter drawer ---------- */
  #kb-mobile-toc{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(2px);z-index:1500;opacity:0;pointer-events:none;transition:.25s}
  #kb-mobile-toc.open{opacity:1;pointer-events:auto}
  #kb-mobile-toc .mob-toc-panel{position:absolute;top:0;left:0;bottom:0;width:min(320px,84vw);background:#fff;box-shadow:20px 0 40px rgba(15,23,42,.2);overflow:auto;padding:20px 16px;transform:translateX(-100%);transition:.25s}
  #kb-mobile-toc.open .mob-toc-panel{transform:translateX(0)}
  #kb-mobile-toc .mob-toc-panel h4{margin:6px 4px;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#64748b)}
  #kb-mobile-toc .mob-toc-panel .toc-item{display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:9px;color:var(--text-secondary,#475569);text-decoration:none;font-size:.88rem;font-weight:600;margin-bottom:4px}
  #kb-mobile-toc .mob-toc-panel .toc-item:hover{background:var(--bg-soft,#eef1fb);color:var(--accent,#4f46e5)}
  #kb-mobile-toc .mob-toc-panel .back-link{display:block;margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#e5e9f2);font-size:.85rem;color:var(--accent,#4f46e5);text-decoration:none;font-weight:700}

  /* ---------- Layout (book reading column) ---------- */
  .kb-reader{background:var(--bg-page,#f6f8fc)}
  .kb-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:26px}
  .kb-toc{position:sticky;top:86px;align-self:start;background:#fff;border:1px solid var(--border,#e5e9f2);border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(15,23,42,.08);max-height:calc(100vh - 112px);overflow:auto}
  .kb-toc h4{margin:14px 0 8px;font-size:.76rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#64748b)}
  .kb-toc h4:first-child{margin-top:0}
  .kb-toc .toc-item{display:flex;gap:8px;align-items:center;padding:9px 11px;border-radius:9px;color:var(--text-secondary,#475569);text-decoration:none;font-size:.88rem;font-weight:600;margin-bottom:4px;border:1px solid transparent;transition:.15s;line-height:1.35}
  .kb-toc .toc-item:hover{background:var(--bg-soft,#eef1fb);color:var(--accent,#4f46e5)}
  .kb-toc .toc-item.toc-active{background:var(--accent-gradient,linear-gradient(135deg,#4f46e5,#7c3aed));color:#fff;box-shadow:0 8px 24px rgba(79,70,229,.22)}
  .kb-toc .toc-number{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;background:var(--bg-soft,#eef1fb);border-radius:8px;font-size:.72rem;font-weight:800;color:var(--accent,#4f46e5)}
  .kb-toc .toc-item.toc-active .toc-number{background:rgba(255,255,255,.2);color:#fff}
  .kb-toc .toc-sec{font-size:.8rem;padding:6px 8px;font-weight:500}
  .kb-toc .back-link{display:block;margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#e5e9f2);font-size:.85rem;color:var(--accent,#4f46e5);text-decoration:none;font-weight:700}
  .kb-unit-block{margin-bottom:6px;border:1px solid var(--border,#e5e9f2);border-radius:10px;padding:4px 6px;background:var(--bg-soft,#eef1fb)}
  .kb-unit-block summary{cursor:pointer;font-weight:700;padding:6px 8px;color:var(--text-primary,#0f172a);list-style:none}
  .kb-unit-block summary::-webkit-details-marker{display:none}
  .kb-unit-block .kb-unit-link{color:var(--accent,#4f46e5);text-decoration:none}

  /* ---------- Reading column / articles ---------- */
  .kb-articles{min-width:0}
  .kb-article{background:#fff;border:1px solid var(--border,#e5e9f2);border-radius:16px;padding:28px 32px;box-shadow:0 1px 3px rgba(15,23,42,.08);line-height:1.75;color:var(--text-primary,#0f172a)}
  .kb-article .kb-unit-head{display:flex;align-items:flex-start;gap:14px;border-bottom:2px solid var(--bg-soft,#eef1fb);padding-bottom:14px;margin-bottom:18px}
  .kb-article .kb-unit-num{flex-shrink:0;width:54px;height:54px;border-radius:15px;background:var(--accent-gradient,linear-gradient(135deg,#4f46e5,#7c3aed));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.15rem;box-shadow:0 8px 20px rgba(79,70,229,.28)}
  .kb-article .kb-unit-title{font-family:'Outfit',sans-serif;font-size:clamp(1.2rem,2.4vw,1.55rem);font-weight:700;line-height:1.3;color:var(--accent-dark,#4338ca);margin:0}
  .kb-article h2{font-family:'Outfit',sans-serif;font-size:1.3rem;margin:24px 0 10px;padding-bottom:8px;border-bottom:2px solid var(--bg-soft,#eef1fb);color:var(--accent-dark,#4338ca);scroll-margin-top:96px}
  .kb-article h3{font-size:1.08rem;margin:20px 0 8px;color:var(--text-primary,#0f172a);scroll-margin-top:96px}
  .kb-article h4{font-size:1rem;margin:16px 0 6px}
  .kb-article p{margin:10px 0}
  .kb-article ul,.kb-article ol{margin:10px 0 10px 22px}
  .kb-article li{margin:5px 0}
  .kb-article table{width:100%;border-collapse:collapse;margin:14px 0;font-size:.92rem}
  .kb-article th,.kb-article td{border:1px solid var(--border,#e5e9f2);padding:9px 11px;text-align:left}
  .kb-article th{background:var(--bg-soft,#eef1fb);font-weight:700}
  .kb-article code{background:var(--bg-soft,#eef1fb);padding:2px 6px;border-radius:6px;font-size:.9em}
  .kb-article pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px;overflow:auto}
  .kb-article blockquote{border-left:4px solid var(--accent,#4f46e5);background:var(--bg-glass,rgba(99,102,241,.06));padding:10px 14px;border-radius:0 10px 10px 0;margin:12px 0;color:var(--text-secondary,#475569)}
  .kb-article .fig-callout{background:var(--bg-soft,#eef1fb);border:1.5px dashed var(--border-accent,rgba(79,70,229,.35));border-radius:12px;padding:14px 16px;margin:14px 0;color:var(--text-secondary,#475569);font-size:.92rem;display:flex;gap:10px;align-items:flex-start}
  .kb-article .kb-example{background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #10b981;border-radius:0 14px 14px 0;padding:14px 16px;margin:14px 0;color:#064e3b;line-height:1.7}
  .kb-article .kb-example .kb-example-badge{display:inline-flex;gap:6px;align-items:center;background:#10b981;color:#fff;font-size:.7rem;font-weight:700;padding:3px 11px;border-radius:999px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
  .kb-article .mermaid-wrap{margin:16px 0;max-width:100%;overflow-x:auto;overflow-y:hidden}
  .kb-article .mermaid{text-align:center;overflow:visible;padding:14px 10px;border:1px dashed var(--border-accent,rgba(79,70,229,.35));border-radius:12px;background:#fbfcff;display:block;min-height:24px}
  .kb-article .mermaid svg{display:block;width:100%!important;max-width:100%!important;height:auto!important;min-width:0;margin:0 auto;overflow:visible}
  .kb-article .mermaid svg foreignObject{overflow:visible}
  .kb-article .mermaid-src summary{cursor:pointer;font-size:.78rem;color:var(--text-muted,#64748b)}
  .kb-article .mermaid-src pre{font-size:.72rem;padding:10px;margin-top:6px}
  .kb-article hr{border:none;border-top:1px dashed var(--border,#e5e9f2);margin:24px 0}
  .kb-unit{margin-bottom:26px}
  .kb-page-mode .kb-articles{perspective:1600px}.kb-page-mode .kb-unit{display:none;min-height:72vh;margin-bottom:0;animation-duration:.42s;animation-fill-mode:both}.kb-page-mode .kb-unit.kb-page-active{display:block}.kb-page-mode .kb-unit.kb-turn-next{animation-name:kbTurnNext}.kb-page-mode .kb-unit.kb-turn-prev{animation-name:kbTurnPrev}@keyframes kbTurnNext{from{opacity:0;transform:rotateY(-7deg) translateX(26px)}to{opacity:1;transform:none}}@keyframes kbTurnPrev{from{opacity:0;transform:rotateY(7deg) translateX(-26px)}to{opacity:1;transform:none}}.kb-page-mode .kb-front-matter{display:none}.kb-page-mode .kb-book-cover{min-height:300px}.kb-page-mode .kb-unit{box-shadow:0 12px 30px rgba(15,23,42,.09);border-top:5px solid var(--kb-accent,#4338ca)}.kb-page-mode .kb-page-controls{position:sticky;bottom:12px;z-index:3;background:rgba(246,248,252,.92);padding:10px;border-radius:999px;backdrop-filter:blur(8px)}
  .kb-notice{display:flex;gap:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:12px 14px;font-size:.86rem;margin:22px 0 0;line-height:1.55}
  .kb-notice i{color:#ea580c;margin-top:3px}
  .kb-toast{position:fixed;bottom:66px;left:50%;transform:translateX(-50%) translateY(20px);background:#111827;color:#fff;padding:9px 16px;border-radius:999px;font-size:.82rem;font-weight:600;opacity:0;pointer-events:none;transition:.25s;z-index:1300}
  .kb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  .print-watermark{display:none}

  @media (max-width:920px){
    .kb-layout{grid-template-columns:1fr}
    .kb-toc{display:none}
    .kb-article{padding:20px 18px}
    .kb-paper{padding:26px 20px}.kb-front-grid{grid-template-columns:1fr}.kb-page-controls{gap:7px}.kb-page-label{font-size:.75rem;min-width:84px}.kb-cover-inner{padding:42px 20px}.kb-book-cover{min-height:470px}
    /* show mobile chapter button */
    .kb-desktop-toc-toggle{display:inline-flex!important}
  }
  .kb-desktop-toc-toggle{display:none}
  .kb-mobile-toggle-bar{display:flex;gap:10px;margin-bottom:16px}
  @media (min-width:921px){.kb-mobile-toggle-bar{display:none}}

  /* ============ PRINT / PDF LAYOUT ============ */
  @media print{
    body{background:#fff!important;padding:0!important}
    .no-print,.kb-toc,.print-watermark,.kb-progress-bar,.kb-toast,.kb-toolbar,.kb-mobile-toggle-bar,#kb-mobile-toc,.kb-side-ad,.kb-tb-btn,.kb-print-btn{display:none!important}
    .navbar-root,#nav,#footer,.footer{display:none!important}
    .kb-book{max-width:100%;padding:0}
    .kb-layout{display:block}
    .kb-book-cover{border-radius:0;margin:0 0 14px;page-break-after:avoid;color-adjust:exact;-webkit-print-color-adjust:exact}
    .kb-cover-inner{padding:30px 20px}
    .kb-article{border:none;box-shadow:none;padding:0 2mm 0 0;line-height:1.6;font-size:11pt}
    .kb-article{-webkit-user-select:text;-moz-user-select:text;user-select:text}
    .kb-article table{font-size:9.5pt}
    .kb-article pre{white-space:pre-wrap;word-break:break-word}
    .kb-article{margin-bottom:0}
    .kb-notice{page-break-inside:avoid;background:#fff;border-color:#ddd;color:#555}
    h1,h2,h3{page-break-after:avoid}
    p,li,blockquote,table,.kb-unit{page-break-inside:avoid}
    @page{size:A4;margin:13mm 11mm;@bottom-center{content:"KhudKibook · khudkibook.in · ${esc(def.subject)}";font-size:8pt;color:#666;}@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:8pt;color:#666;}}
  }
  </style>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-Q14JJGGSPR"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-Q14JJGGSPR');
  </script>
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "yha6xlt986");
  </script>
</head>
<body style="${themeVars}" data-kb-theme="${theme.key}">
  <nav id="nav" class="navbar-root no-print"></nav>
  <div class="kb-progress-bar" id="kb-progress"></div>

  <main class="kb-book">
    <nav class="nv759 no-print" aria-label="Breadcrumb">
      <div class="nvl153">
        <a href="/">Home</a> &raquo; ${esc(def.branchLabel)} &raquo; <a href="${esc(def.page)}">${esc(def.subject)}</a> &raquo; Full Book
      </div>
    </nav>

    ${cover}
    ${frontMatter}

    <div class="kb-toolbar no-print">
      <div class="kb-tb-group">
        <button class="kb-tb-btn kb-desktop-toc-toggle" id="kb-toc-open" type="button"><i class="fas fa-list"></i> Chapters</button>
        <button class="kb-tb-btn" id="kb-reader-toggle" type="button"><i class="fas fa-book-open"></i> Page view</button>
        <span class="kb-tb-stat"><i class="fas fa-clock"></i> ~${totalMin} min read</span>
        <span class="kb-tb-stat"><i class="fas fa-file-lines"></i> ${totalWords.toLocaleString()} words</span>
      </div>
      <div class="kb-tb-group">
        <a class="kb-print-btn" href="javascript:window.print()"><i class="fas fa-download"></i> Download PDF</a>
      </div>
    </div>

    <div class="kb-page-controls no-print" id="kb-page-controls" aria-label="Book page controls">
      <button class="kb-tb-btn" id="kb-page-prev" type="button"><i class="fas fa-arrow-left"></i> Previous page</button>
      <span id="kb-page-label" class="kb-page-label">Page 1 of ${totalUnits}</span>
      <button class="kb-tb-btn" id="kb-page-next" type="button">Next page <i class="fas fa-arrow-right"></i></button>
    </div>

    <div class="kb-mobile-toggle-bar no-print">
      <button class="kb-tb-btn" id="kb-toc-open" type="button"><i class="fas fa-list"></i> Chapters</button>
      <a class="kb-print-btn" href="javascript:window.print()"><i class="fas fa-download"></i> PDF</a>
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

  <div id="kb-mobile-toc" class="kb-mobile-toc no-print" aria-hidden="true">
    <div class="mob-toc-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <strong style="font-size:.95rem">Chapters</strong>
        <button id="kb-toc-close" class="kb-tb-btn" type="button" style="padding:6px 10px"><i class="fas fa-times"></i></button>
      </div>
      ${tocHtml}
      <a class="back-link" href="${esc(def.page)}"><i class="fas fa-arrow-left"></i> Back to ${esc(def.subject)}</a>
    </div>
  </div>

  <div class="print-watermark" aria-hidden="true">
    <span>KHUDKIBOOK</span><span>KHUDKIBOOK</span><span>KHUDKIBOOK</span><span>KHUDKIBOOK</span>
  </div>
  <div class="kb-toast no-print" id="kb-toast">Protected by KhudKibook – please purchase the original.</div>

  <script type="text/javascript" src="/ru444ts.js?v=2.1" defer></script>
  <script type="text/javascript" src="/select.js?v=2.1" defer></script>
  <script type="text/javascript" src="/ad-injector.js?v=2.1" defer></script>
  ${mermaidScript}
  <script>${readerScript}</script>
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

  // "both" means publish every language that is actually available. English
  // is always built; Gujarati is added when translated unit pages exist.
  const hasGujaratiSource = (() => {
    try { return fs.readdirSync(path.join(ROOT, 'data', 'ai_books', code)).some(f => /^unit-\d+\.gu\.md$/.test(f)); } catch (_) { return false; }
  })();
  const langs = opts.lang === 'both'
    ? (hasGujaratiSource ? ['en', 'gu'] : ['en'])
    : [opts.lang];
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
      const min = parseInt(matchOne(/(\d+)\s*min read/, rawHtml, 1), 10) || 0;
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