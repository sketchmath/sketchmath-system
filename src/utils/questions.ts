export const questions: Record<string, string> = {
  q0: "Find the derivative of the function f(x) = x³ - 3x² + 4x - 5.",
  q1: "A cylindrical can is to be made to hold 1 L of oil. Find the dimensions that will minimize the cost of the metal to manufacture the can.",
  q2: "Find the area of the largest rectangle that can be inscribed in a semicircle of radius r.",
};

export const questionsBaseline: Record<string, string> = {
  q0: "Find the derivative of the function f(x) = 2x³ - sin(x) + 3x - 2.",
  q1: "A water tank has the shape of an inverted circular cone with base radius 2 m and height 4 m. If water is being pumped into the tank at a rate of 2 m³/min, find the rate at which the water level is rising when the water is 3 m deep.",
  q2: "A ladder 10 ft long rests against a vertical wall. If the bottom of the ladder slides away from the wall at a rate of 1 ft/s, how fast is the top of the ladder sliding down the wall when the bottom of the ladder is 6 ft from the wall?",
};

export const solutions: Record<string, string> = {
  q0: `
    The derivative of the function f(x) = x³ - 3x² + 4x - 5 is found using the power rule.
    The derivative f'(x) is given by:
    f'(x) = 3x² - 6x + 4.
  `,
  q1: `
  The surface area of a cylinder is given by the formula A = 2πr² + 2πrh, where r is the radius and h is the height.
  To eliminate h we use the fact that the volume is given as 1 L, which we take to be 1000 cm³.
  The volume of a cylinder is given by V = πr²h.
  Thus, πr²h = 1000, which gives h = 1000/(πr²).
  Substitution of this into the expression for A gives A = 2πr² + 2πr(1000/(πr²)) = 2πr² + 2000/r.
  Therefore the function that we want to minimize is A(r) = 2πr² + 2000/r where r > 0.
  To find the critical numbers, we differentiate: A'(r) = 4πr - 2000/r² = (4(πr³ - 500))/r².
  Then A'(r) = 0 when πr³ = 500, so the only critical number is r = (500/π)^(1/3).
  The value of h corresponding to r = 1000/(πr²) = 1000/(π(500/π)^(2/3)) = 2(500/π)^(1/3) = 2r.
  Thus, to minimize the cost of the can, the radius should be (500/π)^(1/3) cm and the height should be 2r cm, the diameter of the cylinder.
`,
  q2: `
  Let's take the circle to be the upper half of the circle x² + y² = r² with center at the origin.
  The word inscribed means that the rectangle has two vertices on the semicircle and two vertices on the x-axis.
  Let (x, y) be the vertex that lies in the first quadrant. Then the rectangle has sides of lenghts 2x and y, so its area is A = 2xy.
  To eliminate y we use the fact that (x, y) lies on the circle x² + y² = r², so y = (r² - x²)^(1/2).
  Thus, A = 2x(r² - x²)^(1/2).
  The domain of this function is 0 <= x <= r.
  Its derivative is A' = 2(r² - x²)^(1/2) - (2x²)/(r² - x²)^(1/2) = (2(r² - 2x²)/(r² - x²)^(1/2) which is 0 when 2x² = r², or x = r/√2 (since x >= 0).
  This value of x gives a maximum value of A since A(0) = 0 and A(r) = 0.
  Therefore the area of the largest inscribed rectangle is A(r/√2) = 2(r/√2)(r² - (r²/2))^(1/2) = r².
`,
};

export const solutionsBaseline: Record<string, string> = {
  q0: `
    The derivative of the function f(x) = 2x³ - sin(x) + 3x - 2 is found using the power rule and the derivative of sine.
    The derivative f'(x) is given by:
    f'(x) = 6x² - cos(x) + 3.
  `,
  q1: `
We are given that dV/dt = 2 m³/min and we are asked to find dh/dt when h is 3 m.
The quantities V and h are related by the equation V = (1/3)πr²h but it is very useful to express V as a function of h alone.
In order to eliminate r, we use the similar triangles to write r/h = 2/4, or r = h/2 and the expression for V becomes V = (1/3)π(h/2)²h = (π/12)h³.
Now we can differentiate both sides of this equation with respect to t:
dV/dt = (π/4)h²(dh/dt), so dh/dt = (4/πh²) * (dV/dt).
Substituting h = 3 m and dV/dt = 2 m³/min, we get dh/dt = (4/π(3)²) * 2 = 8/(9π) m/min, which is approximately 0.28 m/min.
`,
  q2: `
Let x feet be the distance from the bottom of the ladder to the wall and y feet the distance from the top of the ladder to the ground.
Note that x and y are both functions of t (time, measured in seconds).
We are given that dx/dt = 1 ft/s and we are asked to find dy/dt and when x = 6 ft. In this problem, the relationship between x and y is given by the Pythagorean Theorem: x² + y² = 100
Differentiating each side with respect to t using the Chain Rule, we have 2x(dx/dt) + 2y(dy/dt) = 0 and solving this equation for the desired rate, we obtain dy/dt = -(x/y)(dx/dt).
When x = 6, the Pythagorean Theorem gives y = 8 and so, substituting these values and dx/dt = 1, we have dy/dt = -(6/8)(1) = -(3/4) ft/s.
The fact that dy/dt is negative means that the distance from the top of the ladder to the ground is decreasing at a rate of 3/4 ft/s.
In other words, the top of the ladder is sliding down the wall at a rate of 3/4 ft/s.
`,
};
