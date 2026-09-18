## 5.1. Limit of a Function.

### Definition and Concept
The **limit** of a function is a fundamental concept in calculus. It is the value that a function approaches as the input (or variable) approaches a certain value. This concept is crucial for understanding continuity, derivatives, and integrals. Formally, the limit of a function f(x) as x approaches a is denoted as:

[ \lim_{x \to a} f(x) = L ]

where L is the value that f(x) gets arbitrarily close to as x gets closer to a.

### Types of Limits
Limits can be classified into different types based on the behavior of the function as x approaches a. These include:

- **One-sided limits**: These are limits where x approaches a from the left (x → a⁻) or the right (x → a⁺).
- **Two-sided limits**: These are limits where x approaches a from both the left and the right.

### Finding Limits
To find the limit of a function, we can use several methods:

1. **Direct Substitution**: If the function is continuous at x = a, we can simply substitute a into the function.
2. **Factoring**: For rational functions, we can factor the numerator and denominator to simplify the expression.
3. **Rationalization**: For functions involving square roots, rationalization can help eliminate the square root in the denominator.
4. **Squeeze Theorem**: For functions that are difficult to evaluate directly, we can use the Squeeze Theorem to find the limit.

### Example
> **Example:** Find the limit of the function f(x) = x² - 4 x - 2 as x approaches 2.

To solve this, we first try direct substitution:

[ \lim_{x \to 2} \frac{x^2 - 4}{x - 2} = \frac{2^2 - 4}{2 - 2} = \frac{0}{0} ]

This results in an indeterminate form. Next, we factor the numerator:

[ \lim_{x \to 2} \frac{(x - 2)(x + 2)}{x - 2} = \lim_{x \to 2} (x + 2) ]

Now, we can substitute x = 2:

[ \lim_{x \to 2} (x + 2) = 2 + 2 = 4 ]

Thus, the limit of the function as x approaches 2 is:

[ \boxed{4} ]