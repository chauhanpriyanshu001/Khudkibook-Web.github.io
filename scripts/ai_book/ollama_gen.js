/**
 * Ollama-based GTU AI Book generator (Unit mode)
 *
 * Generates one unit-chapter for a subject from its syllabus content
 * using the local Ollama server (http://localhost:11434).
 *
 * Output:
 *   - Markdown:  data/ai_books/<code>/unit-<n>.md
 *   - HTML:      public/books/<code>/unit-<n>.html
 *   - State log: data/ai_books/<code>/state.json
 *
 * Run: node scripts/ai_book/ollama_gen.js --code 4360302 --unit 1
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OLLAMA = 'http://localhost:11434/api/generate';
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

// Bump this whenever section prompts / content rules change so cached parts
// from older versions are ignored. Stored in state.json as promptVersion.
const PROMPT_VERSION = 'v2-2026-09-06-examples-mermaid';

const SYSTEM = `You are a diploma engineering textbook author writing for Gujarat Technological University (GTU).
You write textbook chapters for a semester-6 Biomedical Engineering student.
Style requirements:
- Simple, clear English at diploma level; short paragraphs and bullet points.
- Cover ONLY the syllabus topics given in the user message. Do NOT add topics outside the syllabus.
- Define every important term in bold when introduced.
- Use plain Markdown: # for the chapter title, ## for main sections, ### for sub-sections, - for bullets.
- Include concrete examples, realistic numbers and practical context wherever relevant.
- Be exam-oriented: mirror the verbs used in the unit outcomes (Define, Classify, Enlist, Explain, Describe).
- EVERY main section (heading ##) must include at least ONE worked example (numerical or practical/problem)
  presented as a blockquote that starts with "> **Example:** " on its first line; if the example continues on
  more lines, continue each line as "> " so all lines are part of the same blockquote.
- Where a classification, sequence, flow or process needs to be visualised, ADD A MERMAID DIAGRAM as a
  fenced code block opening with a line containing exactly: \`\`\`mermaid
  Prefer "flowchart TD" for taxonomies/families and "flowchart LR" or "sequenceDiagram" for sequences.
  Keep diagrams concise (12 nodes max), use square brackets for node labels like A[Label Text],
  do not put quotation marks or apostrophes inside the brackets, and always give nodes short IDs.
  Example of the exact fence format:
\`\`\`mermaid
flowchart TD
    A[Biomaterial] --> B[Metals]
    A --> C[Ceramics]
    B --> D[Bone plates, implants]
\`\`\`
- Use one clear diagram per section only where it genuinely aids understanding; do not force diagrams into
  trivial content. Prefer a Markdown table when comparing tabular data.
Do NOT include headings like "Unit Outcomes". Start directly with the chapter content.`;

const UNIT_DEFS = {
  4360302: {
    subject: 'Biomaterials & Implants',
    unit: 'Unit – I: Introduction of Biomaterials and Implants',
    examWeight: '14 marks in the end-semester exam (7 Remember + 4 Understand + 3 Apply)',
    uos: [
      '1a. Define Biomaterial, Implant, Biological Material, Bio compatibility.',
      '1b. Classify different Biomaterial.',
      '1c. Enlist the need of biomaterial.',
      '1d. Explain in detail the need of biomaterial for the society.',
      '1e. Describe tissue response to implants.',
      '1f. Explain the concept of biocompatibility of implants with the human body.',
      '1g. Give Classification for different implant.',
      '1h. Explain acute and chronic inflammation.',
      '1i. Enlist the infections that happen due to implants.'
    ],
    sections: [
      {
        key: 's1',
        topic: '1.1 Introduction to Biomaterial and Biological Material  +  1.2 Need of Biomaterial',
        spec: `Write the chapter introduction and two sections:
## 1.1 Introduction to Biomaterial and Biological Material
- Define biomaterial; define biological (natural) material; compare with examples (e.g. metals vs bone, polymers vs collagen).
- Explain how a biomaterial must interact safely with living tissue.

## 1.2 Need of Biomaterial
- Enlist and explain the needs of biomaterials for society (replace damaged tissues, restore function, implants for trauma/degeneration, improve quality of life, pacemakers, artificial heart valves, sutures, bone plates, joints, blood tubes etc.).`,
        hint: 'Add a flowchart TD showing the needs of biomaterial for society.',
        target: 'about 900-1100 words'
      },
      {
        key: 's2',
        topic: '1.3 Classification of Biomaterial',
        spec: `## 1.3 Classification of Biomaterial
- Classify biomaterials into main groups (metals and alloys, ceramics, polymers, composites, natural biomaterials).
- For each class give: what it is, typical examples, and where it is used in the body.
- Use a Markdown table: Class | Typical Examples | Biomedical Application.`,
        hint: 'Add a flowchart TD classifying biomaterials into main groups.',
        target: 'about 700-900 words'
      },
      {
        key: 's3',
        topic: '1.4 Introduction to Implant + 1.4.1 Classification of Implant',
        spec: `## 1.4 Introduction to Implant
- Define the term implant; explain how an implant differs from a general biomaterial.
- Give examples of common implants (bone plates, sutures, joint replacements, pacemakers, cardiac valves, dental implants).
## 1.4.1 Classification of Implant
- Classify implants from different viewpoints (permanent vs temporary, internal vs external, functional vs non-functional, by tissue/organ site) with examples.`,
        hint: 'Add a flowchart TD classifying implants from different viewpoints.',
        target: 'about 800-1000 words'
      },
      {
        key: 's4',
        topic: '1.5 Tissue Response to Implants + 1.5.1 Biocompatibility + 1.5.2 Inflammation and Infection',
        spec: `## 1.5 Tissue Response to Implants
- Describe the sequence of tissue/tissue-fluid reactions when an implant is placed (protein adsorption, acute inflammatory response, chronic inflammation, granulation tissue, fibrous capsule).
## 1.5.1 Biocompatibility
- Define biocompatibility; explain the concept of the implant being compatible with the living human body (no rejection, no toxicity, no adverse tissue reaction) with the host response concept.
## 1.5.2 Inflammation and Infection
- Explain acute and chronic inflammation (causes, cells involved, characteristics, timeline).
- Enlist infections that happen due to implants (surgical infection, biofilm formation on devices, pacemaker/dental/orthopaedic implant infections etc.).`,
        hint: 'Add a flowchart LR or sequenceDiagram showing the tissue response timeline (protein adsorption -> acute inflammation -> chronic inflammation -> granulation tissue -> fibrous capsule).',
        target: 'about 900-1100 words'
      },
      {
        key: 's5',
        topic: 'Solved examples, unit-end questions, summary and key terms',
        spec: `
## Solved Examples
Include 3 descriptive solved examples, each linked to a unit outcome (e.g. classify biomaterials shown in a device list, explain the tissue response sequence, define/contrast biocompatibility terms). Solve them step by step like a model answer.

## Unit-End Questions (GTU exam style)
Provide exam questions with marks, distributed among Remember (3 marks), Understand (4 marks) and Apply (7 marks) levels. Aim for a total around 14 marks coverage. Format each as: "- (3) Define ... ."

## Summary
A concise bullet summary of the whole unit.

## Key Terms
A glossary list "**Term** – short definition" of at least 8 terms from this unit.`,
        target: 'about 700-900 words'
      }
    ]
  }
};

// ------------------------------------------------------------------
// Ollama API helpers
// ------------------------------------------------------------------
async function callOllama(prompt, { maxTokens = 4096, temperature = 0.7, retries = 3 } = {}) {
  const body = {
    model: MODEL,
    prompt,
    system: SYSTEM,
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
      // Streaming mode: no server-side 5-min timeout, and we can show progress.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let lastLog = Date.now();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunks = decoder.decode(value, { stream: true }).split('\n');
        for (const line of chunks) {
          if (!line.trim()) continue;
          let j;
          try { j = JSON.parse(line); } catch (_) { continue; }
          text += j.response || '';
          if (j.done) {
            reader.cancel();
            if (Date.now() - lastLog > 4000 && text) {
              console.log(`      ... ${text.trim().split(/\s+/).length} words`);
              lastLog = Date.now();
            }
            return text;
          }
        }
        if (Date.now() - lastLog > 4000 && text) {
          console.log(`      ... ${text.trim().split(/\s+/).length} words`);
          lastLog = Date.now();
        }
      }
      return text;
    } catch (e) {
      lastErr = e;
      console.log(`   [retry ${attempt}/${retries}] ${e.message}`);
      await new Promise(r => setTimeout(r, 10000 * attempt));
    }
  }
  throw lastErr;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Build a UNIT_DEFS-shaped definition from an auto-parsed unitdef.json so any
// subject code can be generated without handwritten sections.
function buildDefsFromUnitdef(code, dataDir, unit) {
  const udPath = path.join(dataDir, 'unitdef.json');
  if (!fs.existsSync(udPath)) throw new Error(`No unitdef.json at ${udPath} — run parse_syllabus.js first`);
  const ud = JSON.parse(fs.readFileSync(udPath, 'utf8'));
  const u = (ud.units || []).find(x => x.n === unit);
  if (!u) throw new Error(`unitdef.json has no unit ${unit}`);

  const topics = u.topics && u.topics.length ? u.topics : [`Unit ${u.roman}`];
  const chunk = Math.max(1, Math.ceil(topics.length / 5)); // <=5 sections per unit
  const sections = [];
  for (let g = 0; g < topics.length; g += chunk) {
    const group = topics.slice(g, g + chunk);
    const spec = group.map(t => {
      const title = t.replace(/^\s*\d+(?:\.\d+)*\.?\s*/, '').trim();
      const hint = /[Cc]lassif/i.test(t)
        ? 'Include a Mermaid "flowchart TD" classifying this topic.'
        : /([Ss]equence|[Rr]esponse|[Ii]nflammat|[Ss]tep|[Ff]low|[Pp]rocess|[Pp]rocedure)/.test(t)
          ? 'Include a Mermaid "flowchart LR" or "sequenceDiagram" showing the sequence/flow for this topic.'
          : null;
      return `## ${t}\nWrite a detailed, exam-oriented section covering exactly this syllabus topic: "${title}".\n${hint ? `- ${hint}\n` : ''}- End with at least one worked example as a blockquote starting with "> **Example:** ".`;
    }).join('\n\n');
    sections.push({
      key: `s${sections.length + 1}`,
      topic: group.join('; ').slice(0, 90),
      spec: spec.slice(0, -1), // drop trailing newline
      target: `about ${group.length * 350}-${group.length * 500} words (${group.length} topic(s))`
    });
  }

  return {
    subject: ud.subject || `Subject ${code}`,
    unit: `Unit – ${u.roman}: ${u.title || `Unit ${u.roman}`}`,
    examWeight: u.marks ? `${u.marks} (per syllabus)` : (ud.units.length ? '' : ''),
    uos: u.uos || [],
    sections
  };
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--code') opts.code = args[++i];
    else if (args[i] === '--unit') opts.unit = parseInt(args[++i], 10);
  }
  return opts;
}

async function main() {
  const { code, unit } = parseArgs();
  if (!code || !unit) { console.error('Usage: node scripts/ai_book/ollama_gen.js --code 4360302 --unit 1'); process.exit(1); }
  const codeS = String(code);
  const dataDir = path.join(ROOT, 'data', 'ai_books', codeS);
  const publicDir = path.join(ROOT, 'public', 'books', codeS);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });

  const def = UNIT_DEFS[codeS] || buildDefsFromUnitdef(codeS, dataDir, unit);
  if (!def) { console.error(`No syllabus definition for code ${code}`); process.exit(1); }

  const last = path.join(dataDir, `unit-${unit}.md`);
  const statePath = path.join(dataDir, 'state.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};

  console.log(`\n=== Generating ${def.subject} | ${def.unit} (${code}) using ${MODEL} ===\n`);

  // Build the chapter doc progressively. Intro + UOs listing up front.
  const intro = `# ${def.unit}\n\n` +
    `*(AI-generated self study book for GTU Diploma Biomedical Engineering, subject code ${code} — generated locally with Ollama.)*\n\n` +
    `This unit carries approximately **${def.examWeight}**.\n\nLearning objectives covered by this unit:\n` +
    def.uos.map(u => `- ${u.replace(/^\d+[a-z]\./i, '').trim()}`).join('\n') + '\n';

  let doc = intro;
  const parts = [];
  const startT = Date.now();

  const totalSections = def.sections.length;
  const cacheOk = state.promptVersion === PROMPT_VERSION;
  if (!cacheOk) console.log(`! promptVersion changed (${state.promptVersion || 'none'} -> ${PROMPT_VERSION}) — regenerating all sections`);

  for (let si = 0; si < def.sections.length; si++) {
    const sec = def.sections[si];
    const doneKey = `unit${unit}:${sec.key}`;
    if (cacheOk && state[doneKey]) {
      console.log(`[cached] ${sec.key} (already generated)`);
      const cached = fs.readFileSync(path.join(dataDir, `part-${sec.key}.md`), 'utf8');
      parts.push({ key: sec.key, text: cached });
      continue;
    }

    const user = `Syllabus Unit Outcomes:${def.uos.map(u => '\n  ' + u).join('')}\n\n` +
      `Course competency: "Select appropriate bio-materials and implants as per requirement."\n\n` +
      `Now write the following part of the chapter, ${sec.target}:\n${sec.spec}\n` +
      (sec.hint ? `\nDiagram requirement for this part:\n- ${sec.hint}\n` : '') +
      `\nExample requirement for this part:\n- Include at least ONE worked example (numerical or practical), as a blockquote starting with "> **Example:** ".\n- Every other main section (## heading) in your output must also include a worked example in the same blockquote format.`;

    console.log(`\n[${si + 1}/${totalSections}] ${sec.key}: ${sec.topic}\n${sec.target}...`);
    const text = await callOllama(user);
    if (!text /* || text.trim().length < 200 */) {
      console.log(`   ! empty/short output for ${sec.key}; storing anyway`);
    }
    parts.push({ key: sec.key, text });
    const fn = path.join(dataDir, `part-${sec.key}.md`);
    fs.writeFileSync(fn, text);
    state[doneKey] = new Date().toISOString();
    state[`${doneKey}:file`] = fn;
    state.promptVersion = PROMPT_VERSION;
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    console.log(`   ✓ ${sec.key} -> ${text.trim().length} chars (${((Date.now() - startT) / 1000).toFixed(0)}s elapsed)`);
    await delay(2000);
  }

  const chapter = intro + '\n' + parts.map(p => p.text.trim()).join('\n\n---\n\n') + '\n';
  fs.writeFileSync(last, chapter);
  console.log(`\n=== Done. Markdown written to ${last} (${chapter.length} chars) ===`);
  return { last, chapter };
}

if (require.main === module) {
  main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
}

module.exports = { main, callOllama, SYSTEM };