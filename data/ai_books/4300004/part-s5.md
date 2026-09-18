## 3.3.5. Stokes’ Law

Stokes' law is a fundamental principle in fluid dynamics that describes the drag force exerted on small spherical particles moving through a fluid. It is widely used in various applications, including sedimentation, filtration, and the behavior of microorganisms in fluids.

### 3.3.5.1. Statement of Stokes' Law

Stokes' law states that the drag force F on a small spherical particle moving through a fluid is given by:

[ F = 6 \pi \eta r v ]

where:
- F is the drag force (in N),
-  is the dynamic viscosity of the fluid (in Pa·s or N·s/m²),
- r is the radius of the spherical particle (in m),
- v is the velocity of the particle relative to the fluid (in m/s).

### 3.3.5.2. Derivation and Application

Stokes' law is derived from Newton's second law of motion and the principles of fluid mechanics. It is applicable when the Reynolds number Re is less than 1, indicating that the flow is laminar and the particle is small relative to the fluid's inertia.

### 3.3.5.3. Example

> **Example:** A spherical particle with a radius of 0.002 m is falling through water with a dynamic viscosity of 0.001 Pa·s. If the particle is moving at a velocity of 0.01 m/s, calculate the drag force.

Solution:

Given:
- r = 0.002 m,
- = 0.001 Pa·s,
- v = 0.01 m/s.

Using Stokes' law:

[ F = 6 \pi \eta r v ]

Substitute the given values:

[ F = 6 \pi \times 0.001 \times 0.002 \times 0.01 ]

[ F = 6 \pi \times 2 \times 10^{-8} ]

[ F = 3.77 \times 10^{-7} \, \text{N} ]

### 3.3.6. Effect of Temperature on Viscosity

The viscosity of a fluid changes with temperature, and this relationship is crucial in many engineering applications. Generally, the viscosity of liquids decreases with an increase in temperature, while the viscosity of gases increases with an increase in temperature.

### 3.3.6.1. Viscosity-Temperature Relationship

The relationship between viscosity  and temperature T can be expressed as:

[ \eta(T) = \eta_0 \left( \frac{T}{T_0} \right)^n ]

where:
- (T) is the viscosity at temperature T,
- ₀ is the viscosity at a reference temperature T₀,
- n is a constant that depends on the fluid and the reference temperature.

For liquids, n is typically between 0.5 and 1. For gases, n is close to 1.

### 3.3.6.2. Example

> **Example:** The viscosity of water at 25°C is 0.001 Pa·s. Determine the viscosity of water at 50°C if the temperature exponent n is 0.7.

Solution:

Given:
- ₀ = 0.001 Pa·s at T₀ = 25°C,
- T = 50°C,
- n = 0.7.

Using the viscosity-temperature relationship:

[ \eta(T) = \eta_0 \left( \frac{T}{T_0} \right)^n ]

Substitute the given values:

[ \eta(50) = 0.001 \left( \frac{50}{25} \right)^{0.7} ]

[ \eta(50) = 0.001 \left( 2 \right)^{0.7} ]

[ \eta(50) = 0.001 \times 1.627 ]

[ \eta(50) = 0.001627 \, \text{Pa·s} ]

### 3.3.7. Applications of Viscosity in Hydraulic Systems

Viscosity plays a critical role in the design and operation of hydraulic systems, which are used in a wide range of applications, including pumps, valves, and actuators.

### 3.3.7.1. Fluid Power Transmission

In hydraulic systems, the fluid is used to transmit power. The viscosity of the fluid affects the efficiency and performance of the system. Higher viscosity fluids can lead to increased friction and reduced flow rates, while lower viscosity fluids can reduce the system's ability to transmit power effectively.

### 3.3.7.2. Lubrication

Viscosity is crucial for lubricating moving parts in hydraulic systems. The correct viscosity ensures that the lubricant can form a film between moving surfaces, reducing wear and friction. Viscosity can be adjusted by adding or removing lubricant, or by using fluids with different viscosities.

### 3.3.7.3. Example

> **Example:** A hydraulic pump is designed to operate with a fluid viscosity of 0.0008 Pa·s. If the operating temperature increases, causing the viscosity to decrease to 0.0006 Pa·s, determine the new pump efficiency.

Solution:

Given:
- Original viscosity ₁ = 0.0008 Pa·s,
- New viscosity ₂ = 0.0006 Pa·s.

Assuming the efficiency E is inversely proportional to the viscosity:

[ E \propto \frac{1}{\eta} ]

If the original efficiency is E₁:

[ E_1 = k \times \frac{1}{0.0008} ]

For the new efficiency E₂:

[ E_2 = k \times \frac{1}{0.0006} ]

The ratio of the efficiencies is:

[ \frac{E_2}{E_1} = \frac{\frac{k}{0.0006}}{\frac{k}{0.0008}} = \frac{0.0008}{0.0006} = \frac{4}{3} ]

Thus, the new efficiency E₂ is:

[ E_2 = \frac{4}{3} E_1 ]

If the original efficiency E₁ is 80%, the new efficiency E₂ is:

[ E_2 = \frac{4}{3} \times 80\% = 106.67\% ]

However, since efficiency cannot exceed 100%, the new efficiency is effectively 100%.

In summary, the viscosity of a fluid is crucial for understanding and optimizing the performance of hydraulic systems. By understanding the relationship between viscosity and temperature, and applying Stokes' law, engineers can design and operate these systems more effectively.