/**
 * Free-model quality probe for the AI book pipeline.
 *
 * Generates sections of one unit with any model reachable through
 * `opencode run -m <provider/model>` (free models on the opencode provider cost
 * 0), using the EXACT prompts from ollama_gen.js, then runs the same
 * post-processing (LaTeX cleanup + Mermaid repair) and builds a preview HTML.
 *
 * Nothing under data/ai_books/<code> or public/books/<code> is touched: output
 * goes to a sandbox directory data/ai_books/<code>-try-<model>/ and
 * public/books/<code>-try-<model>/, so the live qwen-generated book stays
 * intact for side-by-side comparison.
 *
 * Usage:
 *   node scripts/ai_book/try_model.js --code 4360302 --unit 1
 *   node scripts/ai_book/try_model.js --code 4360302 --unit 1 --model opencode/fledge-alpha-free
 *   node scripts/ai_book/try_model.js --code 4360302 --unit 1 --sections s1,s4
 *   node scripts/ai_book/try_model.js --code 4360302 --unit 1 --no-build
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { makeSystem, UNIT_DEFS, buildDefsFromUnitdef, buildUserPrompt } = require('./ollama_gen');
const { callOpenCode } = require('./opencode_client');
const { cleanLatexMath } = require('./tex_fix');
const { repairMarkdown, analyzeMermaid } = require('./mermaid_fix');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_MODEL = process.env.TRY_MODEL || 'opencode/big-pickle';

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { model: DEFAULT_MODEL, sections: null, build: true };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--code') o.code = a[++i];
    else if (a[i] === '--unit') o.unit = parseInt(a[++i], 10);
    else if (a[i] === '--model') o.model = a[++i];
    else if (a[i] === '--sections') o.sections = new Set(String(a[++i]).split(',').map(s => s.trim()).filter(Boolean));
    else if (a[i] === '--no-build') o.build = false;
  }
  return o;
}

// Same intro shape as ollama_gen.main(), with the model named instead of Ollama.
function buildIntro(def, code, model) {
  const uoBlock = def.uos && def.uos.length
    ? `Learning objectives covered by this module:\n` + def.uos.map(u => `- ${u.replace(/^\d+[a-z]\./i, '').trim()}`).join('\n') + '\n'
    : '';
  const refBlock = def.references && def.references.length
    ? `Recommended textbooks from the GTU syllabus (align your terminology and approach with these):\n` + def.references.map(b => `- ${b}`).join('\n') + '\n'
    : '';
  return `# ${def.unit}\n\n` +
    `*(AI-generated self-study book for GTU, subject code ${code} — model: ${model})*\n\n` +
    `This module carries approximately **${def.examWeight}**.\n\n` + uoBlock + refBlock;
}

function stats(md) {
  const words = md.replace(/[#>*`|\[_\]-]/g, ' ').split(/\s+/).filter(Boolean).length;
  const mer = analyzeMermaid(md);
  const examples = (md.match(/^\s*>\s*\*\*Example/gm) || []).length;
  const tables = (md.match(/^\|/gm) || []).length ? (md.match(/^\|.*\|\s*$/gm) || []).filter((v, i, arr) => i === 0 || v !== arr[i - 1]).length : 0;
  return { words, diagrams: mer.count, diagramsOk: mer.blocks.filter(b => b.ok).length, examples, tables };
}

function main() {
  const opts = parseArgs();
  if (!opts.code || !opts.unit) {
    console.error('Usage: node scripts/ai_book/try_model.js --code 4360302 --unit 1 [--model opencode/big-pickle] [--sections s1,s2]');
    process.exit(1);
  }
  const code = String(opts.code);
  const origDir = path.join(ROOT, 'data', 'ai_books', code);
  const slug = opts.model.replace(/^[^/]+\//, '').replace(/[^a-z0-9._-]+/gi, '-');
  const saveAs = `${code}-try-${slug}`;
  const outDir = path.join(ROOT, 'data', 'ai_books', saveAs);
  const pubDir = path.join(ROOT, 'public', 'books', saveAs);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(pubDir, { recursive: true });

  const def = UNIT_DEFS[code] || buildDefsFromUnitdef(code, origDir, opts.unit);
  const system = makeSystem(def.level || (/^(BE|ME)/i.test(code) ? 'degree' : 'diploma'));
  const sections = def.sections.filter(s => !opts.sections || opts.sections.has(s.key));
  if (!sections.length) { console.error('No matching sections'); process.exit(1); }

  // unitdef so the preview page gets the real subject title
  const udSrc = path.join(origDir, 'unitdef.json');
  if (fs.existsSync(udSrc)) fs.copyFileSync(udSrc, path.join(outDir, 'unitdef.json'));

  console.log(`\n=== Quality probe | ${def.subject} | ${def.unit} | model ${opts.model} ===`);
  console.log(`sandbox: data/ai_books/${saveAs}  sections: ${sections.map(s => s.key).join(', ')}\n`);

  (async () => {
    const parts = [];
    const rows = [];
    const start = Date.now();
    for (const sec of sections) {
      const t0 = Date.now();
      console.log(`[${sec.key}] ${sec.topic} (${sec.target})`);
      let text = await callOpenCode(opts.model, system, buildUserPrompt(def, sec, def.sections.indexOf(sec)));
      text = cleanLatexMath(text);
      const check = analyzeMermaid(text);
      if (check.count && check.blocks.some(b => !b.ok)) {
        const repaired = repairMarkdown(text);
        text = repaired.md;
        const after = analyzeMermaid(text);
        console.log(`   ! mermaid repaired: ${check.blocks.filter(b => !b.ok).length} broken -> ${after.blocks.filter(b => !b.ok).length} still broken`);
      }
      fs.writeFileSync(path.join(outDir, `part-${sec.key}.md`), text);
      parts.push({ key: sec.key, text });
      const s = stats(text);
      rows.push({ key: sec.key, ...s, sec: ((Date.now() - t0) / 1000).toFixed(0) });
      console.log(`   ✓ ${s.words} words, ${s.diagramsOk}/${s.diagrams} diagrams ok, ${s.examples} examples (${rows[rows.length - 1].sec}s)`);
    }

    const intro = buildIntro(def, code, opts.model);
    // Assemble from every part on disk (not just this run's) so section
    // batches across invocations accumulate into one complete unit.
    const ordered = def.sections
      .map(s => ({ key: s.key, file: path.join(outDir, `part-${s.key}.md`) }))
      .filter(p => fs.existsSync(p.file))
      .map(p => ({ key: p.key, text: fs.readFileSync(p.file, 'utf8') }));
    const chapter = intro + '\n' + ordered.map(p => p.text.trim()).join('\n\n---\n\n') + '\n';
    const mdPath = path.join(outDir, `unit-${opts.unit}.md`);
    fs.writeFileSync(mdPath, chapter);

    console.log(`\n=== SECTION REPORT (${opts.model}) ===`);
    console.log('  sec  words  diagrams  examples  time');
    for (const r of rows) console.log(`  ${r.key.padEnd(4)} ${String(r.words).padStart(5)}  ${r.diagramsOk}/${r.diagrams} ok    ${String(r.examples).padStart(4)}     ${r.sec}s`);

    // Compare against the live qwen2.5:7b parts when they exist.
    const origParts = rows.map(r => {
      const p = path.join(origDir, `part-${r.key}.md`);
      return fs.existsSync(p) ? { key: r.key, ...stats(fs.readFileSync(p, 'utf8')) } : null;
    }).filter(Boolean);
    if (origParts.length) {
      console.log(`\n=== vs live qwen2.5:7b (same sections) ===`);
      console.log('  sec  free-model words/examples/diagrams | qwen words/examples/diagrams');
      for (const r of rows) {
        const o = origParts.find(x => x.key === r.key);
        if (!o) continue;
        console.log(`  ${r.key.padEnd(4)}  ${r.words}/${r.examples}/${r.diagramsOk}of${r.diagrams} | ${o.words}/${o.examples}/${o.diagramsOk}of${o.diagrams}`);
      }
    }

    if (opts.build) {
      const r = spawnSync(process.execPath, [path.join(__dirname, 'build_book_page.js'), '--code', saveAs, '--unit', String(opts.unit)], { cwd: ROOT, stdio: 'inherit' });
      if (r.status !== 0) console.error('preview build failed (markdown still saved)');
      else console.log(`\npreview: http://localhost:3001/books/${saveAs}/unit-${opts.unit}.html`);
      console.log(`markdown: data/ai_books/${saveAs}/unit-${opts.unit}.md`);
    }
    console.log(`total: ${((Date.now() - start) / 1000).toFixed(0)}s`);
  })().catch(e => { console.error('[FAILED]', e.message); process.exit(1); });
}

main();
