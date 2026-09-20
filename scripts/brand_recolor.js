/**
 * Brand recollection for Khudkibook.
 *
 * Recolors the site's indigo/purple theme + the 8 "rainbow" book-cover
 * gradients to the khudkibook logo palette (rust #CD5D33 / amber #F8C885 /
 * brown #75432B / charcoal #44443F). Layout and UI are untouched — only
 * colors change.
 *
 * Runs BOTH over public/ (already-generated site) and scripts/ (so future
 * regenerations and AI-book builds keep the brand palette).
 *
 * Usage: node scripts/brand_recolor.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ---- Phase 1: the 8 deterministic cover gradients (exact full-string swap) ----
const GRADIENTS = [
  ['linear-gradient(160deg,#CD5D33 0%,#F8C885 55%,#4A3A2C 140%)', 'linear-gradient(160deg,#CD5D33 0%,#F8C885 55%,#4A3A2C 140%)'],
  ['linear-gradient(160deg,#C7643B 0%,#EFAE78 55%,#4A3A2C 140%)', 'linear-gradient(160deg,#C7643B 0%,#EFAE78 55%,#4A3A2C 140%)'],
  ['linear-gradient(160deg,#A84E2A 0%,#E3915A 55%,#3E352B 140%)', 'linear-gradient(160deg,#A84E2A 0%,#E3915A 55%,#3E352B 140%)'],
  ['linear-gradient(160deg,#B9532C 0%,#F0B877 55%,#4A3A2C 140%)', 'linear-gradient(160deg,#B9532C 0%,#F0B877 55%,#4A3A2C 140%)'],
  ['linear-gradient(160deg,#C05A32 0%,#E89A5E 55%,#4A3A2C 140%)', 'linear-gradient(160deg,#C05A32 0%,#E89A5E 55%,#4A3A2C 140%)'],
  ['linear-gradient(160deg,#B0532B 0%,#DD8950 55%,#3E352B 140%)', 'linear-gradient(160deg,#B0532B 0%,#DD8950 55%,#3E352B 140%)'],
  ['linear-gradient(160deg,#C65E36 0%,#EFAA75 55%,#4A3A2C 140%)', 'linear-gradient(160deg,#C65E36 0%,#EFAA75 55%,#4A3A2C 140%)'],
  ['linear-gradient(160deg,#A94F29 0%,#E08A4F 55%,#3E352B 140%)', 'linear-gradient(160deg,#A94F29 0%,#E08A4F 55%,#3E352B 140%)']
];

// ---- Phase 2: remaining accent / tint hexes ----
const HEX = [
  ['#CD5D33', '#CD5D33'],   // accent (indigo -> rust)
  ['#D9744A', '#D9744A'],   // accent-hover / mid
  ['#F0A66E', '#F0A66E'],   // purple -> light amber-orange
  ['#A64B27', '#A64B27'],   // accent-dark
  ['#4A3A2C', '#4A3A2C'],   // deep navy end -> warm dark brown
  ['#4A3A2C', '#4A3A2C'],   // deep indigo fallback
  ['#f4e2d3', '#f4e2d3'],   // light indigo tint
  ['#f7e3d3', '#f7e3d3'],   // light violet tint
  ['#f9ece2', '#f9ece2'],   // indigo soft tint
  ['#eccfb8', '#eccfb8'],   // indigo border tint
  ['#f5e8df', '#f5e8df']    // soft indigo bg
];

// ---- Phase 3: rgba tokens (glows, borders, shadows) ----
const RGBA = [
  [/rgba\(\s*79,\s*70,\s*229,\s*([0-9.]+)\s*\)/gi, (m, a) => `rgba(205,93,51,${a})`],
  [/rgba\(\s*99,\s*102,\s*241,\s*([0-9.]+)\s*\)/gi, (m, a) => `rgba(217,116,74,${a})`],
  [/rgba\(\s*15,\s*23,\s*42,\s*([0-9.]+)\s*\)/gi, (m, a) => `rgba(74,60,50,${a})`]
];

function recolor(content) {
  let out = content;
  for (const [from, to] of GRADIENTS) {
    if (out.includes(from)) out = out.split(from).join(to);
  }
  for (const [from, to] of HEX) {
    // case-insensitive bare hex swap
    out = out.replace(new RegExp(from, 'gi'), to);
  }
  for (const [re, rep] of RGBA) out = out.replace(re, rep);
  return out;
}

const EXTS = new Set(['.html', '.css', '.js']);
let files = 0, bytes = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      walk(abs);
    } else if (EXTS.has(path.extname(e.name).toLowerCase())) {
      const orig = fs.readFileSync(abs, 'utf8');
      const next = recolor(orig);
      if (next !== orig) {
        fs.writeFileSync(abs, next);
        files++;
        bytes += orig.length - next.length;
      }
    }
  }
}

console.log('Recoloring site to khudkibook logo palette (rust #CD5D33 / amber #F8C885 / brown #75432B)...');
for (const base of ['public', 'scripts']) {
  walk(path.join(ROOT, base));
}
console.log(`Updated ${files} file(s), removed ${bytes} bytes.`);
console.log('Done.');