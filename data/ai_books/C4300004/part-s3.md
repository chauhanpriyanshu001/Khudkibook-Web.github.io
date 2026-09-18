## 5.5. Superposition of Waves, Interference: Constructive and Destructive Interference, Conditions for Stationary Interference Pattern, Beat Formation

### 5.5.1. Superposition of Waves
When two or more waves travel in the same medium, they overlap and combine to produce a resultant wave. This phenomenon is known as the **superposition of waves**. The principle of superposition states that the resultant displacement of a medium at any point is the vector sum of the displacements caused by the individual waves.

#### **Example:**
Consider two waves, y₁ = 3 (2π t - π x) and y₂ = 2 (2π t - π x - π 2 ), where t is time and x is the position. The resultant wave is given by:
[ y = y_1 + y_2 ]
[ y = 3 \sin (2\pi t - \pi x) + 2 \sin \left(2\pi t - \pi x - \frac{\pi}{2}\right) ]

Using the trigonometric identity (θ + π 2 ) = (θ), we can rewrite the second term:
[ y = 3 \sin (2\pi t - \pi x) + 2 \cos (2\pi t - \pi x) ]

Using the principle of superposition, we can combine these terms to find the resultant wave.

### 5.5.2. Interference: Constructive and Destructive Interference
Interference is the phenomenon that occurs when two or more waves overlap in a medium. It can be constructive or destructive based on the phase difference between the waves.

- **Constructive Interference:** This occurs when the waves reinforce each other, leading to an increase in the amplitude of the resultant wave. This happens when the phase difference between the waves is an integer multiple of 2π.

- **Destructive Interference:** This occurs when the waves cancel each other out, leading to a decrease in the amplitude of the resultant wave. This happens when the phase difference between the waves is an odd multiple of π.

#### **Example:**
Two waves traveling in the same direction with amplitudes A₁ and A₂ and a phase difference φ can be represented as:
[ y_1 = A_1 \sin (kx - \omega t) ]
[ y_2 = A_2 \sin (kx - \omega t + \phi) ]

The resultant wave is:
[ y = y_1 + y_2 = A_1 \sin (kx - \omega t) + A_2 \sin (kx - \omega t + \phi) ]

Using the trigonometric identity for the sum of sines:
[ y = A_1 \sin (kx - \omega t) + A_2 \sin (kx - \omega t + \phi) ]
[ y = A_1 \sin (kx - \omega t) + A_2 \left[ \sin (kx - \omega t) \cos \phi + \cos (kx - \omega t) \sin \phi \right] ]
[ y = (A_1 + A_2 \cos \phi) \sin (kx - \omega t) + A_2 \sin \phi \cos (kx - \omega t) ]

The amplitude of the resultant wave is given by:
[ A_{\text{resultant}} = \sqrt{(A_1 + A_2 \cos \phi)^2 + (A_2 \sin \phi)^2} ]

#### Conditions for Stationary Interference Pattern:
- **Constructive Interference:** φ = 2nπ, where n is an integer.
- **Destructive Interference:** φ = (2n+1)π, where n is an integer.

### 5.5.3. Beat Formation
When two waves of slightly different frequencies overlap, they produce a periodic variation in the amplitude of the resultant wave. This phenomenon is called **beats**.

- **Example:**
Consider two waves with frequencies f₁ and f₂ and amplitudes A₁ and A₂. The resultant wave is:
[ y = A_1 \sin (2\pi f_1 t) + A_2 \sin (2\pi f_2 t) ]

Using the trigonometric identity for the sum of sines:
[ y = 2A_1 A_2 \sin \left( \frac{2\pi (f_1 - f_2) t}{2} \right) \cos \left( \frac{2\pi (f_1 + f_2) t}{2} \right) ]

The beat frequency is given by:
[ f_{\text{beat}} = |f_1 - f_2| ]

### 5.5.4. Example
> **Example:** Two sound waves of frequencies 440 Hz and 445 Hz travel in the same medium. Calculate the beat frequency and the time period of the beats.
- **Solution:**
The beat frequency is:
[ f_{\text{beat}} = |440 - 445| = 5 \text{ Hz} ]
The time period of the beats is:
[ T_{\text{beat}} = \frac{1}{f_{\text{beat}}} = \frac{1}{5} = 0.2 \text{ s} ]

## 5.6. Reverberation, Reverberation Time, Echo, Noise and Coefficient of Absorption of Sound

### 5.6.1. Reverberation
Reverberation is the persistence of sound in a room after the original sound has ceased. It is caused by the multiple reflections of sound waves off the surfaces of the room.

#### **Example:**
Consider a room with a volume of 1000 m³. The sound intensity level at a distance of 1 m from the source is 80 dB. Calculate the reverberation time if the total absorption area of the room is 200 m².
- **Solution:**
The sound absorption area per unit volume is:
[ \alpha = \frac{200 \text{ m}^2}{1000 \text{ m}^3} = 0.2 \text{ m}^{-2} ]

The reverberation time T is given by:
[ T = \frac{0.161 \times V}{A \times S} ]
where V is the volume of the room, A is the total absorption area, and S is the speed of sound in air (343 m/s).

[ T = \frac{0.161 \times 1000}{0.2 \times 343} \approx 2.4 \text{ s} ]

### 5.6.2. Reverberation Time
Reverberation time is the time it takes for the sound level in a room to decay by 60 dB after the source has stopped. It is a measure of how long the sound persists in a room.

- **Formula:**
[ T = \frac{0.161 \times V}{A \times S} ]
where V is the volume of the room, A is the total absorption area, and S is the speed of sound in air.

#### **Example:**
A lecture hall has a volume of 5000 m³ and a total absorption area of 1000 m². Calculate the reverberation time.
- **Solution:**
[ T = \frac{0.161 \times 5000}{1000 \times 343} \approx 0.24 \text{ s} ]

### 5.6.3. Echo
An echo is the reflection of sound from a distant surface. It is a discrete, distinguishable repetition of the original sound.

- **Example:**
If the speed of sound in air is 343 m/s and the distance between the source and the reflecting surface is 171.5 m, calculate the time interval for the echo to be heard.
- **Solution:**
The time interval for the echo is:
[ t = \frac{2 \times 171.5 \text{ m}}{343 \text{ m/s}} = 1 \text{ s} ]

### 5.6.4. Noise
Noise is unwanted sound that can interfere with communication and cause discomfort.

- **Example:**
Calculate the sound intensity level of a noise source with an intensity of 10⁻⁶ W/m².
- **Solution:**
The sound intensity level L_I is given by:
[ L_I = 10 \log \left( \frac{I}{10^{-12}} \right) ]
[ L_I = 10 \log \left( \frac{10^{-6}}{10^{-12}} \right) = 10 \log (10^6) = 60 \text{ dB} ]

### 5.6.5. Coefficient of Absorption of Sound
The coefficient of absorption α is a measure of the fraction of sound energy absorbed by a material per unit area.

- **Example:**
A material has a coefficient of absorption of 0.3. Calculate the sound energy absorbed by 2 m² of this material.
- **Solution:**
The sound energy absorbed is:
[ E_{\text{absorbed}} = \alpha \times A \times I ]
where A is the area and I is the sound intensity.

Assume the sound intensity I = 10⁻⁶ W/m²:
[ E_{\text{absorbed}} = 0.3 \times 2 \text{ m}^2 \times 10^{-6} \text{ W/m}^2 = 6 \times 10^{-7} \text{ W} ]

### 5.6.6. Example
> **Example:** A room has a total absorption area of 150 m². Calculate the reverberation time if the sound intensity in the room is 10⁻⁶ W/m².
- **Solution:**
The reverberation time T is given by:
[ T = \frac{0.161 \times V}{A \times S} ]
Assuming the volume of the room is 1500 m³ and the speed of sound S = 343 m/s:
[ T = \frac{0.161 \times 1500}{150 \times 343} \approx 0.24 \text{ s} ]