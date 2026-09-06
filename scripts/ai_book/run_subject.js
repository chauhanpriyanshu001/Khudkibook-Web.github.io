/**
 * End-to-end AI book pipeline for ANY GTU subject code.
 *
 * Steps (each is idempotent / resumable — finished work is skipped):
 *   1  syllabus   parse_syllabus.js        -> data/ai_books/<code>/unitdef.json
 *   2  generate   ollama_gen.js (per unit) -> data/ai_books/<code>/unit-<n>.md
 *   3  translate  translate_gu.js (per unit, only with --gu) -> unit-<n>.gu.md
 *   4  build      build_book_page.js (EN + optional GU) -> public/books/<code>/unit-<n>[-gu].html
 *   5  fullbook   assemble_book.js         -> public/books/<code>/full-book[-gu].html
 *   6  patch      site_db.json materials   (dedupe by link; backup first)
 *   7  rebuild    node scripts/generate.js (subject page + site pages)
 *   8  manifest   book.json (pages + full + updatedAt)
 *
 * Usage:
 *   node scripts/ai_book/run_subject.js --code 4360302
 *   node scripts/ai_book/run_subject.js --code 4360302 --gu          # + Gujarati
 *   node scripts/ai_book/run_subject.js --code 4360302 --steps build,fullbook,manifest
 *   node scripts/ai_book/run_subject.js --code 4360302 --units 1,2   # subset
 *   node scripts/ai_book/run_subject.js --code 4360302 --dry-run
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const node = process.execPath;
const SCRIPT = p => path.join(ROOT, 'scripts', 'ai_book', p);
let OPTS = {};

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { steps: null, units: null, gu: false, dry: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--code') o.code = a[++i];
    else if (a[i] === '--gu') o.gu = true;
    else if (a[i] === '--dry-run') o.dry = true;
    else if (a[i] === '--units') o.units = String(a[++i]).split(',').map(Number).filter(Boolean);
    else if (a[i] === '--steps') o.steps = String(a[++i]).split(',');
  }
  return o;
}

function run(label, fn, args, { dryOk = false } = {}) {
  console.log(`\n── ${label} ──`);
  if (Array.isArray(args)) {
    if (OPTS.dry) return console.log('[dry] node ' + args.map(x => `"${x}"`).join(' '));
    const r = spawnSync(node, args, { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0 && !dryOk) { console.error(`✗ ${label} failed (exit ${r.status})`); process.exit(1); }
    return;
  }
  if (typeof fn === 'function') return fn();
  return fn;
}

const ALL_STEPS = ['syllabus', 'generate', 'translate', 'build', 'fullbook', 'patch', 'rebuild', 'manifest'];

function siteDbSubjects(code) {
  const p = path.join(ROOT, 'data', 'site_db.json');
  const db = JSON.parse(fs.readFileSync(p, 'utf8'));
  const out = [];
  for (const u of db.universities || []) for (const d of u.domains || []) for (const b of d.branches || []) for (const s of b.semesters || []) {
    for (const sub of s.subjects || []) if (String(sub.code) === String(code)) out.push({ seg: [u, d, b, s], sub });
  }
  return { db, out };
}

function patchSiteDb(code, { gu }) {
  const { db, out } = siteDbSubjects(code);
  if (!out.length) { console.warn('Subject ' + code + ' not found in site_db.json — skipping patch'); return; }
  const dataDir = path.join(ROOT, 'data', 'ai_books', code);
  const def = JSON.parse(fs.readFileSync(path.join(dataDir, 'unitdef.json'), 'utf8'));
  const units = def.units || [];

  for (const { seg, sub } of out) {
    fs.writeFileSync(path.join(ROOT, 'data', 'site_db_backup.json'), JSON.stringify(db, null, 1));
    sub.materials = sub.materials || [];
    // drop previous AI entries for this code so re-runs don't duplicate
    sub.materials = sub.materials.filter(m => !(m.ai === true && String(m.link || '').startsWith(`/books/${code}/`)));

    const branchLabel = `${seg[0].name || ''} ${seg[1].name || seg[1].shortName || ''}`.trim();
    const page = `/books/${code}/unit-`;
    for (const ud of units) {
      sub.materials.push({
        type: 'book',
        label: `Unit ${ud.n} (AI Book)`,
        link: `${page}${ud.n}.html`,
        year: 'all',
        language: 'english',
        source: `AI | GTU Syllabus | ${branchLabel}`,
        ai: true
      });
      if (gu && fs.existsSync(path.join(dataDir, `unit-${ud.n}.gu.md`))) {
        sub.materials.push({
          type: 'book',
          label: `Unit ${ud.n} (AI Book − ગુજરાતી)`,
          link: `${page}${ud.n}-gu.html`,
          year: 'all',
          language: 'gujarati',
          source: `AI | GTU Syllabus | ${branchLabel}`,
          ai: true
        });
      }
    }
    sub.materials.push({
      type: 'book',
      label: 'Full Book (All Units) (AI)',
      link: `/books/${code}/full-book.html`,
      year: 'all',
      language: 'english',
      source: `AI | GTU Syllabus | ${branchLabel}`,
      ai: true
    });
  }
  fs.writeFileSync(path.join(ROOT, 'data', 'site_db.json'), JSON.stringify(db, null, 1));
  console.log('✓ site_db.json patched for ' + code + ' (' + out.length + ' placement(s))');
}

function updateManifest(code, { gu }) {
  const dataDir = path.join(ROOT, 'data', 'ai_books', code);
  const def = JSON.parse(fs.readFileSync(path.join(dataDir, 'unitdef.json'), 'utf8'));
  const manifestPath = path.join(ROOT, 'public', 'books', code, 'book.json');
  const m = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  m.code = code;
  m.subject = def.subject || m.subject;
  m.title = def.subject;
  m.titleGu = def.subject;
  m.pages = m.pages || [];
  for (const ud of def.units) {
    let pg = (m.pages || []).find(x => x.n === ud.n);
    if (!pg) { pg = { n: ud.n, file: `unit-${ud.n}.html` }; m.pages.push(pg); }
    pg.file = `unit-${ud.n}.html`;
    if (gu || fs.existsSync(path.join(dataDir, `unit-${ud.n}.gu.md`))) pg.guFile = `unit-${ud.n}-gu.html`;
    if (ud.marks) pg.marks = ud.marks;
    if (ud.hours) pg.hours = ud.hours;
  }
  m.full = fs.existsSync(path.join(ROOT, 'public', 'books', code, 'full-book.html')) ? 'full-book.html' : null;
  m.updatedAt = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(m, null, 1));
  console.log('✓ book.json manifest updated');
}

function main() {
  // make dry-run visible to run()
  const o = parseArgs();
  if (!o.code) { console.error('Usage: node scripts/ai_book/run_subject.js --code 4360302 [--gu] [--steps …] [--units 1,2] [--dry-run]'); process.exit(1); }
  const code = String(o.code);
  const dataDir = path.join(ROOT, 'data', 'ai_books', code);
  fs.mkdirSync(dataDir, { recursive: true });
  const defPath = path.join(dataDir, 'unitdef.json');
  OPTS = o;

  const want = o.steps || ALL_STEPS;
  const steps = new Set(ALL_STEPS);
  for (const s of want) if (!steps.has(s)) { console.error('Unknown step:', s, '(valid:', ALL_STEPS.join(', ') + ')'); process.exit(1); }
  if (o.steps) { steps.clear(); want.forEach(s => steps.add(s)); }

  const syllabus = () => {
    if (o.dry) return console.log('[dry] parse_syllabus.js --code ' + code);
    const exists = fs.existsSync(defPath);
    if (exists) { console.log('[exists] unitdef.json — skipping syllabus parse'); return; }
    run('Parse syllabus', null, [SCRIPT('parse_syllabus.js'), '--code', code, ...(o.force ? ['--force'] : [])]);
    if (!fs.existsSync(defPath)) { console.error('✗ syllabus parse produced no unitdef.json'); process.exit(1); }
  };

  const units = () => {
    if (!fs.existsSync(defPath)) {
      console.error(`✗ No unitdef.json for code ${code} at ${defPath}.`);
      console.error(`  The "syllabus" step failed for this code (S3 syllabus PDF missing/unparseable). Run steps: syllabus first.`);
      process.exit(1);
    }
    const ud = JSON.parse(fs.readFileSync(defPath, 'utf8'));
    const wantUnits = o.units || (ud.units || []).map(u => u.n);
    return { ud, wantUnits };
  };

  const generate = () => {
    const { wantUnits } = units();
    for (const n of wantUnits)
      run(`Generate unit ${n} (EN)`, null, [SCRIPT('ollama_gen.js'), '--code', code, '--unit', String(n)]);
  };

  const translate = () => {
    if (!o.gu) { console.log('(skipping Gujarati — pass --gu)'); return; }
    const { wantUnits } = units();
    for (const n of wantUnits)
      run(`Translate unit ${n} (GU)`, null, [SCRIPT('translate_gu.js'), '--code', code, '--unit', String(n)]);
  };

  const build = () => {
    const { wantUnits } = units();
    for (const n of wantUnits) {
      run(`Build unit ${n} (EN)`, null, [SCRIPT('build_book_page.js'), '--code', code, '--unit', String(n)]);
      if (o.gu) run(`Build unit ${n} (GU)`, null, [SCRIPT('build_book_page.js'), '--code', code, '--unit', String(n), '--lang', 'gu']);
    }
  };

  const fullbook = () => {
    run('Assemble full book', null, [SCRIPT('assemble_book.js'), '--code', code, '--lang', o.gu ? 'both' : 'en']);
  };

  const patch = () => (o.dry ? console.log('[dry] patch site_db') : patchSiteDb(code, { gu: o.gu }));
  const rebuild = () => (o.dry ? console.log('[dry] node scripts/generate.js') : run('Rebuild site', null, [path.join(ROOT, 'scripts', 'generate.js')]));
  const manifest = () => (o.dry ? console.log('[dry] update book.json') : updateManifest(code, { gu: o.gu }));

  const map = { syllabus, generate, translate, build, fullbook, patch, rebuild, manifest };
  for (const s of ALL_STEPS) if (steps.has(s)) map[s]();
  console.log('\n✓ run_subject complete for ' + code);
}

if (require.main === module) main();
module.exports = { patchSiteDb, updateManifest };