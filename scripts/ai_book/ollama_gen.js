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
const { repairMermaid, repairMarkdown, analyzeMermaid } = require('./mermaid_fix');
const { cleanLatexMath } = require('./tex_fix');

const ROOT = path.join(__dirname, '..', '..');
// OLLAMA_HOST overrides the server: default localhost for "Local", set it to
// the Race pod (http://<pod-ip>:11434) for "Race" generation. run_subject /
// server.js pass this through via process.env.
const OLLAMA_BASE = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA = `${OLLAMA_BASE.replace(/\/$/, '')}/api/generate`;
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
// Set OPENCODE_MODEL=opencode/<model> to generate through `opencode run` instead of
// local Ollama — e.g. OPENCODE_MODEL=opencode/muse-spark-1.3-contributor-free (free,
// cost 0 on the opencode provider) or a claude-* model once the account has funds.
// OPENCODE_MODEL wins over OLLAMA_MODEL when both are set.
const { callOpenCode } = require('./opencode_client');
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || '';

// Bump this whenever section prompts / content rules change so cached parts
// from older versions are ignored. Stored in state.json as promptVersion.
const PROMPT_VERSION = 'v6-2026-10-07-content-matched-figures';

// Subject-appropriate author prompt: degree (BE/ME) vs diploma.
function makeSystem(level = 'degree') {
  const degree = level === 'degree';
  return `You are ${degree ? 'a B.E. engineering textbook author' : 'a diploma engineering textbook author'} writing for Gujarat Technological University (GTU).
You write exam-oriented textbook chapters for GTU students.
Style requirements:
- Simple, clear ${degree ? 'engineering-degree-level' : 'diploma-level'} English. The chapter reads like a real textbook, not revision notes: write continuous prose in full paragraphs and use bullet lists only for genuine enumerations a textbook would list.
- Cover ONLY the syllabus topics given in the user message. Do NOT add topics outside the syllabus.
- Define every important term in bold when introduced.
- Use plain Markdown: # for the chapter title, ## for main sections, ### for sub-sections, - for bullets.
- NEVER use LaTeX math code (no \\( ... \\), $...$, \\text{} , \\times, ^sub/superscript LaTeX syntax). Write chemical formulas, units, numbers and simple math in plain readable text: e.g. CH4, CO2, H2O, H2SO4, Fe^2+ or Fe2+, E = mc2, Z* = Z - S, 1s2 2s2 2p4. Use unicode where helpful (2s² 2p⁴, Cu²⁺). Everything must read as normal textbook words, never as raw LaTeX.
- Include concrete examples, realistic numbers and practical context wherever relevant.
- Be exam-oriented: mirror the verbs used in the unit/module outcomes (Define, Classify, Enlist, Explain, Describe, Solve, Apply).
- EVERY main section (heading ##) must include at least ONE worked example (numerical or practical/problem)
  presented as a blockquote that starts with "> **Example:** " on its first line; if the example continues on
  more lines, continue each line as "> " so all lines are part of the same blockquote. Worked examples are
  exam model answers: label each step ("Step 1:", "Step 2:", ...) and finish with a bold "**Answer:**" line.
- Section flow: open every main (##) section with 1-2 sentences that connect it to what the student just
  read, develop the content, and — unless told the next topic is elsewhere — close with one bridging
  sentence that leads naturally into what follows. The user message names the next topic when there is one.
  Keep ### sub-headings rare; prefer flowing prose under ##.
- Diagrams are textbook FIGURES chosen to FIT THE CONTENT — never a flowchart by habit:
  - Pick the figure TYPE from what the content actually is:
    - Taxonomy/classification (groups -> members): "flowchart TD" with NESTED SUBGRAPHS — one subgraph per
      group containing its members; the root branches only into subgraphs, never directly into leaves (a flat
      star is NOT acceptable). The nesting itself shows containment.
    - Numbered sequence/process over time: "flowchart LR" with numbered steps (N1 --> N2 --> N3), or
      "sequenceDiagram" when different actors/devices exchange messages.
    - History, evolution, chronology, milestones, phases with day/week/time ranges: a "timeline" diagram
      (time : event entries), NOT a flowchart.
    - States changing over time (implant/tissue/material states, working modes): "stateDiagram-v2" with
      labelled transitions.
    - Structure/parts/layers of a device, organ or system: nested subgraphs — one subgraph per component or
      layer holding its inner features — so the drawing shows containment, not arrows from one central node.
    - Repeating cycle: a "flowchart" forming a CLOSED loop (last node --> first node) with labelled edges.
    - Composition/percentages/proportions of a whole: a "pie" chart with quoted slice labels.
    - Comparing items on criteria: a Markdown table, no figure.
  - Use ONLY these mermaid diagram types (flowchart, sequenceDiagram, stateDiagram-v2, timeline, pie) and
    choose BY CONTENT — when another type above fits the content better than a flowchart, use it.
  - Flowchart-specific rules: label edges with the relationship when it is not obvious, using pipe labels in
    plain words only (no parentheses, quotes or special characters): M -->|example| T[Titanium Joint];
    node labels are complete noun phrases in square brackets like A[Label Text]; short IDs only (A, B, step1);
    never quotation marks or apostrophes inside brackets; 8-16 nodes typical.
  - The figure must ADD concrete examples, members, steps or events that the surrounding prose does not
    enumerate — never a restatement of the same list. Keep every label short but complete. Typical size:
    flowchart 8-16 nodes, timeline 4-8 entries, pie 3-6 slices, stateDiagram 4-8 states.
  - Immediately after EVERY mermaid block (any diagram type), add one italic caption line on its own line:
    *Figure: <one sentence saying what the diagram shows>.*
  Exact fence format for each type you may use:
\`\`\`mermaid
flowchart TD
    R[Biomaterial Classes]
    subgraph MG[Metals and Alloys]
        T[Titanium alloys - joint replacements]
        S[Stainless steel - bone plates and screws]
    end
    subgraph PG[Polymers]
        U[UHMWPE - joint liners]
        N[Nylon - sutures and meshes]
    end
    R --> MG
    R --> PG
\`\`\`
\`\`\`mermaid
timeline
    title Tissue response after implantation
    Seconds-minutes : Protein adsorption on the implant surface
    Hours-days : Acute inflammation, neutrophils arrive
    Weeks : Chronic inflammation and granulation tissue
    Months : Fibrous capsule around the implant
\`\`\`
\`\`\`mermaid
stateDiagram-v2
    [*] --> Adsorbed : implant placed
    Adsorbed --> Acute : hours 1-3
    Acute --> Chronic : days 3-7
    Chronic --> Granulation : week 2
    Granulation --> Capsule : month 1
    Capsule --> [*]
\`\`\`
\`\`\`mermaid
pie showData
    title Implant material share (illustrative)
    "Metals and alloys" : 55
    "Polymers" : 30
    "Ceramics" : 15
\`\`\`
- Use one clear diagram per section only where it genuinely aids understanding; do not force diagrams into
  trivial content. Prefer a Markdown table when comparing tabular data.
Do NOT include headings like "Unit Outcomes". Start directly with the chapter content.`;
}

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
        hint: 'Add a Mermaid "flowchart TD" with nested subgraphs — one subgraph per need of biomaterial for society, each containing its concrete device examples (e.g. Cardiovascular -> pacemaker, artificial heart valve); no flat star.',
        target: 'about 900-1100 words'
      },
      {
        key: 's2',
        topic: '1.3 Classification of Biomaterial',
        spec: `## 1.3 Classification of Biomaterial
- Classify biomaterials into main groups (metals and alloys, ceramics, polymers, composites, natural biomaterials).
- For each class give: what it is, typical examples, and where it is used in the body.
- Use a Markdown table: Class | Typical Examples | Biomedical Application.`,
        hint: 'Add a Mermaid "flowchart TD" classifying biomaterials with nested subgraphs — one subgraph per class (Metals and Alloys, Ceramics, Polymers, Composites, Natural), each holding its typical examples; no flat star. Keep the Markdown table as well.',
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
        hint: 'Add a Mermaid "flowchart TD" classifying implants with one subgraph per viewpoint (permanent vs temporary, internal vs external, functional vs non-functional, by body site), each holding example implants.',
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
        hint: 'Add a Mermaid "timeline" diagram (NOT a flowchart) of the tissue response to implants — 4-8 entries such as Seconds-minutes: protein adsorption; Hours-days: acute inflammation; Weeks: chronic inflammation and granulation tissue; Months: fibrous capsule.',
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
async function callOllama(prompt, { maxTokens = 4096, temperature = 0.7, retries = 3, system } = {}) {
  const body = {
    model: MODEL,
    prompt,
    system: system || makeSystem('degree'),
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
      // Figure type chosen by what the topic actually is — classification,
      // chronology, cycle, structure, proportions, states, or a process.
      const hint = /[Cc]lassif|[Ff]amil|kinds? of|types? of/i.test(t)
        ? 'Include a Mermaid "flowchart TD" with nested subgraphs — one subgraph per group containing its members (never a flat star).'
        : /(timeline|history|evolution|chronolog|milestone|over the years|development|phases? with)/i.test(t)
          ? 'Include a Mermaid "timeline" diagram listing the time entries for this topic (not a flowchart).'
          : /(cycle|recycl|closed loop|feedback)/i.test(t)
            ? 'Include a Mermaid "flowchart" forming a CLOSED loop with labelled edges showing the cycle.'
            : /(structure|construction|component|parts? of|layers?|anatomy|layout|assembly)/i.test(t)
              ? 'Include a Mermaid structure figure: nested subgraphs, one per component/layer with its inner features — not arrows from a central node.'
              : /(composition|percentage|share|proportion|distribution)/i.test(t)
                ? 'Include a Mermaid "pie" chart with quoted slice labels showing the proportions.'
                : /(state|phase|stage|transition|response)/i.test(t)
                  ? 'Include a Mermaid "stateDiagram-v2" showing how the states/phases change over time, or a "timeline" if the content is a dated chronology.'
                  : /(sequence|inflammat|step|flow|process|procedure|interaction|communicat|exchange|working)/i.test(t)
                    ? 'Include a Mermaid "flowchart LR" numbered-step diagram or a "sequenceDiagram" showing the sequence/flow for this topic.'
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
    branchLabel: ud.branchLabel || '',
    level: ud.level || (/^(BE|ME)/i.test(String(code)) ? 'degree' : 'diploma'),
    references: (ud.references && ud.references.books) || [],
    referenceSites: (ud.references && ud.references.websites) || [],
    examWeight: u.marks ? `${u.marks} (per syllabus)` : (u.weightage ? `${u.weightage} of the end-semester theory paper (per syllabus)` : (ud.units.length ? '' : '')),
    uos: u.uos || [],
    sections
  };
}

// Per-section user prompt, shared by both backends and the quality probe.
// Carries the chapter-structure instructions: the FIRST part opens the chapter
// with an overview, every other part is told the next topic so it can close
// with a real transition — this is what makes separately generated sections
// read as one connected chapter instead of five isolated essays.
function buildUserPrompt(def, sec, si) {
  const uoStr = def.uos && def.uos.length
    ? `Syllabus unit/module outcomes:\n${def.uos.map(u => '  ' + u).join('\n')}`
    : `Syllabus module: ${def.unit}`;
  const refStr = def.references && def.references.length
    ? `\n\nRecommended textbooks from the official GTU syllabus (align your terminology, notation and approach with these):\n${def.references.map(b => '  - ' + b).join('\n')}`
    : '';
  const structure = si === 0
    ? `\nChapter opening:\n- Begin your part with a "## Chapter Overview" heading and 3-5 sentences telling the student what this chapter covers and how the ideas connect — before any content heading from the spec below.\n`
    : '';
  const bridge = si === def.sections.length - 1
    ? `\nThis is the FINAL part of the chapter: end with one closing sentence that ties the whole unit together for revision.\n`
    : `\nThe NEXT part of this chapter covers: ${def.sections[si + 1].topic}. End your part with one bridging sentence leading into that topic.\n`;
  return `${uoStr}${refStr}\n\nNow write the following part of the chapter, ${sec.target}:\n${sec.spec}\n` +
    (sec.hint ? `\nDiagram requirement for this part:\n- ${sec.hint}\n` : '') +
    `\nExample requirement for this part:\n- Include at least ONE worked example (numerical or practical), as a blockquote starting with "> **Example:** ".\n- Every other main section (## heading) in your output must also include a worked example in the same blockquote format.\n` +
    structure + bridge;
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
  const system = makeSystem(def.level || (/^(BE|ME)/i.test(codeS) ? 'degree' : 'diploma'));

  const last = path.join(dataDir, `unit-${unit}.md`);
  const statePath = path.join(dataDir, 'state.json');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};

  console.log(`\n=== Generating ${def.subject} | ${def.unit} (${code}) using ${OPENCODE_MODEL || MODEL} (${def.level || 'degree'}) ===\n`);

  // Build the chapter doc progressively. Intro + UOs listing up front.
  const uoBlock = def.uos && def.uos.length
    ? `Learning objectives covered by this module:\n` + def.uos.map(u => `- ${u.replace(/^\d+[a-z]\./i, '').trim()}`).join('\n') + '\n'
    : '';
  const refBlock = def.references && def.references.length
    ? `Recommended textbooks from the GTU syllabus (align your terminology and approach with these):\n` + def.references.map(b => `- ${b}`).join('\n') + '\n'
    : '';
  const intro = `# ${def.unit}\n\n` +
    `*(AI-generated self-study book for GTU, subject code ${code}.)*\n\n` +
    `This module carries approximately **${def.examWeight}**.\n\n` +
    uoBlock + refBlock;

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

    const user = buildUserPrompt(def, sec, si);

    console.log(`\n[${si + 1}/${totalSections}] ${sec.key}: ${sec.topic}\n${sec.target}...`);
    let text = OPENCODE_MODEL
      ? await callOpenCode(OPENCODE_MODEL, system, user)
      : await callOllama(user, { system });

    // --- Post-process: strip LaTeX math into readable plain text so books never
    // ship raw \text{CH}_4 style markup to readers. ---
    text = cleanLatexMath(text);

    // --- Diagram safety pass: repair + optionally re-request broken/truncated
    // Mermaid so units never ship with syntax errors or half-cut diagrams. ---
    let mermaidCheck = analyzeMermaid(text);
    if (mermaidCheck.count > 0 && mermaidCheck.blocks.some(b => !b.ok)) {
      const damaged = mermaidCheck.blocks.filter(b => !b.ok).map(b => b.issues.join('; '));
      console.log(`   ! Mermaid issues (${mermaidCheck.count} diagram(s)): ${damaged.join(' | ')}`);
      const repaired = repairMarkdown(text);
      const repairCheck = analyzeMermaid(repaired.md);
      const stillBroken = repairCheck.blocks.some(b => !b.ok);
      if (!stillBroken) {
        text = repaired.md;
        console.log('   ✓ repaired all diagram(s) in place');
      } else if (process.env.RETRY_BROKEN_DIAGRAMS === '1') {
        // One corrective follow-up before we accept the content.
        const fixPrompt = `Your previous answer contains one or more broken Mermaid diagrams (these issues were detected: ${damaged.join('; ')}).\nRewrite ONLY the broken \`\`\`mermaid blocks, keeping all wording identical. Return the complete corrected content.\nRules: open each diagram with a single diagram-type line (e.g. "flowchart TD" or "sequenceDiagram"), never put quotes/apostrophes inside node brackets, and always close the fence with a line containing exactly \`\`\`.`;
        try {
          let fixed = OPENCODE_MODEL
            ? await callOpenCode(OPENCODE_MODEL, system, user + '\n\n' + fixPrompt)
            : await callOllama(user + '\n\n' + fixPrompt, { system });
          const fixedCheck = analyzeMermaid(fixed);
          if (fixedCheck.count > 0 && fixedCheck.blocks.every(b => b.ok)) {
            text = fixed;
            console.log('   ✓ re-requested section and fixed damaged diagram(s)');
          } else {
            text = repairMarkdown(text).md;
            console.log('   ! re-request still broken — kept auto-repaired version');
          }
        } catch (e) {
          text = repairMarkdown(text).md;
          console.log('   ! diagram re-request failed — kept auto-repaired version');
        }
      } else {
        text = repairMarkdown(text).md;
        console.log('   · clamped fences (auto-repair, set RETRY_BROKEN_DIAGRAMS=1 to re-request)');
      }
    }

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

module.exports = { main, callOllama, makeSystem, UNIT_DEFS, buildDefsFromUnitdef, buildUserPrompt };