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