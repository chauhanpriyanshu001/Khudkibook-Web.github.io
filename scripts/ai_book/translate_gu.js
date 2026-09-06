/**
 * Gujarati translation pass for an AI-generated GTU book unit.
 *
 * Reads:   data/ai_books/<code>/unit-<n>.md           (english)
 * Writes:  data/ai_books/<code>/part-gu-<i>.md        (per-part, resumable)
 *          data/ai_books/<code>/unit-<n>.gu.md        (gujarati)
 *          data/ai_books/<code>/state.json            (cache: unit<n>:gu:<i>)
 *
 * Run:   node scripts/ai_book/translate_gu.js --code 4360302 --unit 1
 * Model: uses OLLAMA_GU_MODEL (default aya-expanse:8b), override with --model
 * Check: node scripts/ai_book/translate_gu.js --check   (quick quality probe)
 *
 * Notes: qwen2.5 is NOT officially Gujarati-capable; aya-expanse is the
 * recommended local model for this pass. Mermaid fences + tables preserved.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OLLAMA = 'http://localhost:11434/api/generate';

const GU_SYSTEM = `You are a fluent, native-quality Gujarati translator for GTU diploma engineering study material.
Translate the incoming English markdown chapter into CLEAN, exam-oriented GUJARATI (ગુજરાતી script).

Strict rules:
1. Output ONLY the translated content. No commentary, no English preface, no notes.
2. Preserve the complete Markdown structure exactly: headings (#, ##, ###), bullet lists, numbered lists,
   bold **...**, emphasis, blockquote ">" lines, and horizontal rules "---".
3. Preserve Markdown tables exactly: keep the same rows and columns and the header row; translate text inside cells only.
4. Fenced code blocks that begin with a line of exactly \`\`\`mermaid\`\`\` MUST be copied 100% VERBATIM and never translated or reformatted.
5. Keep numbers, subject codes, marks, and technical terms intact. When a technical term helps clarity,
   keep the English term and give the Gujarati in parentheses, e.g. biocompatibility, બાયોકોમ્પેટિબિલિટી.
6. Use "એકમ" for Unit; keep topic numbering like 1.1, 1.4.2 unchanged.
7. Simple, clear, exam-oriented Gujarati suitable for diploma students. Always use Gujarati script (never transliterate to Latin).`;

async function callOllama(prompt, { model = process.env.OLLAMA_GU_MODEL || 'aya-expanse:8b', maxTokens = 3000, temperature = 0.3, retries = 3 } = {}) {
  const body = {
    model,
    prompt,
    system: GU_SYSTEM,
    stream: true,
    options: { num_predict: maxTokens, temperature }
  };
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OLLAMA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunks = decoder.decode(value, { stream: true }).split('\n');
        for (const line of chunks) {
          if (!line.trim()) continue;
          let j;
          try { j = JSON.parse(line); } catch (_) { continue; }
          text += j.response || '';
          if (j.done) { reader.cancel(); return text; }
        }
      }
      return text;
    } catch (e) {
      lastErr = e;
      console.log(`   [retry ${attempt}/${retries}] ${e.message}`);
      await new Promise(r => setTimeout(r, 8000 * attempt));
    }
  }
  throw lastErr;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code') opts.code = args[++i];
    else if (args[i] === '--unit') opts.unit = parseInt(args[++i], 10);
    else if (args[i] === '--model') opts.model = args[++i];
    else if (args[i] === '--check') opts.check = true;
    else if (args[i] === '--force') opts.force = true;
  }
  return opts;
}

// Split the english unit into translation chunks on "---" separators.
function splitChunks(md) {
  const lines = md.split(/\r?\n/);
  const chunks = [];
  let cur = [];
  const flush = () => { if (cur.length) { chunks.push({ idx: chunks.length, text: cur.join('\n') }); cur = []; } };
  for (const line of lines) {
    if (/^\s*(---\s*$|\*\*\*\s*$|___\s*$)/.test(line) && cur.length) {
      flush();
      cur = [];
      continue;
    }
    cur.push(line);
  }
  flush();
  return chunks;
}

async function checkModel(model) {
  const sample = 'A biomaterial is any substance designed to interact safely with biological systems, for example a titanium dental implant.';
  console.log(`Quality probe with "${model}"...`);
  const out = await callOllama(`Translate this to Gujarati:\n${sample}`, { model, maxTokens: 300 });
  console.log('\n--- GUJARATI SAMPLE OUTPUT ---\n');
  console.log(out.trim());
  console.log('\n--- END SAMPLE ---');
  console.log('If this looks correct, translation runs are safe. Otherwise consider `ollama pull aya-expanse:8b` (or another Gujarati-capable model).');
}

async function main() {
  const args = parseArgs();

  // --check probes Gujarati capability without touching any data.
  if (args.check) { await checkModel(args.model); return; }

  const { code, unit, force = false, model } = args;
  if (!code || !unit) { console.error('Usage: node scripts/ai_book/translate_gu.js --code 4360302 --unit 1 [--model aya-expanse:8b] [--force]'); process.exit(1); }

  const dataDir = path.join(ROOT, 'data', 'ai_books', String(code));
  const enPath = path.join(dataDir, `unit-${unit}.md`);
  if (!fs.existsSync(enPath)) { console.error('English markdown not found:', enPath); process.exit(1); }

  const statePath = path.join(dataDir, 'state.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  const guDoneKey = `unit${unit}:gu:done`;

  if (state[guDoneKey] && !force) {
    console.log(`[cached] Gujarati translation already done for unit ${unit} (use --force to redo)`);
    return;
  }

  const md = fs.readFileSync(enPath, 'utf8');
  const chunks = splitChunks(md);
  console.log(`\n=== Gujarati translation | ${code} unit ${unit} | ${chunks.length} chunks | ${model || process.env.OLLAMA_GU_MODEL || 'aya-expanse:8b'} ===\n`);

  const outParts = [];
  const startT = Date.now();
  for (let i = 0; i < chunks.length; i++) {
    const ck = chunks[i];
    const doneKey = `unit${unit}:gu:${ck.idx}`;
    if (state[doneKey] && !force) {
      console.log(`[cached] part ${ck.idx}`);
      outParts.push({ idx: ck.idx, text: fs.readFileSync(path.join(dataDir, `part-gu-${ck.idx}.md`), 'utf8') });
      continue;
    }
    console.log(`[part ${ck.idx + 1}/${chunks.length}] translating (${ck.text.trim().split(/\s+/).length} words)...`);
    const gu = await callOllama(ck.text, { model });
    const cleaned = gu.trim();
    fs.writeFileSync(path.join(dataDir, `part-gu-${ck.idx}.md`), cleaned);
    state[doneKey] = new Date().toISOString();
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    outParts.push({ idx: ck.idx, text: cleaned });
    console.log(`   ✓ part ${ck.idx} -> ${cleaned.length} chars (${((Date.now() - startT) / 1000).toFixed(0)}s elapsed)`);
    await new Promise(r => setTimeout(r, 500));
  }

  outParts.sort((a, b) => a.idx - b.idx);
  const chapter = outParts.map(p => p.text.trim()).join('\n\n---\n\n');
  const guPath = path.join(dataDir, `unit-${unit}.gu.md`);
  fs.writeFileSync(guPath, chapter);
  state[guDoneKey] = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`\n=== Done. Gujarati markdown written to ${guPath} (${chapter.length} chars) ===`);
  return { path: guPath, chars: chapter.length };
}

if (require.main === module) {
  main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
}

module.exports = { main, splitChunks, callOllama };