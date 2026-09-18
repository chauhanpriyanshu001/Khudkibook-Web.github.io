const assert = require('assert');
const { cleanLatexMath } = require('./tex_fix');
const { repairSource, validateMermaid } = require('./mermaid_fix');

const formula = cleanLatexMath(String.raw`\mathbf{A} \times \mathbf{B} = \begin{vmatrix} \mathbf{i} & \mathbf{j} \\ 3 & 4 \end{vmatrix}; Z\*; \-1; \frac{a}{b}`);
assert(!/\\(?:text|mathbf|mathrm|frac|begin|end)|\\-[0-9]/.test(formula), `raw LaTeX leaked: ${formula}`);
assert(formula.includes('×') && formula.includes('[ i j ; 3 4 ]') && formula.includes('-1'), formula);

const diagram = repairSource('flowchart TD\n  A[Input / Output (I/O)] --> B[Result: 100%]');
assert(validateMermaid(diagram).ok, `diagram still invalid: ${diagram}`);
assert(diagram.includes('["Input / Output (I/O)"]'));

console.log('quality tests passed');
