// core/mathUtils.js

export const randInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const pickRandom = (arr) =>
  arr[Math.floor(Math.random() * arr.length)];

export const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
};

export const lcm = (a, b) => (a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b));

/**
 * Exact Fraction Arithmetic to eliminate JS floating-point bugs
 */
export class Fraction {
  constructor(num, den = 1) {
    if (den === 0) throw new Error("Denominator cannot be zero");
    if (den < 0) {
      num = -num;
      den = -den;
    }
    const common = gcd(num, den);
    this.num = num / common;
    this.den = den / common;
  }

  add(other) {
    return new Fraction(
      this.num * other.den + other.num * this.den,
      this.den * other.den
    );
  }

  sub(other) {
    return new Fraction(
      this.num * other.den - other.num * this.den,
      this.den * other.den
    );
  }

  mul(other) {
    return new Fraction(this.num * other.num, this.den * other.den);
  }

  div(other) {
    if (other.num === 0) throw new Error("Division by zero");
    return new Fraction(this.num * other.den, this.den * other.num);
  }

  isInteger() {
    return this.den === 1;
  }

  toNumber() {
    return this.num / this.den;
  }

  /**
   * Formats as integer ("14"), proper fraction ("3/4"), or mixed fraction ("4 2/3")
   */
  toExamString() {
    if (this.den === 1) return `${this.num}`;
    const whole = Math.trunc(this.num / this.den);
    const rem = Math.abs(this.num % this.den);
    if (whole === 0) return `${this.num}/${this.den}`;
    return `${whole} ${rem}/${this.den}`;
  }
}