/**
 * Convert model-generated LaTeX fragments into readable textbook notation.
 *
 * The generator is instructed not to emit LaTeX, but older cached chapters
 * contain it. This pass is dependency-free and also runs at build time so a
 * legacy chapter cannot ship raw `\\text{...}`, `\\mathbf{...}` or `\\-1`.
 */

const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', 'n': 'ₙ', 'i': 'ᵢ' };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', 'x': 'ˣ', 'n': 'ⁿ', 'i': 'ⁱ' };

function mapChars(value, map) {
  return String(value).replace(/./g, c => map[c] || c);
}

function texExprToText(expr) {
  let s = String(expr || '');

  // Matrices and determinants become compact, readable textbook notation.
  s = s.replace(/\\begin\{(?:v|b|p)?matrix\}([\s\S]*?)\\end\{(?:v|b|p)?matrix\}/gi, (_, body) => {
    const rows = body.split(/\\\\/g)
      .map(row => row.replace(/\s*&\s*/g, '  ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return rows.length ? `[ ${rows.join(' ; ')} ]` : '';
  });

  // Formatting commands: retain their content, never the command itself.
  s = s.replace(/\\(?:text|mathrm|textrm|mathbf|mathit|mathsf|ce|rm|it|bf|operatorname)\s*\{([^{}]*)\}/g,
    (_, inner) => texExprToText(inner));
  s = s.replace(/\\(?:left|right|displaystyle)\b/g, '');

  // Fractions need to run before generic brace cleanup.
  s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
    (_, a, b) => `(${texExprToText(a)} / ${texExprToText(b)})`);

  s = s.replace(/\^\s*\{([^{}]*)\}/g, (_, inner) => mapChars(texExprToText(inner), SUP));
  s = s.replace(/\^([0-9A-Za-z+\-])/g, (_, c) => mapChars(c, SUP));
  s = s.replace(/_\s*\{([^{}]*)\}/g, (_, inner) => mapChars(texExprToText(inner), SUB));
  s = s.replace(/_([0-9nNi])/g, (_, c) => mapChars(c, SUB));

  const symbols = {
    times: '×', cdot: '·', pm: '±', approx: '≈', neq: '≠', leq: '≤', geq: '≥',
    to: '→', rightarrow: '→', leftarrow: '←', uparrow: '↑', downarrow: '↓',
    in: '∈', alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ',
    theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', tau: 'τ', phi: 'φ',
    omega: 'ω', Angstrom: 'Å', degree: '°'
  };
  s = s.replace(/\\([A-Za-z]+)/g, (_, name) => symbols[name] || '');
  s = s.replace(/\\([*{}+\-=/<>()[\]|])/g, '$1');
  s = s.replace(/\\\\/g, ' ; ');
  s = s.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
  return s;
}

/** Clean delimited math and bare commands left by older generations. */
function cleanLatexMath(md) {
  const lines = String(md || '').split(/\r?\n/);
  let inMermaid = false;
  return lines.map(line => {
    if (/^\s*```mermaid\b/i.test(line)) { inMermaid = true; return line; }
    if (inMermaid && /^\s*```\s*$/.test(line)) { inMermaid = false; return line; }
    if (inMermaid) return line;

    const hadLatex = /\\(?:[A-Za-z]+|[()[\]{}])|(?:\^|_)\s*[0-9{]/.test(line);
    let out = line
      .replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (_, inner) => texExprToText(inner))
      .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, inner) => texExprToText(inner))
      .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, inner) => texExprToText(inner))
      .replace(/\$\s*([^$\n]*?)\s*\$/g, (_, inner) => texExprToText(inner));

    if (hadLatex) out = texExprToText(out);

    // Bare commands commonly occur when a model forgets the math delimiters.
    out = out
      .replace(/\\(?:text|mathrm|textrm|mathbf|mathit|mathsf|ce|rm|it|bf)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\(?:times|cdot|pm|approx|neq|leq|geq|to|rightarrow|leftarrow)\b/g,
        match => texExprToText(match))
      .replace(/\\-([0-9])/g, '-$1')
      .replace(/\\([*{}+\-])/g, '$1')
      .replace(/(?<![A-Za-z])\\(?=[A-Za-z])/g, '');
    return out;
  }).join('\n');
}

module.exports = { cleanLatexMath, texExprToText };
