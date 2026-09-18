## 5.2. Standard Formulae of Limit and Related Simple Examples

### 5.2.1. Introduction to Standard Formulae of Limit
The standard formulae of limit are essential for solving complex limit problems efficiently. These formulae are derived from fundamental principles and are used to simplify the evaluation of limits. Understanding and applying these formulae will enhance your problem-solving skills.

**Definition:** A **limit** is the value that a function or sequence approaches as the input or index approaches some value. The concept of limit is crucial in calculus and mathematical analysis.

### 5.2.2. Standard Formulae for Limits
Below are some standard formulae of limits that are frequently used:

- **Formula for the limit of a polynomial function:**
  [
  \lim_{x \to a} (P(x)) = P(a)
  ]
  where P(x) is a polynomial function.

- **Formula for the limit of a rational function:**
  [
  \lim_{x \to a} \left(\frac{P(x)}{Q(x)}\right) = \frac{P(a)}{Q(a)}, \quad \text{if } Q(a) \neq 0
  ]

- **Formula for the limit of a trigonometric function:**
  [
  \lim_{x \to 0} \left(\frac{\sin x}{x}\right) = 1
  ]

- **Formula for the limit of the exponential function:**
  [
  \lim_{x \to 0} \left(\frac{e^x - 1}{x}\right) = 1
  ]

- **Formula for the limit of the logarithmic function:**
  [
  \lim_{x \to 0^+} \left(x \ln x\right) = 0
  ]

### 5.2.3. Application of Standard Formulae
To solve problems using these standard formulae, it is crucial to recognize the type of function involved and apply the appropriate formula. Here is a worked example to illustrate the application of these formulae.

> **Example:** 
> Given the function f(x) = x² - 4 x - 2, find → ₂ f(x).

**Solution:**
First, we simplify the function:
[
f(x) = \frac{x^2 - 4}{x - 2} = \frac{(x - 2)(x + 2)}{x - 2} = x + 2 \quad \text{for } x \neq 2
]
Now, we can find the limit:
[
\lim_{x \to 2} f(x) = \lim_{x \to 2} (x + 2) = 2 + 2 = 4
]

### 5.2.4. Advanced Application of Limit Formulae
To further enhance your understanding and application, consider the following problem:

> **Example:** 
> Evaluate → ₀ ( 3x x ).

**Solution:**
Using the standard formula for the limit of a trigonometric function:
[
\lim_{x \to 0} \left(\frac{\sin 3x}{x}\right) = \lim_{x \to 0} \left(3 \cdot \frac{\sin 3x}{3x}\right) = 3 \cdot \lim_{x \to 0} \left(\frac{\sin 3x}{3x}\right) = 3 \cdot 1 = 3
]

### 5.2.5. Flowchart for Standard Formulae Application
To visualize the process of applying standard formulae, consider the following flowchart:

```mermaid
flowchart TD
    A[Identify the type of function] --> B[Polynomial Function]
    B --> C[Use \lim_{x \to a} P(x) = P(a)]
    A --> D[Rational Function]
    D --> E[Use \lim_{x \to a} (P(x)/Q(x)) = P(a)/Q(a)]
    A --> F[Trigonometric Function]
    F --> G[Use \lim_{x \to 0} (sin x / x) = 1]
    A --> H[Exponential Function]
    H --> I[Use \lim_{x \to 0} ((e^x - 1) / x) = 1]
    A --> J[Logarithmic Function]
    J --> K[Use \lim_{x \to 0^+} (x ln x) = 0]
```

This flowchart helps in quickly identifying the appropriate standard formula for the given function type.

### 5.2.6. Summary
In this section, we have covered the standard formulae of limits and their application in solving problems. By recognizing the type of function and applying the correct formula, you can efficiently find limits. Practice these formulae and their applications to ensure a strong foundation in limit evaluation.

## Conclusion
Mastering the standard formulae of limit and their application is crucial for solving complex problems in calculus. Regular practice and understanding the flowchart will help in quick and accurate problem-solving.