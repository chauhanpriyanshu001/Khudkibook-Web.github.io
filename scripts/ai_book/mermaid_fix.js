/**
 * Shared Mermaid repair + validation for the AI book pipeline.
 *
 * AI models routinely emit Mermaid that won't parse: stray annotations after a
 * node (`--> A[Label] (note)`), unbalanced brackets, un-closed fences, half-cut
 * blocks when the token budget is exhausted, or node labels with quotes that
 * Mermaid's strict parser rejects. This module:
 *
 *   repairMermaid(src)  -> best-effort fixed diagram source (string)
 *   validateMermaid(src)-> { ok, issues, errors } structural verdict
 *   repairMarkdown(md)  -> rewrites fenced blocks, closing unterminated ones
 *
 * Used by ollama_gen (post-generate, with optional re-request), build_book_page
 * and assemble_book so every unit sees the same sane diagram behaviour.
 */

const DIAGRAM_KINDS = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|xychart-beta)/;

// Regex-heavy repairs, applied line-by-line and globally, from most common AI
// mistakes to least. Order matters (number -> arrow -> edge ops).
function repairSource(src) {
  let s = String(src || '');

  // Models occasionally include the fence itself in a saved source block.
  s = s.replace(/^\s*```(?:mermaid)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  // Mermaid treats a number of punctuation characters as syntax inside
  // unquoted flowchart labels. Quote only labels that need it; this preserves
  // short, clean labels while preventing parser failures for real syllabus
  // names such as "Input / Output (I/O)".
  s = s.split('\n').map(line => {
    if (!/^\s*(?:flowchart|graph)\b/i.test(s) && !/-->|==>|-\.-|---/.test(line)) return line;
    return line.replace(/([A-Za-z][A-Za-z0-9_]*)\[([^\]\n]*)\]/g, (m, id, label) => {
      let clean = label.trim();
      // Older repairs emitted single quotes inside the node brackets. Mermaid
      // treats those as visible text, which is why readers saw a leading
      // apostrophe in labels such as 'Vertical Asymptote'. Strip only an
      // outer quote pair; apostrophes inside normal prose remain intact.
      if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"'))) {
        clean = clean.slice(1, -1).trim();
      }
      clean = clean.replace(/"/g, '&quot;');
      if (!clean || /^\s*["'][\s\S]*["']\s*$/.test(clean)) return `${id}[${clean}]`;
      const needsQuotes = /[()[\]{}:;,/%#&/\\]/.test(clean) || clean.length > 30;
      if (!needsQuotes) return `${id}[${clean}]`;
      // Keep long labels inside the SVG viewport. htmlLabels is enabled by
      // both readers, so <br/> produces a real line break rather than a
      // literal tag.
      const wrapped = clean.split(/\s+/).reduce((rows, word) => {
        const last = rows[rows.length - 1] || '';
        if (!rows.length) rows.push(word);
        else if (last && `${last} ${word}`.length > 28) rows.push(word);
        else rows[rows.length - 1] = `${last} ${word}`.trim();
        return rows;
      }, []).join('<br/>');
      return `${id}["${wrapped}"]`;
    });
  }).join('\n');

  // `--> X[Label] (annotation)` -> `--> X[Label: annotation]`
  s = s.replace(/(-->|\+-+>|==>|--->)\s*([A-Za-z0-9_]+)\[([^\]]*)\]\s*\(([^)]*)\)/g, (m, arrow, id, label, note) => {
    const n = (note || '').trim(), l = (label || '').trim();
    const merged = n && l ? `${l} - ${n}` : (l || n);
    return `${arrow} ${id}[${merged}]`;
  });
  // trailing orphan parens / empty groups
  s = s.replace(/\(\)/g, '').replace(/\(\s*\)/g, '');

  // node labels must not contain double quotes, backticks, or stray semicolons
  s = s.replace(/`([^`]*)`/g, (m, cap) => (cap || '').trim());

  // strip `>` prefixes that sometimes leak when a model indents a diagram as a quote
  s = s.split('\n').map(l => l.replace(/^\s*>\s?/, '')).join('\n');

  // collapse runs of spaces inside edge definitions but keep axis-separated labels
  s = s.split('\n').map(l => l.trimEnd().replace(/[ \t]{2,}/g, ' ')).join('\n');

  // close dangling opening brackets left by a truncated output (label cut mid-way).
  // Only clamp when every trailing '[' sits after the last ']' — i.e. an
  // unclosed bracket group at the very end of the source.
  const lastOpen = s.lastIndexOf('[');
  const lastClose = s.lastIndexOf(']');
  if (lastOpen > lastClose) {
    // count how many ']' are missing up to the trailing open bracket
    const tailOpen = (s.slice(lastOpen).match(/\[/g) || []).length;
    const tailClose = (s.slice(lastOpen).match(/\]/g) || []).length;
    const need = tailOpen - tailClose;
    if (need > 0) s = s.replace(/\s*$/, '') + ']'.repeat(need);
  }
  // drop any fully unbalanced `]` with no matching opener
  let diff = (s.match(/\]/g) || []).length - (s.match(/\[/g) || []).length;
  if (diff > 0) {
    for (let k = 0; k < diff; k++) s = s.replace(/\]/, '');
  }

  // Mermaid IDs may not contain spaces. Repair the common "node id = label"
  // pattern without touching legitimate edge labels.
  s = s.split('\n').map(line => line.replace(/^\s*([^\s\[\]()-]+)\s*=\s*/g, '$1 ')).join('\n');

  return s;
}

function findDiagramStart(lines, i) {
  // from the current line, find a leading diagram-type line (allow leading comments)
  for (let j = i; j < lines.length && j < i + 4; j++) {
    const t = lines[j].trim();
    if (!t || t.startsWith('%%')) continue;
    return DIAGRAM_KINDS.test(t) ? j : -1;
  }
  return -1;
}

function validateMermaid(src, { allowErrors = false } = {}) {
  const text = String(src || '');
  const issues = [];
  const errors = [];

  if (!text.trim()) return { ok: false, issues: ['empty diagram'], errors: ['empty diagram'] };

  const lines = text.split('\n');
  const start = findDiagramStart(lines, 0);
  if (start === -1) errors.push('no flowchart/graph/sequenceDiagram/… starter line');
  else if (start > 0) issues.push(`${start} leading comment/non-diagram line(s)`);

  let brackets = 0, parens = 0, braces = 0, quotesOpen = false;
  let edgeCount = 0, nodeCount = 0, isSeq = DIAGRAM_KINDS.test(text) && /^sequenceDiagram\b/m.test(text);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('%%')) continue;
    for (const ch of t) {
      if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
      else if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '"') quotesOpen = !quotesOpen;
    }
    if (/-->|\+-+>|==>|--->/.test(t)) edgeCount++;
    if (isSeq && /->>|--\)|--\)/.test(t)) edgeCount++;
    if (/\b[A-Za-z0-9_]+\s*\[/.test(t)) nodeCount++;
    if (isSeq && /^(\s*)(participant|actor|participants)\b/i.test(t)) nodeCount++;
  }
  if (brackets !== 0) issues.push(`unbalanced [ ] (${brackets})`);
  if (parens !== 0) issues.push(`unbalanced ( ) (${parens})`);
  if (braces !== 0) issues.push(`unbalanced { } (${braces})`);
  if (quotesOpen) issues.push('unterminated double-quote');
  if (edgeCount === 0 && nodeCount === 0) issues.push('no nodes or edges');

  // A "half-cut" diagram: last line is empty or ends mid-edge (dangling arrow).
  const last = lines[lines.length - 1] || '';
  if (/-->$|\+-->$|==>$|--->$|->>$/.test(last.trim())) {
    issues.push(`possible half-cut diagram (last line: "${last.trim()}")`);
    if (!allowErrors) errors.push('truncated trailing edge arrow');
  }

  return { ok: issues.length === 0 && errors.length === 0, issues, errors };
}

// Repair a single diagram source; returns { src, fixed, issues, valid } where
// `issues` are from the raw input and `valid` reflects the repaired output.
function repairMermaid(raw) {
  const src = repairSource(raw);
  const rawIssues = validateMermaid(raw).issues;
  const finalCheck = validateMermaid(src);
  return { src, fixed: src !== String(raw || ''), issues: rawIssues, valid: finalCheck.ok, finalIssues: finalCheck.issues };
}

// Scan a markdown doc, close any unterminated ```mermaid fences, and report
// each fenced block with its repaired source. Returns a new markdown string.
function repairMarkdown(md) {
  const lines = String(md || '').split(/\r?\n/);
  const out = [];
  let inFence = false, fenceLang = '', acc = [];
  let changed = false;

  const flush = () => {
    const clean = acc.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (fenceLang === 'mermaid') {
      out.push('```mermaid');
      if (clean) out.push(repairSource(clean));
      out.push('```'); // always close
    } else {
      // Preserve source code fences. Older code converted every fence into
      // Mermaid, which made C/Python examples appear as broken diagrams.
      out.push('```' + (fenceLang || ''));
      if (clean) out.push(clean);
      out.push('```');
    }
  };

  for (const line of lines) {
    if (!inFence) {
      const blockFence = line.match(/^\s*>\s*```(.*)$/);
      if (/^\s*```/.test(line) || blockFence) {
        fenceLang = (blockFence ? blockFence[1] : line.trim().replace(/^```/, '')).trim().toLowerCase();
        inFence = true; acc = [];
        if (fenceLang === 'mermaid') { /* keep */ }
      } else out.push(line);
      continue;
    }
    const contentLine = line.replace(/^\s*>\s?/, '');
    if (/^\s*```\s*$/.test(contentLine)) { flush(); inFence = false; continue; }
    if (/^\s*```/.test(contentLine)) {
      // an opening without content following — treat as nested opener, close current first
      flush(); inFence = false; out.push(contentLine); changed = true; continue;
    }
    acc.push(contentLine);
  }
  if (inFence) { flush(); changed = true; } // unterminated fence at EOF

  return { md: out.join('\n'), changed };
}

// Count diagrams + report per-block validity for the build step.
function analyzeMermaid(md) {
  const blocks = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(String(md || '')))) {
    const src = m[1];
    const v = validateMermaid(src);
    blocks.push({ src, ok: v.ok, issues: v.issues, errors: v.errors });
  }
  return { count: blocks.length, blocks };
}

module.exports = { repairSource, repairMermaid, repairMarkdown, validateMermaid, analyzeMermaid };