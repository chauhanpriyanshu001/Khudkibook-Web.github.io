# Unit – V: Limit

*(AI-generated self-study book for GTU, subject code C4300001 — generated locally with Ollama.)*

This module carries approximately **12 marks (3 Remember + 4 Understand + 5 Apply) (per syllabus)**.

Learning objectives covered by this module:
- 5.a. Analyse the characteristic of functions using the concept of Limit.
- 5.b. Solve the given problems using standard formulae of Limit

## 5.1. Limit of a Function

### Definition and Concept of Limit
**Limit of a function** is a fundamental concept in calculus that describes the value that a function approaches as the input approaches some value. Formally, the limit of a function f(x) as x approaches a is denoted as:
[ \lim_{x \to a} f(x) = L ]
where L is the limit. This means that as x gets arbitrarily close to a, the value of f(x) gets arbitrarily close to L.

### Importance of Limits
Understanding limits is crucial because they help in defining derivatives and integrals, which are core concepts in calculus. Limits are also used to solve indeterminate forms, such as 0 0 and , and to analyze the behavior of functions at specific points.

### Types of Limits
- **One-Sided Limits:** These are limits where x approaches a from the left (x → a⁻) or from the right (x → a⁺).
- **Two-Sided Limits:** These are limits where x approaches a from both sides.

### Properties of Limits
1. **Constant Rule:** If c is a constant, then
[ \lim_{x \to a} c = c ]
2. **Identity Rule:** If f(x) = x, then
[ \lim_{x \to a} x = a ]
3. **Sum Rule:** If f(x) and g(x) are functions, then
[ \lim_{x \to a} [f(x) + g(x)] = \lim_{x \to a} f(x) + \lim_{x \to a} g(x) ]
4. **Difference Rule:** If f(x) and g(x) are functions, then
[ \lim_{x \to a} [f(x) - g(x)] = \lim_{x \to a} f(x) - \lim_{x \to a} g(x) ]
5. **Product Rule:** If f(x) and g(x) are functions, then
[ \lim_{x \to a} [f(x) \cdot g(x)] = \left( \lim_{x \to a} f(x) \right) \left( \lim_{x \to a} g(x) \right) ]
6. **Quotient Rule:** If f(x) and g(x) are functions and g(x) ≠ 0, then
[ \lim_{x \to a} \left[ \frac{f(x)}{g(x)} \right] = \frac{\lim_{x \to a} f(x)}{\lim_{x \to a} g(x)} ]

### Evaluating Limits
- **Substitution Rule:** If f(x) is a polynomial or a rational function and f(a) is defined, then
[ \lim_{x \to a} f(x) = f(a) ]
- **Factorization and Simplification:** If direct substitution leads to an indeterminate form, factorize or simplify the expression.
- **Rationalization:** For limits involving square roots, rationalize the numerator or denominator.

### Example
> **Example:** Evaluate the limit:
[ \lim_{x \to 2} (x^2 - 3x + 2) ]

1. **Step 1:** Direct substitution:
[ \lim_{x \to 2} (x^2 - 3x + 2) = 2^2 - 3(2) + 2 = 4 - 6 + 2 = 0 ]

Therefore, the limit is:
[ \lim_{x \to 2} (x^2 - 3x + 2) = 0 ]

### Flowchart of Evaluating Limits
```mermaid
flowchart TD
    A[Is the function a polynomial or rational?]
    B[Direct substitution]
    C[Factorization or simplification]
    D[Rationalization]
    E[Indeterminate form?]
    F[Substitution]
    G[Substitution is possible?]
    H[Final value]
    A --> B
    A --> C
    A --> D
    B --> F
    C --> F
    D --> E
    E --> F
    F --> G
    G --> H
    E --> D
    D --> G
    G --> H
```

This flowchart helps in systematically evaluating limits by considering different scenarios and methods.

---

## 5.2. Standard Formulae of Limit and Related Simple Examples

### 5.2.1. Definition of Limit
**Limit:** The limit of a function f(x) as x approaches a value a is the value L such that the values of f(x) get arbitrarily close to L as x gets closer to a.

### 5.2.2. Standard Formulae for Limits

#### 5.2.2.1. Limit of a Constant
**Definition:** If c is a constant, then → a c = c.

**Example:**
> **Example:** Find → ₃ 5.
> 
> Solution: Since 5 is a constant, the limit as x approaches 3 is simply 5.
> [
> \lim_{x \to 3} 5 = 5
> ]

#### 5.2.2.2. Limit of a Linear Function
**Definition:** If f(x) = ax + b, then → a (ax + b) = a · a + b = aa + b.

**Example:**
> **Example:** Find → ₂ (3x - 1).
> 
> Solution: Substitute x = 2 into the expression 3x - 1:
> [
> \lim_{x \to 2} (3x - 1) = 3 \cdot 2 - 1 = 6 - 1 = 5
> ]

#### 5.2.2.3. Limit of a Polynomial Function
**Definition:** If f(x) = aₙ xⁿ + aₙ₋₁ xⁿ⁻¹ + + a₁ x + a₀, then → a f(x) = aₙ aⁿ + aₙ₋₁ aⁿ⁻¹ + + a₁ a + a₀.

**Example:**
> **Example:** Find → ₁ (2x² - 3x + 4).
> 
> Solution: Substitute x = 1 into the polynomial:
> [
> \lim_{x \to 1} (2x^2 - 3x + 4) = 2(1)^2 - 3(1) + 4 = 2 - 3 + 4 = 3
> ]

#### 5.2.2.4. Limit of a Rational Function
**Definition:** If f(x) = p(x) q(x) and q(a) ≠ 0, then → a p(x) q(x) = p(a) q(a).

**Example:**
> **Example:** Find → ₂ x² - 4 x - 2.
> 
> Solution: First, factor the numerator:
> [
> \lim_{x \to 2} \frac{x^2 - 4}{x - 2} = \lim_{x \to 2} \frac{(x - 2)(x + 2)}{x - 2}
> ]
> Simplify by canceling x - 2:
> [
> \lim_{x \to 2} (x + 2) = 2 + 2 = 4
> ]

### 5.2.3. Application of Limit Formulae

#### 5.2.3.1. Real-World Application
Suppose a chemical reaction has a rate of change given by R(x) = 100 x - 20 where x is time in seconds. Find the rate of change at x = 5 seconds.

**Solution:**
[
R(x) = \frac{100}{x} - 20
]
To find the rate of change at x = 5:
[
R(5) = \frac{100}{5} - 20 = 20 - 20 = 0
]
Thus, the rate of change at x = 5 seconds is 0.

### 5.2.4. Practice Problems

1. Find → ₄ (2x² - 3x + 1).
2. Evaluate → ₋₁ x² - 1 x + 1.
3. Determine → ₂ 3x² - 5x + 2 x - 2.

By solving these problems, students can apply the standard formulae of limits effectively and understand the practical implications of these concepts in engineering contexts.
