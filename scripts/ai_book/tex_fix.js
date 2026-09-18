/**
 * LaTeX math -> readable plain-text cleanup for AI book content.
 *
 * The Ollama models frequently emit LaTeX math expressions (e.g. \( \text{CH}_4 \),
 * Z\*, \[He\]2s²2p²) that neither the Markdown renderer nor Mermaid understands,
 * so the reader sees raw source. This module rewrites the most common LaTeX math
 * constructs into unicode plain text (CH₄, Z*, CO₂, 3d⁴, etc.) so books read cleanly.
 *
 * Used post-generate (ollama_gen) and at build time (build_book_page, assemble_book).
 */

// Unicode subscript / superscript maps (covers what crops up in chemistry/physics).
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', 'n': 'ₙ' };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', 'x': 'ˣ', 'n': 'ⁿ' };

function mapChars(str, map) {
  return String(str).replace(/./g, c => map[c] || c);
}

// Convert a single \text{...}-\free expression body into readable text.
function texExprToText(expr) {
  let s = String(expr || '');

  // \text{...}, \mathrm{...}, \textrm{...}, \mathbf{...}, \ce{...}
  s = s.replace(/\\(?:text|mathrm|textrm|mathbf|mathit|mathsf|ce|rm|it|bf)\s*\{([^{}]*)\}/g, (m, inner) => texExprToText(inner));

  // superscripts ^ { ... } and ^x  -> unicode sup
  s = s.replace(/\^\s*\{([^{}]*)\}/g, (m, inner) => mapChars(texExprToText(inner), SUP));
  s = s.replace(/\^([0-9A-Za-z+\-])/g, (m, c) => mapChars(c, SUP));
  // subscripts _ { ... } and _x -> unicode sub
  s = s.replace(/_\s*\{([^{}]*)\}/g, (m, inner) => mapChars(texExprToText(inner), SUB));
  s = s.replace(/_([0-9nN])/g, (m, c) => mapChars(c, SUB));

  // inline \* -> *  (Z\* -> Z*)
  s = s.replace(/\\\*/g, '*');

  // spacing commands
  s = s.replace(/\\(?:;|,|!|quad|qquad)\s*/g, ' ').replace(/\\,\s*/g, ' ');

  // common math symbols
  const sym = {
    times: '×', cdot: '·', pm: '±', approx: '≈', neq: '≠', leq: '≤', geq: '≥',
    to: '→', rightarrow: '→', leftarrow: '←', uparrow: '↑', downarrow: '↓',
    in: '∈', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ',
    theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', tau: 'τ', phi: 'φ',
    omega: 'ω', Angstrom: 'Å', degree: '°'
  };
  s = s.replace(/\\([A-Za-z]+)/g, (m, name) => sym[name] || '');

  // \frac{a}{b}
  s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `(${texExprToText(a)} / ${texExprToText(b)})`);

  // chemical formula "*"
  s = s.replace(/\*/g, '');

  s = s.replace(/[{}\s]+/g, ' ').trim();
  return s;
}

/**
 * Rewrite LaTeX inline/display math into readable text for the whole markdown.
 * Handles \( ... \), \[ ... \], $ ... $ and $$ ... $$ wrappers. Leaves regular
 * text untouched. Use on a unit's markdown before it is rendered or cached.
 */
function cleanLatexMath(md) {
  return String(md || '')
    .replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (m, inner) => texExprToText(inner))
    .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (m, inner) => texExprToText(inner))
    .replace(/\$\s*([^$\n]*?)\s*\$/g, (m, inner) => texExprToText(inner).trim())
    // \[ ... \] -> keep literal square brackets (e.g. \[He\]2s²2p²), stripping the backslashes
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    // stray LaTeX escaping left in plain text (Z\* -> Z*)
    .replace(/\\([*{}])/g, '$1');
}

module.exports = { cleanLatexMath, texExprToText };