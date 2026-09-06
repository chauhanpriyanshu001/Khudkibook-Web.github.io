/**
 * Builds the static HTML reader page for an AI-generated GTU book unit.
 *
 * Usage:
 *   node scripts/ai_book/build_book_page.js --code 4360302 --unit 1
 *   node scripts/ai_book/build_book_page.js --code 4360302 --unit 1 --lang gu
 *
 * Reads:
 *   data/ai_books/<code>/unit-<n>.md            (english)
 *   data/ai_books/<code>/unit-<n>.gu.md         (gujarati, optional)
 *
 * Writes:
 *   public/books/<code>/unit-<n>.html
 *   public/books/<code>/unit-<n>-gu.html        (gujarati, optional)
 *   public/books/<code>/unit-<n>.json           (structured sidecar for apps)
 *   public/books/<code>/book.json               (manifest)
 *
 * Phase 1 feature set: reading progress, scrollspy TOC, reading-time + marks
 * meta, prev/next units, Gujarati toggle link, improved ad slots (in-article +
 * sticky mobile footer, lazy loaded), print/PDF layout with KHUDKIBOOK
 * watermark, light copy protection, Article/Book JSON-LD, JSON sidecars.
 * Phase 2 adds Mermaid rendering and example cards.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SITE_URL = 'https://khudkibook.in';

// Subject page routing metadata (kept minimal; extend as subjects are generated)
const SUBJECT_PAGES = {
  '4360302': {
    title: 'Biomaterials & Implants',
    branchLabel: 'Diploma Electrical Engineering',
    page: '/electrical/sem6/biomaterials-and-implants.html',
    subjectPageTitle: 'Biomaterials & Implants – GTU Diploma Electrical Engineering Sem 6'
  }
};

function subjectInfo(code) {
  if (SUBJECT_PAGES[code]) return SUBJECT_PAGES[code];
  try {
    const p = path.join(ROOT, 'data', 'ai_books', String(code), 'unitdef.json');
    if (fs.existsSync(p)) {
      const d = JSON.parse(fs.readFileSync(p, 'utf8'));
      const title = d.subject || `Subject ${code}`;
      return {
        title,
        branchLabel: d.branchLabel || 'GTU',
        page: d.page || '/',
        subjectPageTitle: `${title} – GTU`
      };
    }
  } catch (_) { /* ignore */ }
  return { title: `Subject ${code}`, branchLabel: 'GTU', page: '/', subjectPageTitle: `Subject ${code}` };
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return String(text).toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9\u0a80-\u0aff]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sec';
}

// Ad slot shell (AdSense injects when the push script runs)
function adSlot(extraClass) {
  return `<div class="ad-slot-wrapper no-print ${extraClass || ''}">
      <span class="ad-label">Advertisement</span>
      <div class="ad-container ad-container--auto">
        <ins class="adsbygoogle" style="display:block;" data-ad-client="ca-pub-4211827566541334" data-ad-slot="4067607591" data-ad-format="auto" data-full-width-responsive="true"></ins>
      </div>
    </div>`;
}

// ------------------------------------------------------------------
// Minimal Markdown -> HTML (book content only; we control the model's format)
// Mutates `toc` with { id, level, text } for every heading >= h2.
// --------------------------------------------------------------
function inlineMd(t) {
  return t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\s*<Figure:\s*(.*?)>\s*/g, '<div class="fig-callout"><i class="fas fa-image"></i> Figure: $1 (draw/diagram outlined in text)</div>')
    .trim();
}

function tableRow(line) {
  const cells = line.replace(/^\||\|$/g, '').split('|').map(c => {
    const mx = c.trim().replace(/\*\*/g, '');
    return `<td>${mx}</td>`;
  }).join('');
  return `<tr>${cells}</tr>`;
}

function markdownToHtml(md, toc, opts) {
  const isGu = !!(opts && opts.isGu);
  const lines = md.split(/\r?\n/);
  const out = [];
  let inUl = false, inOl = false, inTable = false, inCode = false, codeBuf = [], codeLang = '';
  const slugCounts = {};
  let headingSeq = 0;

  const makeId = (text) => {
    const base = slugify(text);
    slugCounts[base] = (slugCounts[base] || 0) + 1;
    return slugCounts[base] === 1 ? base : `${base}-${slugCounts[base]}`;
  };

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { closeList(); if (inTable) { out.push('</table>'); inTable = false; } continue; }

    if (line.startsWith('```')) {
      closeList();
      const lang = line.trim().replace(/^```/, '');
      if (inCode) {
        if (codeLang === 'mermaid') {
          const src = codeBuf.join('\n');
          out.push(`<div class="mermaid-wrap"><div class="mermaid">${esc(src)}</div><details class="mermaid-src"><summary>Diagram source</summary><pre>${esc(src)}</pre></details><noscript><pre class="mermaid-src">${esc(src)}</pre></noscript></div>`);
        } else if (codeBuf.length) {
          out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
        }
        codeBuf = []; inCode = false; codeLang = '';
      } else { inCode = true; codeLang = lang; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length; // 1..4
      const text = h[2].trim();
      const tagLevel = level + 1; // h2..h5
      if (tagLevel === 2 || tagLevel === 3) {
        const id = makeId(text);
        out.push(`<${'h' + tagLevel} id="sec-${id}">${inlineMd(text)}</${'h' + tagLevel}>`);
        if (toc) toc.push({ id, level: tagLevel, text: text.replace(/\*\*/g, '') });
        headingSeq++;
        // Insert the single in-article ad after the 3rd content heading.
        if (headingSeq === 3) out.push(adSlot('ad-inarticle'));
      } else {
        out.push(`<${'h' + tagLevel}>${inlineMd(text)}</${'h' + tagLevel}>`);
      }
      continue;
    }

    const isTableSep = /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-') && line.includes('|') && !line.includes('—') && !line.includes('–');
    if (inTable && isTableSep) continue; // header separator row
    if (line.trim().startsWith('|') && line.endsWith('|')) {
      closeList();
      const cells = line.replace(/^\||\|$/g, '').split('|');
      if (!inTable) {
        out.push('<table>');
        out.push('<thead><tr>' + cells.map(c => `<th>${c.trim().replace(/\*\*/g, '')}</th>`).join('') + '</tr></thead><tbody>');
        if (i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) i++;
        inTable = true;
      } else {
        out.push(tableRow(line));
      }
      continue;
    }
    if (inTable) { out.push('</table>'); inTable = false; }

    const hb = line.match(/^(-{3,}|\*{3,})$/);
    if (hb) { closeList(); out.push('<hr />'); continue; }

    if (line.startsWith('>')) {
      // Fold consecutive blockquote lines into one block; render as a styled
      // example card when the block starts with an Example marker.
      closeList();
      const bqLines = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        bqLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      i--;
      const first = bqLines[0] || '';
      const isEx = /^\s*(\*\*)?(Example|ઉદાહરણ)\s*[:：]?\s*(\*\*)?\s*/i.test(first);
      let bodyLines = bqLines;
      if (isEx) {
        bodyLines = [first.replace(/^\s*(\*\*)?(Example|ઉદાહરણ)\s*[:：]?\s*(\*\*)?\s*/i, ''), ...bqLines.slice(1)];
      }
      const body = bodyLines.map(l => inlineMd(l)).join('<br />');
      out.push(isEx
        ? `<div class="kb-example"><div class="kb-example-badge"><i class="fas fa-pen"></i> ${isGu ? 'ઉદાહરણ' : 'Example'}</div>${body}</div>`
        : `<blockquote>${body}</blockquote>`);
      continue;
    }

    const ul = line.match(/^\s*[-•]\s+(.*)$/);
    if (ul) {
      if (!inUl) { closeList(); out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineMd(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (!inOl) { closeList(); out.push('<ol>'); inOl = true; }
      out.push(`<li>${inlineMd(ol[1])}</li>`);
      continue;
    }
    if (line.includes('<Figure:')) { closeList(); out.push(inlineMd(line)); continue; }

    closeList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeList();
  if (inTable) out.push('</table>');
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);

  return out.join('\n');
}

// Split markdown into heading-anchored sections for the JSON sidecar.
function parseSections(md, opts) {
  const lines = md.split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      if (cur && cur.lines.join('\n').trim()) sections.push(cur);
      cur = { heading: h[2].trim(), level: h[1].length + 1, lines: [], id: '' };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur && cur.lines.join('\n').trim()) sections.push(cur);
  if (sections.length === 0) sections.push({ heading: 'Overview', level: 2, lines: lines, id: '' });

  return sections.map(sec => {
    const html = markdownToHtml(sec.lines.join('\n'), null, opts);
    // collect examples and mermaid sources found in this section (line-based,
    // mirroring the blockquote folding + fenced-code logic in markdownToHtml)
    const examples = [];
    const mermaid = [];
    const secLines = sec.lines;
    for (let i = 0; i < secLines.length; i++) {
      const ln = secLines[i];
      if (ln.trimStart().startsWith('```mermaid')) {
        const buf = [];
        i++;
        while (i < secLines.length && !/^\s*```\s*$/.test(secLines[i])) { buf.push(secLines[i]); i++; }
        mermaid.push(buf.join('\n').trim());
        continue;
      }
      if (!ln.trimStart().startsWith('>')) continue;
      // gather the full blockquote block
      const block = [];
      while (i < secLines.length && secLines[i].trimStart().startsWith('>')) {
        block.push(secLines[i].replace(/^\s*>\s?/, '').trim());
        i++;
      }
      i--;
      const first = block[0] || '';
      // detect an Example marker at the start (EN or GU)
      const exMark = first.match(/^(\*\*)?(Example|ઉદાહરણ)\s*[:：]?\s*(\*\*)?\s*/i);
      if (exMark) {
        block[0] = first.slice(exMark[0].length).trim();
        examples.push(block.filter(Boolean).join(' '));
      }
    }
    return {
      heading: sec.heading.replace(/\*\*/g, ''),
      id: sec.id,
      html,
      examples,
      mermaid
    };
  });
}

// ------------------------------------------------------------------
// Page assembly
// ------------------------------------------------------------------
function buildPage({ code, unitInfo, contentHtml, toc, title, description, stats, guHref, lang, hasMermaid }) {
  const info = subjectInfo(code);
  const canonical = `${SITE_URL}/books/${code}/${lang === 'gu' ? `unit-${unitInfo.n}-gu` : `unit-${unitInfo.n}`}.html`;
  const isGu = lang === 'gu';
  const htmlLang = isGu ? 'gu' : 'en';

  const tocUnits = (unitInfo.units || []).map(u => {
    const cur = u.n === unitInfo.n;
    const base = isGu && u.guFile ? `unit-${u.n}-gu` : `unit-${u.n}`;
    return `<a class="toc-item ${cur ? 'toc-active' : ''}" href="${base}.html"><i class="fas fa-book-open"></i> ${esc(u.label)}</a>`;
  }).join('\n');

  const tocSections = (toc || []).map(s => {
    return `<a class="toc-item toc-sec" href="#sec-${s.id}"><i class="fas fa-chevron-right"></i> ${esc(s.text)}</a>`;
  }).join('\n');

  const prevNext =
    (unitInfo.prev ? `<a class="pn-btn" href="${isGu ? `unit-${unitInfo.prev.n}-gu` : `unit-${unitInfo.prev.n}`}.html"><i class="fas fa-chevron-left"></i> ${esc(unitInfo.prev.short)}</a>` : `<span class="pn-btn disabled">${esc(isGu ? 'એકમ 1' : 'Unit 1')}</span>`)
    + (unitInfo.next ? `<a class="pn-btn" href="${isGu ? `unit-${unitInfo.next.n}-gu` : `unit-${unitInfo.next.n}`}.html">${esc(unitInfo.next.short)} <i class="fas fa-chevron-right"></i></a>` : `<span class="pn-btn disabled">${esc(unitInfo.label)}</span>`);

  const hreflang = !isGu && guHref
    ? `<link rel="alternate" hreflang="gu" href="${SITE_URL}/books/${code}/unit-${unitInfo.n}-gu.html" />`
    : isGu
      ? `<link rel="alternate" hreflang="en" href="${SITE_URL}/books/${code}/unit-${unitInfo.n}.html" />`
      : '';

  const langToggle = guHref || isGu
    ? (isGu
        ? `<a class="kb-lang-btn no-print" href="unit-${unitInfo.n}.html"><i class="fas fa-language"></i> English</a>`
        : `<a class="kb-lang-btn no-print" href="unit-${unitInfo.n}-gu.html"><i class="fas fa-language"></i> ગુજરાતી</a>`)
    : '';

  const metaLine = `<div class="kb-meta">
      <span><i class="fas fa-clock"></i> ${stats.readingMin} min read</span>
      ${stats.marks ? `<span><i class="fas fa-bullseye"></i> ${stats.marks}</span>` : ''}
      ${langToggle}
      <a class="kb-print-btn no-print" href="javascript:window.print()"><i class="fas fa-download"></i> ${isGu ? 'PDF ડાઉનલોડ' : 'Download PDF'}</a>
    </div>`;

  const guFont = isGu ? `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />` : '';

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="keywords" content="GTU ${info.title.toLowerCase()}, ${code}, ${unitInfo.label.toLowerCase()}, ${isGu ? 'gtu ગુજરાતી અભ્યાસ સામગ્રી' : 'diploma biomedical engineering'}, ai book, khudkibook" />
  <meta name="description" content="${esc(description)}" />
  <meta name="author" content="KhudKibook" />
  <meta name="theme-color" content="#4f46e5" />
  <link rel="canonical" href="${canonical}" />
  ${hreflang}
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="KhudKibook" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/brand/favicon-32x32.png?v=2" />
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/brand/khudkibook-logo.png?v=2" />
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Article",
    headline: title, description, url: canonical,
    author: { "@type": "Organization", name: "KhudKibook" },
    about: { "@type": "Course", name: info.title, courseCode: code },
    publisher: { "@type": "Organization", name: "KhudKibook" },
    inLanguage: htmlLang, isAccessibleForFree: true
  })}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Book",
    name: `${info.title} – ${unitInfo.label}`,
    url: canonical, inLanguage: htmlLang,
    author: { "@type": "Organization", name: "KhudKibook" },
    isbn: undefined, numberOfPages: Math.max(1, Math.ceil(stats.words / 500)),
    about: { "@type": "Course", name: info.title, courseCode: code }
  })}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
  ${guFont}
  <link rel="preload" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <link rel="stylesheet" href="/be619.css?v=2.1" />
  <style>
    html{scroll-behavior:smooth}
    body{font-family:${isGu ? "'Inter','Noto Sans Gujarati',sans-serif" : "'Inter',sans-serif"}}
    .kb-progress-bar{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,#4f46e5,#7c3aed);z-index:1200;transition:width .1s linear}
    .kb-book{max-width:880px;margin:0 auto;padding:0 16px 60px}
    .kb-book-head{background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);border-radius:18px;padding:26px 26px 22px;color:#fff;margin:18px 0 20px;box-shadow:var(--shadow-glow)}
    .kb-book-head .kb-kicker{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;opacity:.85;font-weight:700}
    .kb-book-head h1{font-family:'Outfit',sans-serif;font-size:clamp(1.35rem,3.5vw,2rem);margin:6px 0 4px;line-height:1.25}
    .kb-book-head .kb-sub{opacity:.92;font-size:.95rem;font-weight:600}
    .kb-meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px;font-size:.85rem;font-weight:600}
    .kb-meta span{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);padding:5px 11px;border-radius:999px}
    .kb-badge{display:inline-flex;gap:6px;align-items:center;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);padding:4px 10px;border-radius:999px;font-size:.72rem;font-weight:700;margin-top:10px}
    .kb-lang-btn,.kb-print-btn{display:inline-flex;gap:6px;align-items:center;background:#fff;color:var(--accent-darca,#3730a3);padding:6px 13px;border-radius:999px;font-weight:700;font-size:.8rem;text-decoration:none;border:1px solid rgba(255,255,255,.4);transition:.15s}
    .kb-lang-btn:hover,.kb-print-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.18)}
    .kb-layout{display:grid;grid-template-columns:240px 1fr;gap:22px}
    .kb-toc{position:sticky;top:84px;align-self:start;background:#fff;border:1px solid var(--border);border-radius:14px;padding:14px;box-shadow:var(--shadow-sm);max-height:calc(100vh - 110px);overflow:auto}
    .kb-toc h4{margin:14px 0 8px;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}
    .kb-toc h4:first-child{margin-top:0}
    .kb-toc .toc-item{display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:9px;color:var(--text-secondary);text-decoration:none;font-size:.88rem;font-weight:600;margin-bottom:4px;border:1px solid transparent;transition:.15s}
    .kb-toc .toc-item:hover{background:var(--bg-soft);color:var(--accent)}
    .kb-toc .toc-item.toc-active{background:var(--accent-gradient);color:#fff;box-shadow:var(--shadow-glow)}
    .kb-toc .toc-sec{font-size:.8rem;padding:5px 8px;font-weight:500}
    .kb-toc .back-link{display:block;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:.85rem;color:var(--accent);text-decoration:none;font-weight:700}
    .kb-article{background:#fff;border:1px solid var(--border);border-radius:16px;padding:26px 30px;box-shadow:var(--shadow-sm);line-height:1.75;color:var(--text-primary);min-width:0}
    .kb-article h2{font-family:'Outfit',sans-serif;font-size:1.35rem;margin:26px 0 10px;padding-bottom:8px;border-bottom:2px solid var(--bg-soft);color:var(--accent-dark);scroll-margin-top:90px}
    .kb-article h3{font-size:1.1rem;margin:20px 0 8px;color:var(--text-primary);scroll-margin-top:90px}
    .kb-article h4{font-size:1rem;margin:16px 0 6px}
    .kb-article p{margin:10px 0}
    .kb-article ul,.kb-article ol{margin:10px 0 10px 22px}
    .kb-article li{margin:5px 0}
    .kb-article strong{color:var(--text-primary)}
    .kb-article table{width:100%;border-collapse:collapse;margin:14px 0;font-size:.92rem}
    .kb-article th,.kb-article td{border:1px solid var(--border);padding:8px 10px;text-align:left}
    .kb-article th{background:var(--bg-soft);font-weight:700;color:var(--text-primary)}
    .kb-article code{background:var(--bg-soft);padding:2px 6px;border-radius:6px;font-size:.9em}
    .kb-article pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px;overflow:auto}
    .kb-article blockquote{border-left:4px solid var(--accent);background:var(--bg-glass);padding:10px 14px;border-radius:0 10px 10px 0;margin:12px 0;color:var(--text-secondary)}
    .kb-article .fig-callout{background:var(--bg-soft);border:1.5px dashed var(--border-accent);border-radius:12px;padding:14px 16px;margin:14px 0;color:var(--text-secondary);font-size:.92rem;display:flex;gap:10px;align-items:flex-start}
    .kb-article .fig-callout i{color:var(--accent);margin-top:3px}
    /* example cards */
    .kb-article .kb-example{background:#ecfdf5;border:1px solid #a7f3d0;border-left:4px solid #10b981;border-radius:0 14px 14px 0;padding:14px 16px;margin:14px 0;color:#064e3b;line-height:1.7}
    .kb-article .kb-example .kb-example-badge{display:inline-flex;gap:6px;align-items:center;background:#10b981;color:#fff;font-size:.7rem;font-weight:700;padding:3px 11px;border-radius:999px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
    /* mermaid */
    .kb-article .mermaid-wrap{margin:16px 0}
    .kb-article .mermaid{text-align:center;overflow-x:auto;padding:14px 10px;border:1px dashed var(--border-accent);border-radius:12px;background:#fbfcff}
    .kb-article .mermaid svg{max-width:100%;height:auto}
    .kb-article .mermaid-src summary{cursor:pointer;font-size:.78rem;color:var(--text-muted)}
    .kb-article .mermaid-src pre{font-size:.72rem;padding:10px;margin-top:6px}
    .kb-article hr{border:none;border-top:1px dashed var(--border);margin:24px 0}
    /* copy protection */
    .kb-article{-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-touch-callout:none}
    .kb-pn{display:flex;justify-content:space-between;gap:12px;margin-top:22px}
    .pn-btn{flex:1;display:flex;align-items:center;gap:8px;justify-content:center;padding:12px;border-radius:12px;background:#fff;border:1px solid var(--border);color:var(--accent);text-decoration:none;font-weight:700;font-size:.9rem;box-shadow:var(--shadow-sm);transition:.15s}
    .pn-btn:hover{border-color:var(--border-accent);background:var(--bg-glass)}
    .pn-btn.disabled{opacity:.55;cursor:not-allowed;color:var(--text-muted)}
    .kb-notice{display:flex;gap:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:12px 14px;font-size:.88rem;margin:18px 0 0;line-height:1.55}
    .kb-notice i{color:#ea580c;margin-top:3px}
    .kb-side-ad{border:1px solid var(--border);border-radius:14px;background:#fff;padding:10px;text-align:center;margin-top:14px;box-shadow:var(--shadow-sm)}
    .ad-inarticle{margin:18px 0}
    .kb-toast{position:fixed;bottom:66px;left:50%;transform:translateX(-50%) translateY(20px);background:#111827;color:#fff;padding:9px 16px;border-radius:999px;font-size:.82rem;font-weight:600;opacity:0;pointer-events:none;transition:.25s;z-index:1300}
    .kb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    /* watermark (screen: hidden; print: per-page diagonal tiles) */
    .print-watermark{display:none}
    @media (max-width:900px){.kb-layout{grid-template-columns:1fr}.kb-toc{position:static;max-height:none}.kb-article{padding:18px 16px}}
    @media print{
      body{background:#fff;padding:0!important}
      .no-print,.kb-toc,.kb-pn,.kb-side-ad,.kb-lang-btn,.kb-print-btn,.kb-meta span{display:none!important}
      .kb-book{max-width:100%;padding:0}
      .kb-layout{display:block}
      .kb-book-head{border-radius:0;margin:0 0 12px;color-adjust:exact;-webkit-print-color-adjust:exact}
      .kb-article{border:none;box-shadow:none;padding:0 2mm 0 0;line-height:1.6;font-size:11pt}
      .kb-article{-webkit-user-select:text;-moz-user-select:text;user-select:text}
      .kb-article table{font-size:9.5pt}
      .kb-article pre{white-space:pre-wrap;word-break:break-word}
      .kb-notice{page-break-inside:avoid;background:#fff;border-color:#ddd;color:#555;margin:14px 0}
      .print-watermark{display:flex;position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;flex-direction:column;justify-content:space-between;pointer-events:none}
      .print-watermark span{display:block;transform:rotate(-28deg);font-size:84px;font-weight:800;color:#000;opacity:.06;letter-spacing:10px;white-space:nowrap;font-family:'Outfit',sans-serif}
      h2,h3{page-break-after:avoid}
      p,li,blockquote,table{page-break-inside:avoid}
      @page{size:A4;margin:13mm 11mm;@bottom-center{content:"KhudKibook · KhudKibook-Web.github.io";font-size:8pt;color:#666;}@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:8pt;color:#666;}}
    }
  </style>
</head>
<body>
  <nav id="nav" class="navbar-root no-print"></nav>
  <div class="kb-progress-bar" id="kb-progress"></div>

  <main class="kb-book">
    <nav class="nv759 no-print" aria-label="Breadcrumb">
      <div class="nvl153">
        <a href="/">Home</a> &raquo; <a href="/diplomahomepage.html">Diploma</a> &raquo;
        <a href="${info.page}">${esc(info.title)}</a> &raquo; ${esc(unitInfo.label)}
      </div>
    </nav>

    <div class="kb-book-head">
      <div class="kb-kicker">KhudKibook · GTU AI Self Study Book</div>
      <h1>${esc(unitInfo.label)}</h1>
      <div class="kb-sub">${esc(info.title)} (${code}) · ${esc(info.branchLabel)}</div>
      ${metaLine}
      <div style="margin-top:10px"><span class="kb-badge"><i class="fas fa-robot"></i> ${isGu ? 'AI દ્વારા તૈયાર કરેલ સ્વ-અભ્યાસ સામગ્રી · અધિકૃત syllabus સાથે ચકાસો' : 'AI-generated study material · always cross-check with official syllabus'}</span></div>
    </div>

    <div class="kb-layout">
      <aside class="kb-toc no-print">
        <h4>${isGu ? 'એકમો (Units)' : 'Chapters'}</h4>
        ${tocUnits}
        <h4>${isGu ? 'આ એકમમાં' : 'In this chapter'}</h4>
        ${tocSections}
        <a class="back-link" href="${info.page}"><i class="fas fa-arrow-left"></i> ${isGu ? 'વિષય પર પાછા' : 'Back to'} ${esc(info.title)}</a>
      </aside>

      <article class="kb-article">
        ${contentHtml}

        <nav class="kb-pn no-print">${prevNext}</nav>

        <div class="kb-notice">
          <i class="fas fa-info-circle"></i>
          <div><strong>${isGu ? 'નોંધ:' : 'Note:'}</strong> ${isGu
            ? 'આ પ્રકરણ AI દ્વારા ગુજરાતીમાં ભાષાંતર કરેલી સ્વ-અભ્યાસ સામગ્રી છે, જે GTU syllabus (' + code + ') પર આધારિત છે. આ સત્તાવાર GTU પ્રકાશન નથી. પરીક્ષા પહેલાં તમારા સત્તાવાર syllabus PDF અને પાઠ્યપુસ્તકો સાથે ચકાસો.' 
            : `This chapter is AI-generated as a self-study aid mapped to the GTU syllabus (${code}) for ${esc(info.title)}. It is not an official GTU publication. Verify details against your official syllabus PDF and textbooks before examinations.`}</div>
        </div>
      </article>
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
  <script>
  (function () {
    var art = document.querySelector('.kb-article');
    var bar = document.getElementById('kb-progress');
    function onScroll() {
      var st = window.scrollY || document.documentElement.scrollTop;
      var h = (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;
      if (bar && h > 0) bar.style.width = Math.min(100, st / h * 100) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var links = [].slice.call(document.querySelectorAll('.toc-sections a,.toc-sec'));
    if ('IntersectionObserver' in window && links.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            var t = '#sec-' + (e.target.id || '');
            links.forEach(function (a) { a.classList.toggle('toc-active', a.getAttribute('href') === t); });
          }
        });
      }, { rootMargin: '-15% 0px -75% 0px' });
      [].slice.call(document.querySelectorAll('.kb-article h2[id],.kb-article h3[id]')).forEach(function (s) { io.observe(s); });
    }

    var lazy = [].slice.call(document.querySelectorAll('.ad-lazy'));
    if ('IntersectionObserver' in window && lazy.length && !(window.KB_AdInjector && window.KB_AdInjector.config)) {
      // ad-injector.js owns all ad placement/hydration on modern pages; only
      // fall back to manual pushes when the injector is absent.
      var io2 = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target;
          io2.unobserve(el);
          var s = document.createElement('script');
          s.async = true;
          s.text = '(adsbygoogle = window.adsbygoogle || []).push({});';
          el.appendChild(s);
        });
      }, { rootMargin: '260px' });
      lazy.forEach(function (el) { io2.observe(el); });
    }

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
    document.addEventListener('selectstart', function (e) { if (inArt(e.target)) { /* CSS handles; no-op */ } });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && inArt(document.activeElement)) { e.preventDefault(); toast(); }
    });
  })();
  </script>
  ${hasMermaid ? `  <script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
  <script>
  (function () {
    function init() {
      if (!window.mermaid) return;
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', flowchart: { htmlLabels: true, curve: 'basis' } });
      var nodes = [].slice.call(document.querySelectorAll('.mermaid'));
      nodes.forEach(function (el) {
        if (el.dataset.kbMermaidRun) return;
        el.dataset.kbMermaidRun = '1';
        mermaid.run({ nodes: [el] }).catch(function () {
          el.classList.add('mermaid-failed');
          el.innerHTML = '<div style="padding:8px;color:#9ca3af;font-style:italic;font-size:.85rem">Diagram could not render \u2014 see source below.</div>';
        });
      });
    }
    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
    setTimeout(init, 1400);
  })();
  </script>` : ''}
</body>
</html>`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code') opts.code = args[++i];
    else if (args[i] === '--unit') opts.unit = parseInt(args[++i], 10);
    else if (args[i] === '--lang') opts.lang = args[++i] === 'gu' ? 'gu' : 'en';
  }
  return opts;
}

function wordStats(md) {
  const text = md.replace(/[#>*`|\[_\]-]/g, ' ').replace(/[“”()\d.,:;]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  const readingMin = Math.max(1, Math.round(words / 180));
  const marksMatch = md.match(/\*\*([0-9]+\s*marks?[^*]*)\*\*/i);
  const marks = marksMatch ? marksMatch[1] : '';
  return { words, readingMin, marks };
}

function main() {
  const { code, unit, lang = 'en' } = parseArgs();
  if (!code || !unit) { console.error('Usage: node scripts/ai_book/build_book_page.js --code 4360302 --unit 1 [--lang gu]'); process.exit(1); }

  const dataDir = path.join(ROOT, 'data', 'ai_books', String(code));
  const mdPath = path.join(dataDir, lang === 'gu' ? `unit-${unit}.gu.md` : `unit-${unit}.md`);
  if (!fs.existsSync(mdPath)) { console.error('Markdown not found:', mdPath); process.exit(1); }

  const info = subjectInfo(code);

  // Prefer the unit title from an existing unitdef (auto-parsed syllabus), else the md's first heading.
  let titleLine = (fs.readFileSync(mdPath, 'utf8').match(/^#\s+(.+)$/m) || [])[1] || `Unit ${unit}`;
  const unitdefPath = path.join(dataDir, 'unitdef.json');
  if (lang === 'gu' && fs.existsSync(unitdefPath)) {
    try {
      const def = JSON.parse(fs.readFileSync(unitdefPath, 'utf8'));
      const u = (def.units || []).find(x => x.n === unit);
      if (u && u.titleGu) titleLine = u.titleGu;
      else if (u && u.title) titleLine = `Unit – ${u.title}`;
    } catch (_) { /* fallback to md heading */ }
  }

  const guMdExists = fs.existsSync(path.join(dataDir, `unit-${unit}.gu.md`));

  const unitInfo = {
    n: unit,
    label: titleLine,
    short: titleLine.replace(/^Unit[\s–-]+/i, '').trim() || `Unit ${unit}`,
    units: [{ n: 1, label: 'Unit – I' }] // extended automatically via book.json
  };

  // Pull unit list from existing manifest when available
  const manifestPath = path.join(ROOT, 'public', 'books', code, 'book.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (m.units && m.units.length) {
        unitInfo.units = m.units.map(u => ({ n: u.n, label: u.label, guFile: u.guFile }));
      }
    } catch (_) { /* keep default */ }
  }

  if (unit > 1) unitInfo.prev = { n: unit - 1, short: `Unit ${unit - 1}` };
  unitInfo.next = null;

  const md = fs.readFileSync(mdPath, 'utf8');
  const toc = [];
  const contentHtml = markdownToHtml(md, toc, { isGu: lang === 'gu' });
  const stats = wordStats(md);
  const hasMermaid = md.includes('```mermaid');
  const guHref = lang === 'en' && guMdExists ? `/books/${code}/unit-${unit}-gu.html` : null;

  const title = `${titleLine} – ${info.title} (${code}) | KhudKibook AI Book`;
  const desc = `AI-generated self study book | ${info.title} | ${titleLine}${lang === 'gu' ? ' (Gujarati)' : ''} – GTU study material on KhudKibook.`;

  const page = buildPage({ code, unitInfo, contentHtml, toc, title, description: desc, stats, guHref, lang, hasMermaid });

  const outFile = lang === 'gu' ? `unit-${unit}-gu.html` : `unit-${unit}.html`;
  const outPath = path.join(ROOT, 'public', 'books', code, outFile);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, page);
  console.log('Wrote', outPath, `(${page.length} bytes)`);

  // book.json manifest
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {
    code, subject: info.title, branchLabel: info.branchLabel, subjectPage: info.page, units: []
  };
  const entry = manifest.units.find(u => u.n === unit);
  const unitEntry = {
    n: unit,
    label: titleLine,
    file: `unit-${unit}.html`,
    guFile: fs.existsSync(path.join(dataDir, `unit-${unit}.gu.md`)) ? `unit-${unit}-gu.html` : null,
    words: stats.words,
    readingMin: stats.readingMin,
    marks: stats.marks
  };
  if (entry) Object.assign(entry, unitEntry); else manifest.units.push(unitEntry);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Wrote', manifestPath);

  // Structured JSON sidecar (always english sidecar; gu has its own)
  const sections = parseSections(md, { isGu: lang === 'gu' });
  const sidecar = {
    code,
    subject: info.title,
    unit: unit,
    lang: lang,
    title: titleLine,
    url: `/books/${code}/${outFile}`,
    guUrl: lang === 'en' && fs.existsSync(path.join(dataDir, `unit-${unit}.gu.md`)) ? `/books/${code}/unit-${unit}-gu.html` : null,
    words: stats.words,
    readingMin: stats.readingMin,
    marks: stats.marks,
    sections
  };
  fs.writeFileSync(path.join(ROOT, 'public', 'books', code, `unit-${unit}${lang === 'gu' ? '-gu' : ''}.json`), JSON.stringify(sidecar, null, 1));
  console.log('Wrote sidecar unit-' + unit + (lang === 'gu' ? '-gu' : '') + '.json');
}

if (require.main === module) main();
module.exports = { markdownToHtml, buildPage, parseSections, wordStats };