/**
 * Auto-build unit definitions from a GTU syllabus for ANY subject code.
 *
 * Sources (first hit wins):
 *   1. --text <file>      (existing extracted text; fastest for testing)
 *   2. --pdf <file>       (local PDF, parsed with pdf-parse)
 *   3. --code <code>      (prefer OUR OWN data: cached syllabus.txt in
 *                          data/ai_books/<code>/, then the syllabus link
 *                          stored in site_db.json, then crawled_gtu_syllabus.json,
 *                          then the GTU S3 bucket as last resort)
 *
 * Handles the common GTU syllabus layouts:
 *   - Degree (BE/ME)  "Unit-I.."          (older degree format)
 *   - Legacy diploma "CONTENT OUTLINE"    (older diploma format)
 *   - Degree (BE/ME)  "Module N:"         (new w.e.f. 2024-25 format, with
 *                                          per-module hours + weightage, and
 *                                          a References/Suggested Learning
 *                                          Resources section that is captured
 *                                          under def.references)
 *   - Degree (BE)     "Contents:" table   (tabular Sr.No./Topics/Teaching
 *                                          Hrs./Module Weightage layout, e.g.
 *                                          3110001 Chemistry)
 *
 * Writes an editable unitdef.json so a human can review/trim before generation:
 *   data/ai_books/<code>/unitdef.json
 *
 * Run: node scripts/ai_book/parse_syllabus.js --code 4360302
 *      node scripts/ai_book/parse_syllabus.js --text data/ai_books/4360302/syllabus.txt --code 4360302
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DB_PATH = path.join(ROOT, 'data', 'site_db.json');
const SYL_URL = code => `https://s3-ap-southeast-1.amazonaws.com/gtusitecirculars/Syallbus/${code}.pdf`;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code') opts.code = args[++i];
    else if (args[i] === '--text') opts.text = args[++i];
    else if (args[i] === '--pdf') opts.pdf = args[++i];
    else if (args[i] === '--force') opts.force = true;
  }
  return opts;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>]/g, '');
}

async function pdfToText(pdfBytes) {
  const { PDFParse } = require(path.join(ROOT, 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'cjs', 'index.cjs'));
  const parser = new PDFParse({ data: pdfBytes });
  try {
    const res = await parser.getText();
    return (res && res.text) || '';
  } finally {
    try { parser.destroy(); } catch (_) { /* noop */ }
  }
}

// Prefer OUR OWN data as the syllabus source-of-truth (user request):
//   1. cached syllabus text in data/ai_books/<code>/syllabus.txt
//   2. syllabus link stored in site_db.json (our master database)
//   3. crawled GTU syllabus data
//   4. default GTU S3 bucket pattern (last resort)
function findSyllabusLink(code) {
  const db = loadJson(DB_PATH);
  if (db) {
    for (const u of db.universities || []) {
      for (const d of u.domains || []) {
        for (const b of d.branches || []) {
          for (const s of b.semesters || []) {
            for (const sub of s.subjects || []) {
              if (String(sub.code) !== String(code)) continue;
              const syl = (sub.materials || []).find(m => String(m.type || '').toLowerCase() === 'syllabus');
              if (syl && /^https?:/.test(syl.link || '')) return { link: syl.link, source: 'site_db.json' };
            }
          }
        }
      }
    }
  }
  const crawled = loadJson(path.join(ROOT, 'data', 'crawled_gtu_syllabus.json')) || [];
  const hit = crawled.find(c => String(c.subjectCode || c.code) === String(code));
  if (hit && /^https?:/.test(hit.link || '')) return { link: hit.link, source: 'crawled_gtu_syllabus.json' };
  return { link: SYL_URL(code), source: 'GTU S3 default' };
}

async function loadText(opts) {
  if (opts.text) return { text: fs.readFileSync(opts.text, 'utf8'), source: opts.text };
  if (opts.pdf) return { text: await pdfToText(fs.readFileSync(opts.pdf)), source: opts.pdf };

  // already on disk from a previous parse — no re-download (--force overrides)
  const cachedTxt = path.join(ROOT, 'data', 'ai_books', String(opts.code), 'syllabus.txt');
  if (!opts.force && fs.existsSync(cachedTxt)) {
    console.log('Using cached syllabus text (our directory):', cachedTxt);
    return { text: fs.readFileSync(cachedTxt, 'utf8'), source: cachedTxt };
  }

  const { link, source } = findSyllabusLink(opts.code);
  console.log(`Downloading syllabus (via ${source}):`, link);
  const res = await fetch(link);
  if (!res.ok) throw new Error(`Syllabus download failed (${res.status}) for ${link}`);
  return { text: await pdfToText(Buffer.from(await res.arrayBuffer())), source: link };
}

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

// Find subject metadata from the site database (first placement).
function findSubjectMetadata(code) {
  const db = loadJson(DB_PATH);
  if (!db) return {};
  for (const u of db.universities || []) {
    for (const d of u.domains || []) {
      for (const b of d.branches || []) {
        for (const s of b.semesters || []) {
          for (const sub of s.subjects || []) {
            if (String(sub.code) === String(code)) {
              const prefix = b.urlPrefix ? `/${b.urlPrefix}` : '';
              return {
                subject: sub.name,
                slug: sub.slug || sub.code,
                branchLabel: `${u.name || ''} ${b.name || b.shortName || ''} ${s.name || ''}`.trim(),
                page: `${prefix}/${b.id}/${s.id}/${(sub.slug || sub.code)}.html`,
                semId: s.id
              };
            }
          }
        }
      }
    }
  }
  return { subject: `Subject ${code}`, slug: String(code), branchLabel: 'GTU', page: '/' };
}

// ----------------------------------------------------------------
// Text parsing (two-column GTU syllabus layout)
// ----------------------------------------------------------------
const UNIT_RE = /^\s*Unit[\s\-–]*([0-9]{1,2}|[IVX]+)[\s\-–]*$/im;
// legacy diploma format: sections under "CONTENT OUTLINE" with a H/T/P marks tail
const LEGACY_CNT_RE = /^\s*\d+\.?\s*(CONTENT\s+OUTLINE|DETAILED\s+SYLLABUS|UNIT\s+WISE\s+CONTENT|SYLLABUS\s*CONTENT)\s*:?$/i;
const LEGACY_HEAD_RE = /^(\d+)\.\s+([A-Z][^\d]*?)(?:\.)?\s*$/;
const LEGACY_TOPIC_RE = /^(\d+\.\d+(?:\.\d+)*)\.?\s+(.+)$/;
// sections that come after the real outline (references, lab lists, …) → stop collecting
const LEGACY_END_RE = /^\s*\d+\.?\s*(REFERENCES?|REFERENCE BOOKS|LABORATORY EXPERIEN|TERM WORK|INSTRUCTIONAL STRATEGY|MEANS OF ASSESSMENT|SUGGESTED SPECIFICATION|EVALUATION STRATEGY)/i;

function parseUnitsLegacy(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const candidates = [];
  let started = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (NOISE_RE.test(line) || /^PAGE\s*:/i.test(line) || /^--\s*\d+/.test(line)) continue;
    if (!started) {
      if (LEGACY_CNT_RE.test(line)) started = true;
      continue;
    }
    if (LEGACY_END_RE.test(line)) continue;
    const hum = line.match(LEGACY_HEAD_RE);
    if (hum) candidates.push({ idx: i, n: +hum[1], title: esc(hum[2]).replace(/\s+/g, ' ').replace(/\.$/, '').trim() });
  }
  // commit a header as a unit only if a real topic line starting N.N follows it
  // (kills reference lists, "RATIONALE:", "OBJECTIVES:" etc. in loose legacy PDFs)
  const kept = candidates
    .filter((h, hi) => {
      const next = candidates[hi + 1] ? candidates[hi + 1].idx : lines.length;
      return lines.slice(h.idx + 1, next).some(l => new RegExp(`^${h.n}\\.\\d`).test(l));
    });
  return kept.map((h, i) => {
    const next = kept[i + 1] ? kept[i + 1].idx : lines.length;
    const topics = [];
    for (const l of lines.slice(h.idx + 1, next)) {
      const tp = l.match(LEGACY_TOPIC_RE);
      if (tp) topics.push(`${tp[1]}. ${esc(tp[2]).replace(/\s+/g, ' ').trim()}`);
    }
    return { n: i + 1, roman: null, title: h.title || `Section ${h.n}`, uos: [], topics, hours: null };
  });
}
const UO_RE = /^\s*(\d+)\.?\s*([a-z])\.\s+(.+)$/i;      // 1a. / 1f. / 5.b.
const TOPIC_RE = /^\s*(\d+(?:\.\d+)*)\.?\s+(.+)$/;     // 1.1. / 1.4.1 / 2.1 / 4.1.2
const PAGE_MARK_RE = /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/;
const NOISE_RE = /^(Course Code\s*:|GTU\s*[-\u2013]|Page\s+\d+\s+of\s+\d+|Unit\s+Unit\s+Outcomes|\s*\(?4 to 6 UOs?|S\.\s*No\.\s*Practical|Unit\s+No\.?\s*$)/i;
const UNIT_STOP_RE = /^\s*(?:\d{1,2}\s*[.)]\s*)?(References?\/?Suggested\s+Learning|References?\s*:|Suggested\s+Specification|Course\s+Outcomes?|Affective\s+Domain\s+Outcomes|Suggested\s+Student\s+Activities|Learning\s+Resources|Software\s*\/?\s*Learning\s+Websites|PO[- ]Competency[- ]CO\s+Mapping|Course\s+Curriculum\s+Development\s+Committee|List\s+of\s+Documents|Unit\s+Unit\s+Outcomes|Unit\s+No\.?|LIST\s+OF\s+(?:PRACTICALS|EXPERIMENTS)|List\s+of\s+(?:Experiments|Practicals|Tutorials))/i;

function parseUnits(text) {
  const lines = text.split(/\r?\n/);
  const units = [];
  let cur = null;
  let pending = null; // {type: 'uo'|'topic'|'title', text}

  const pushPendingItem = () => {
    if (!pending || !cur) return;
    const trimmed = pending.text.trim();
    if (!trimmed) return;
    if (pending.type === 'uo') cur.uos.push(trimmed);
    else if (pending.type === 'topic') cur.topics.push(trimmed);
    else cur.titleLines.push(trimmed);
    pending = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (PAGE_MARK_RE.test(line) || NOISE_RE.test(line)) continue;
    if (cur && UNIT_STOP_RE.test(line)) break;

    const um = line.match(UNIT_RE);
    if (um) {
      pushPendingItem();
      cur = { roman: um[1], uos: [], topics: [], titleLines: [] };
      units.push(cur);
      pending = null;
      continue;
    }
    if (!cur) continue; // ignore everything before Unit-I header

    const uo = line.match(UO_RE);
    if (uo) {
      pushPendingItem();
      pending = { type: 'uo', text: `${uo[1]}.${uo[2]}. ${esc(uo[3].trim()).replace(/\s+/g, ' ')}` };
      continue;
    }
    const tp = line.match(TOPIC_RE);
    if (tp) {
      pushPendingItem();
      const num = tp[1].replace(/\.{2,}/g, '.');
      pending = { type: 'topic', text: `${num.replace(/\.?$/, '.')} ${esc(tp[2].trim()).replace(/\s+/g, ' ')}` };
      continue;
    }

    // continuation line: attach to the current pending item (UO or topic)
    if (pending) {
      pending.text += ' ' + esc(line.trim()).replace(/\s+/g, ' ');
      continue;
    }
    // stray line inside unit (part of title if nothing pending yet, else ignore)
    if (cur.titleLines.length < 8) {
      cur.titleLines.push(esc(line.trim()).replace(/\s+/g, ' '));
    }
  }
  pushPendingItem();

  return units.map((u, i) => {
    const title = u.titleLines.join(' ')
      .replace(/\bUnit[\s\-–]*[IVX]+\b/i, '')
      .replace(/\s{2,}/g, ' ').trim();
    return {
      n: i + 1,
      roman: u.roman,
      title: title || `Unit ${u.roman}`,
      uos: u.uos,
      topics: u.topics
    };
  }).filter(u => u.uos.length || u.topics.length);
}

// ----------------------------------------------------------------
// Degree (BE/ME) "Module N:" layout — new GTU format (w.e.f. 2024-25):
//  1.
//  Module 1: <Title>
//  <content lines…>
//  10 22%        <- hours + weightage of that module
// ----------------------------------------------------------------
const MODULE_RE = /^\s*(?:(?:SIP\s+)?Module|Unit)\s+([0-9]+|[IVX]+)\s*[-–:.]?\s*(.*)$/i;
const DEGREE_META_RE = /^\s*(\d{1,2})\s+(\d{1,3})\s*%?\s*$/;
const DEGREE_END_RE = /^\s*(Total\s+\d|Suggested Specification|References?\/?Suggested Learning Resources|Suggested Learning Resources\b|Course Outline:)/i;

function parseUnitsDegree(text) {
  const lines = text.split(/\r?\n/);
  const units = [];
  let cur = null;

  const finalize = () => {
    if (!cur) return;
    // the meta row (hours + weightage) is the trailing "10 22%" line
    const content = cur.content.slice();
    for (let i = content.length - 1; i >= 0; i--) {
      const mm = content[i].match(DEGREE_META_RE);
      if (mm) { cur.hours = +mm[1]; cur.weightage = mm[2] + '%'; content.splice(i, 1); }
      else break; // meta row, when present, is the last content line only
    }
    // split the module's prose into granular topics on ';' and sentence boundaries,
    // then further into sub-topics on comma runs (s, p, d, and f orbital energies…)
    const joined = content.join(' ');
    cur.topics = joined.split(/\s*;\s*|\s*\.\s+(?=[A-Z(])/)
      .map(s => s.trim().replace(/\.+$/, ''))
      .filter(s => s.length > 6 && !/^\d+%?\s*$/.test(s))
      .flatMap(splitSubTopics);
    units.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (PAGE_MARK_RE.test(line) || NOISE_RE.test(line)) continue;
    if (DEGREE_END_RE.test(line)) { finalize(); break; }

    const m = line.match(MODULE_RE);
    if (m) {
      finalize();
      const num = /^\d+$/.test(m[1]) ? +m[1] : m[1];
      cur = { roman: String(num), title: esc(m[2] || '').replace(/\s+/g, ' ').replace(/[:.]$/, '').trim() || `Module ${num}`, content: [], hours: null, weightage: null };
      continue;
    }
    if (!cur) continue;
    // stray table header words or lone row numbers ("1." "2.") between modules
    if (/^(Sr\.?\s*No\.?|Content|No\.\s*of\s*Hours|%\s*of\s*Weightage|Unit\s*No\.?)\s*$/i.test(line)) continue;
    if (/^\d{1,3}\.?\s*$/.test(line)) continue;
    cur.content.push(esc(line).replace(/\s+/g, ' '));
  }
  finalize();

  return units
    .filter(u => u.topics.length)
    .map((u, i) => ({ n: i + 1, roman: u.roman, title: u.title, uos: [], topics: u.topics, hours: u.hours || null, weightage: u.weightage || null, titleGu: null }));
}

// ----------------------------------------------------------------
// References / Suggested Learning Resources section
// ----------------------------------------------------------------
const REF_SECTION_RE = /References?\/?Suggested Learning Resources:\s*\n([\s\S]*)$/i;

function parseReferences(text) {
  const m = text.match(REF_SECTION_RE);
  if (!m) return { books: [], websites: [] };
  const doneAt = m[1].split(/\r?\n/).findIndex(l => /^\s*\*[\s*]*\*/.test(l) && /^\s*\*\s*\*\s*\*/.test(l.trim()));
  const lines = m[1].split(/\r?\n/).map(l => l.replace(/^--\s*\d+\s*of\s*\d+\s*--\s*$/, '').trim()).filter(Boolean);
  const body = doneAt === -1 ? lines : lines.slice(0, doneAt);

  const books = [];
  const websites = [];
  let inBooks = true;
  for (const line of body) {
    if (/\(b\)[\s.]*Open ?source|Open source software and website/i.test(line)) { inBooks = false; continue; }
    if (/\(a\)[\s.]*Books\s*:?/i.test(line)) continue;
    const urls = line.match(/https?:\/\/[^\s)\]]+/g) || [];
    if (inBooks && urls.length) { websites.push(urls.join(', ')); continue; }
    if (inBooks) {
      const b = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (b) {
        books.push(esc(b[1]).replace(/\s+/g, ' ').replace(/\.$/, '').trim());
      } else if (books.length) {
        // continuation of a wrapped reference line — join to the previous book
        books[books.length - 1] += ' ' + esc(line).replace(/\s+/g, ' ').replace(/\.$/, '').trim();
      }
    } else if (urls.length) {
      websites.push(urls.join(', '));
    }
  }
  return { books, websites };
}

// ----------------------------------------------------------------
// Degree (BE) tabular "Contents:" layout — the numbered table scheme that
// reflowed multi-column PDFs produce (e.g. 3110001 Chemistry):
//   Contents:
//   Sr. No.  Topics  Teaching Hrs.  Module Weightage
//   1
//   General Chemistry:
//   <prose lines…>
//   5          <- teaching hours (last bare integer of the row)
//   40%        <- optional module weightage
//   2
//   Water Technology:
//   <prose lines…>
//   5
// Rows are numbered 1..N consecutively, so a row boundary is a bare
// integer that equals the next expected sequence value AND is directly
// followed by prose (which keeps teaching-hours values from being
// mistaken for a new row even when they numerically collide).
// ----------------------------------------------------------------
const TABULAR_CONTENTS_RE = /^\s*(?:Course\s+)?Contents?\s*:?\s*$/i;
const TABULAR_HEAD_RE = /^\s*(Sr\.?\s*|No\.?\s*|Topics?\s*|Teaching\s*|Hrs\.?\s*|Module\s*|Weightage\s*)$/i;
const TABULAR_END_RE = /^\s*(Suggested\s+Specification|Course\s+Outcome|Reference\s+Books?|References?\/?Suggested\s+Learning|List\s+of\s+Practicals?|LIST\s+OF\s+PRACTICALS|Note\s*:\s*(?:Topic|[Tt]his\s+specification)|Distribution of (?:Theory\s+)?Marks|R\s+Level\s+U\s+Level)/i;
const TABULAR_TOTAL_RE = /^\s*(?:Total\s+\d{1,3}|\d{1,3}\s+(?:hrs?\.?|hours?)\b)/i;
const INT_LINE_RE = /^\s*(\d{1,2})\.?\s*$/;
const WEIGHT_LINE_RE = /^\s*(\d{1,3})\s*%\s*$/;
// "7 40%" / "06 15" / "02 8 %" — hours + weightage meta row (weightage optional %)
const HOURS_WEIGHT_RE = /^\s*(\d{1,3})\s+(\d{1,3})\s*%?\s*$/;
// running page header banners that bleed into a reflowed multi-page table
const PAGE_HEADER_RE = /^\s*(GUJARAT\s+TECHNOLOGICAL\s+UNIVERSITY|BACHELOR\s+OF\s+ENGINEERING\s+SYLLABUS|MASTER\s+OF\s+ENGINEERING\s+SYLLABUS|Bachelor\s+of\s+Engineering|Master\s+of\s+Engineering|\d+(?:st|nd|rd|th)\s+Year\s*,\s*Subject\s+Code\s*:|\d+(?:st|nd|rd|th)\s+SEMESTER|https?:\/\/\S+\s+Page\s*\d+|Page\s*\d+\s+of\s+\d+|w\.e\.f\..*?P\s*a\s*g\s*e\s*\d+|Competency[- ]focused\s+Outcome-based)/i;

const COMBINED_ROW_RE = /^\s*(\d{1,2})\.?\s+([A-Z].*)$/;

function parseUnitsTabular(text) {
  const cleaned = text.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l !== '')
    .filter(l => !PAGE_MARK_RE.test(l))
    .filter(l => !NOISE_RE.test(l))
    .filter(l => !PAGE_HEADER_RE.test(l));
  const start = cleaned.findIndex(l => TABULAR_CONTENTS_RE.test(l));
  if (start === -1) return [];

  const rows = [];
  let cur = null;
  let expected = 1;
  for (let i = start + 1; i < cleaned.length; i++) {
    const line = cleaned[i];
    if (TABULAR_END_RE.test(line) || TABULAR_TOTAL_RE.test(line)) break;

    // bare "N" (or "N.") — row number on its own line
    const im = INT_LINE_RE.exec(line);
    if (im) {
      const n = +im[1];
      const next = cleaned[i + 1];
      if (n === expected && next && !INT_LINE_RE.test(next) && !WEIGHT_LINE_RE.test(next)
          && !TABULAR_HEAD_RE.test(next) && !TABULAR_END_RE.test(next)) {
        if (cur) rows.push(cur);
        cur = { lines: [], title: null };
        expected = n + 1;
        continue;
      }
    }

    // combined "N TITLE:" — PDF reflow merged the row number onto the title line
    // (also catches ruler reflow like "8 Pumps: Types and operation …")
    const cm = COMBINED_ROW_RE.exec(line);
    if (cm) {
      const n = +cm[1];
      if (n === expected) {
        if (cur) rows.push(cur);
        cur = { lines: [], title: cm[2] };
        expected = n + 1;
        continue;
      }
    }

    if (!cur) continue;
    cur.lines.push(line);
  }
  if (cur) rows.push(cur);

  const units = [];
  let n = 0;
  for (const row of rows) {
    const content = row.lines.slice();
    if (!content.length && !row.title) continue;

    let weightage = null;
    let hours = null;
    // "7 40%" / "06 15" / "02 8 %" — hours + weightage collapsed onto one line.
    // Normally it's the last line of the row, but a page break can push the meta
    // row before the content continues — scan back for the last pure-N N meta line.
    let metaAt = -1;
    for (let j = content.length - 1; j >= 0; j--) {
      if (HOURS_WEIGHT_RE.test(content[j] || '')) { metaAt = j; break; }
    }
    if (metaAt !== -1) {
      const mm = HOURS_WEIGHT_RE.exec(content[metaAt]);
      if (mm) {
        hours = +mm[1];
        weightage = mm[2] + '%';
        content.splice(metaAt, 1);
      }
    } else {
      if (content.length && WEIGHT_LINE_RE.test(content[content.length - 1])) {
        weightage = WEIGHT_LINE_RE.exec(content.pop())[1] + '%';
      }
      if (content.length && INT_LINE_RE.test(content[content.length - 1])) {
        hours = +INT_LINE_RE.exec(content.pop())[1];
      }
      // trailing hours glued onto the last prose line ("…steam calorimeters. 6")
      if (!hours && content.length) {
        const last = content[content.length - 1].trim();
        const th = /^(.*[A-Za-z)])[\s.]+(\d{1,2})\s*$/.exec(last);
        if (th && th[1].length > 6) {
          hours = +th[2];
          content[content.length - 1] = th[1].trim();
        }
      }
    }

    // title — from the combined-row prefix, or the first content line; absorb
    // a wrapped "<Title>:" continuation (e.g. "1. INTRODUCTION TO … AND CIVIL"
    // followed by "ENGINEERING MATERIALS:")
    let title = (row.title || content.shift() || '')
      .replace(/\s+/g, ' ').trim()
      .replace(/^\d{1,2}\.?\s+/, '');
    if (title && content.length) {
      const nx = content[0].replace(/\s+/g, ' ').trim();
      if (nx.endsWith(':') && nx.length <= 90) {
        title = `${title} ${content.shift().replace(/\s+/g, ' ').trim().replace(/:$/, '')}`;
      }
    }

    // split off a trailing "<Title>: … N N%" that got squeezed onto one line,
    // and reclaim the hours/weightage pair in it (e.g. "… Indices, B-trees, hashing. 04 07")
    const ci0 = title.indexOf(':');
    if (ci0 !== -1) {
      const rest = title.slice(ci0 + 1).trim();
      title = title.slice(0, ci0).replace(/[\s:.]+$/, '').trim();
      if (rest) {
        const two = /^(.*?)\s+(\d{1,3})\s+(\d{1,3})\s*%?\s*$/.exec(rest);
        const one = two ? null : /^(.*?)[\s.]+(\d{1,2})\s*$/.exec(rest);
        if ((two || one) && !hours) {
          if (two) { hours = +two[2]; weightage = two[3] + '%'; if (two[1].trim()) content.unshift(two[1].trim()); }
          else { hours = +one[2]; if (one[1].trim()) content.unshift(one[1].trim()); }
        } else {
          content.unshift(rest);
        }
      }
    }
    let titleText = title.replace(/[\s:.]+$/, '').trim() || `Module ${n + 1}`;

    const joined = content.join(' ');
    const topics = joined.split(/\s*;\s*|\s*\.\s+(?=[A-Z(])/)
      .map(s => s.trim().replace(/\.+$/, ''))
      .filter(s => s.length > 6 && !/^[\d\s]+%?\s*$/.test(s))
      .filter(s => !/Distribution of (?:Theory\s+)?Marks|R\s+Level\s+U\s+Level|Legends?\s*:|Suggested Specification|Note\s*:\s*Topic No/i.test(s))
      .flatMap(splitSubTopics);

    n++;
    units.push({ n, roman: String(n), title: esc(titleText), uos: [], topics, hours: hours || null, weightage: weightage || null, titleGu: null });
  }
  return units.filter(u => u.topics.length);
}

const ROW_START_RE = /^([IVX]+)\s+([A-Za-z].*)$/;
const ROW_FULL_RE = /^([IVX]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;

// Split a prose topic string into granular sub-topics. GTU syllabus prose often
// packs an entire unit into one comma-run ("…Periodic properties, Effective
// nuclear charge, penetration of orbitals, variations of s, p, d and f orbital
// energies…"). We split on commas, then re-join fragments that belong to the
// previous sub-topic: short single letters (s, p, d, f), chemical symbols
// (Cu, Al, Pb), "and …" continuations, and a trailing run after a short
// previous fragment ("variations of s, p, d and f orbital energies").
function splitSubTopics(text) {
  const segs = String(text || '').split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  if (segs.length < 2) return segs;
  const out = [];
  let cur = segs[0];
  const short = s => s.length <= 3 && /^[A-Za-z0-9]+$/.test(s);
  for (let i = 1; i < segs.length; i++) {
    const s = segs[i];
    const prevLast = cur.split(/\s+/).pop() || '';
    const join = short(s) || /^and\s+/i.test(s) || short(prevLast);
    if (join) {
      cur += ', ' + s;
    } else {
      out.push(cur);
      cur = s;
    }
  }
  out.push(cur);
  // strip "Basics includes:" style lead-ins so the first sub-topics read cleanly
  return out.map(s => s.replace(/^(Basics?\s+includes?)\s*:/i, '').trim()).filter(Boolean);
}
const VALID_ROWS = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']);

function parseMarks(text) {
  const lines = text.split(/\r?\n/);
  const table = [];
  let acc = '';
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/SUGGESTED SPECIFICATION TABLE/i.test(line)) { inTable = true; continue; }
    if (!inTable) continue;
    if (!line || /^--\s*\d+/.test(line) || /^Page\s+\d+/.test(line) ||
        /^(Unit\s+No\.?|Teaching\s+Hours|R\s+Level|U\s+Level|A\s+Level|Total\s+Marks)/i.test(line)) continue;

    const startsRow = !acc && ROW_START_RE.test(line) && VALID_ROWS.has(line.match(ROW_START_RE)[1]);
    if (startsRow) acc = line;
    else if (acc) acc += ' ' + line;
    else continue;

    const m = acc.match(ROW_FULL_RE);
    if (m && VALID_ROWS.has(m[1])) {
      table.push({
        roman: m[1],
        title: m[2].replace(/\s{2,}/g, ' ').trim(),
        hours: +m[3], r: +m[4], u: +m[5], a: +m[6], total: +m[7]
      });
      acc = '';
    }
  }
  return table;
}

function main() {
  const opts = parseArgs();
  if (!opts.code) {
    console.error('Usage: node scripts/ai_book/parse_syllabus.js --code 4360302 [--text file] [--pdf file]');
    process.exit(1);
  }
  const code = String(opts.code);
  const dataDir = path.join(ROOT, 'data', 'ai_books', code);
  fs.mkdirSync(dataDir, { recursive: true });

  const defPath = path.join(dataDir, 'unitdef.json');
  if (fs.existsSync(defPath) && !opts.force) {
    console.log(`[exists] unitdef.json already present (use --force to re-parse)`);
    return console.log(defPath);
  }

  loadText(opts).then(async ({ text, source }) => {
    if (opts.code) fs.writeFileSync(path.join(dataDir, 'syllabus.txt'), text);

    let units = parseUnits(text);
    if (!units.length) {
      console.log('No Unit-I.. style headers; trying legacy CONTENT OUTLINE format…');
      units = parseUnitsLegacy(text);
    }
    if (!units.length) {
      console.log('No legacy CONTENT OUTLINE; trying degree "Module N:" format…');
      units = parseUnitsDegree(text);
    }
    if (!units.length) {
      console.log('No degree "Module N:" headers; trying tabular "Contents:" format…');
      units = parseUnitsTabular(text);
    }
    if (!units.length) {
      console.error('No units found — is this really a GTU syllabus text?');
      process.exit(2);
    }
    const marks = parseMarks(text);
    const refs = parseReferences(text);
    const meta = findSubjectMetadata(code);
    const codeDegree = /^(BE|ME)/i.test(code);
    const txtDegree = /(?:BACHELOR|MASTER)\s+OF\s+ENGINEERING|B\.?\s*E\b|M\.?\s*E\b|Post\s+Graduate|PG\s+Engineering/i.test(text);
    const txtDiploma = /DIPLOMA\b/i.test(text);
    const level = (codeDegree || txtDegree) && !(txtDiploma && !codeDegree && !txtDegree) ? 'degree' : 'diploma';

    for (const u of units) {
      const mk = marks.find(mm => mm.roman === u.roman);
      if (mk) {
        u.marks = `${mk.total} marks (${mk.r} Remember + ${mk.u} Understand + ${mk.a} Apply)`;
        u.hours = mk.hours;
        u.r = mk.r; u.u = mk.u; u.a = mk.a; u.totalMarks = mk.total;
      } else if (u.weightage) {
        u.marks = `${u.weightage} of the end-semester theory paper`;
        u.r = u.u = u.a = null;
      } else {
        u.marks = null;
      }
      u.titleGu = null;
    }

    const def = {
      code,
      subject: meta.subject,
      slug: meta.slug,
      branchLabel: meta.branchLabel,
      page: meta.page,
      semId: meta.semId,
      level,
      references: refs,
      syllabusUrl: /^https?:/.test(source) ? source : null,
      generatedAt: new Date().toISOString(),
      units
    };
    fs.writeFileSync(defPath, JSON.stringify(def, null, 2));
    console.log('Wrote', defPath);

    const dd = JSON.parse(fs.readFileSync(defPath, 'utf8'));
    console.log(`Level: ${dd.level} · References: ${(dd.references.books || []).length} books, ${(dd.references.websites || []).length} links`);
    for (const u of dd.units) {
      console.log(`\nModule/Unit ${u.roman} (${u.n}) — ${u.title} — ${u.marks}${u.hours ? ` — ${u.hours}h` : ''}`);
      console.log('  UOs:', u.uos.length);
      u.uos.slice(0, 3).forEach(x => console.log('    • ' + x));
      console.log('  topics:', u.topics.length);
      u.topics.slice(0, 6).forEach(x => console.log('    - ' + x));
    }
  }).catch(err => {
    console.error('[FATAL]', err.message);
    process.exit(1);
  });
}

if (require.main === module) main();
module.exports = { parseUnits, parseUnitsLegacy, parseUnitsDegree, parseUnitsTabular, parseMarks, parseReferences, pdfToText, findSubjectMetadata, splitSubTopics };