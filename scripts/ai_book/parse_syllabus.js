/**
 * Auto-build unit definitions from a GTU syllabus for ANY subject code.
 *
 * Sources (first hit wins):
 *   1. --text <file>      (existing extracted text; fastest for testing)
 *   2. --pdf <file>       (local PDF, parsed with pdf-parse)
 *   3. --code <code>      (download https://…gtusitecirculars.com/Syallbus/<code>.pdf
 *                          and parse it; text cached at data/ai_books/<code>/syllabus.txt)
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

async function loadText(opts) {
  if (opts.text) return fs.readFileSync(opts.text, 'utf8');
  if (opts.pdf) return pdfToText(fs.readFileSync(opts.pdf));

  const url = SYL_URL(opts.code);
  console.log('Downloading syllabus:', url);
  const res = await fetch(url);
  if (!res.ok) {
    // fallback: try the crawled data for an alternate link
    const crawled = loadJson(path.join(ROOT, 'data', 'crawled_gtu_syllabus.json')) || [];
    const hit = crawled.find(c => String(c.subjectCode || c.code) === String(opts.code));
    if (hit && /^https?:/.test(hit.link || '')) {
      const res2 = await fetch(hit.link);
      if (!res2.ok) throw new Error(`Download failed ${hit.link} (${res2.status})`);
      return pdfToText(Buffer.from(await res2.arrayBuffer()));
    }
    throw new Error(`Syllabus download failed (${res.status}) for ${url}`);
  }
  return pdfToText(Buffer.from(await res.arrayBuffer()));
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

const ROW_START_RE = /^([IVX]+)\s+([A-Za-z].*)$/;
const ROW_FULL_RE = /^([IVX]+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/;
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

  loadText(opts).then(async text => {
    if (opts.code) fs.writeFileSync(path.join(dataDir, 'syllabus.txt'), text);

    let units = parseUnits(text);
    if (!units.length) {
      console.log('No Unit-I.. style headers; trying legacy CONTENT OUTLINE format…');
      units = parseUnitsLegacy(text);
    }
    if (!units.length) {
      console.error('No units found — is this really a GTU syllabus text?');
      process.exit(2);
    }
    const marks = parseMarks(text);
    const meta = findSubjectMetadata(code);

    for (const u of units) {
      const mk = marks.find(mm => mm.roman === u.roman);
      if (mk) {
        u.marks = `${mk.total} marks (${mk.r} Remember + ${mk.u} Understand + ${mk.a} Apply)`;
        u.hours = mk.hours;
        u.r = mk.r; u.u = mk.u; u.a = mk.a; u.totalMarks = mk.total;
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
      syllabusUrl: opts.text || opts.pdf ? null : SYL_URL(code),
      generatedAt: new Date().toISOString(),
      units
    };
    fs.writeFileSync(defPath, JSON.stringify(def, null, 2));
    console.log('Wrote', defPath);

    const dd = JSON.parse(fs.readFileSync(defPath, 'utf8'));
    for (const u of dd.units) {
      console.log(`\nUnit ${u.roman} (${u.n}) — ${u.title} — ${u.marks}`);
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
module.exports = { parseUnits, parseUnitsLegacy, parseMarks, pdfToText, findSubjectMetadata };