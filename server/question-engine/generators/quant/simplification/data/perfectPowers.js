// generators/quant/simplification/data/perfectPowers.js

export const PERFECT_SQUARES = Object.fromEntries(
  Array.from({ length: 120 }, (_, i) => [i + 1, (i + 1) * (i + 1)])
);

export const PERFECT_CUBES = Object.fromEntries(
  Array.from({ length: 35 }, (_, i) => [i + 1, (i + 1) * (i + 1) * (i + 1)])
);

export function getSquare(n) {
  return PERFECT_SQUARES[n] ?? n * n;
}

export function getCube(n) {
  return PERFECT_CUBES[n] ?? n * n * n;
}
