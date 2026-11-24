// config/difficultyProfiles.js
export const SIMPLIFICATION_PROFILES = {
  EASY: {
    distractorOffsets: [-15, -10, -5, -2, 2, 5, 10, 15],
    vbodmas: { divisorRange: [5, 15], quotientRange: [8, 25], multiplierRange: [2, 9], useVinculum: false },
    percentFraction: { termCount: 2, allowedTiers: ["EASY"], multiplierRange: [10, 60] },
    mixedFractions: { termCount: 2, wholeRange: [2, 8], denominators: [2, 3, 4, 5, 6] },
    squaresCubesRoots: { sqRootRange: [11, 25], cubeRootRange: [4, 10], allowSquaredRhs: false },
    surdsIndices: { bases: [2, 3, 5], exponentMode: "INTEGER" },
    decimals: { termCount: 3, decimalPlaces: 2, maxDigit: 6 },
    algebraicIdentities: { pattern: "DIFF_OF_SQUARES", rangeA: [40, 90], rangeB: [10, 35] },
    ladderFractions: { steps: 2, maxWhole: 3, maxDen: 5 },
    unitDigitSum: { termCount: 3, minVal: 1000, maxVal: 4999, distinctUnitDigits: true },
  },

  MEDIUM: {
    distractorOffsets: [-10, -5, -3, -2, -1, 1, 2, 3, 5, 10],
    vbodmas: { divisorRange: [12, 35], quotientRange: [15, 45], multiplierRange: [4, 16], useVinculum: true },
    percentFraction: { termCount: 3, allowedTiers: ["EASY", "MEDIUM"], multiplierRange: [25, 150] },
    mixedFractions: { termCount: 3, wholeRange: [3, 14], denominators: [3, 4, 6, 8, 9, 12] },
    squaresCubesRoots: { sqRootRange: [22, 55], cubeRootRange: [8, 18], allowSquaredRhs: true },
    surdsIndices: { bases: [2, 3, 5, 6, 7], exponentMode: "DECIMAL" },
    decimals: { termCount: 4, decimalPlaces: 3, maxDigit: 8 },
    algebraicIdentities: { pattern: "SUM_OF_CUBES", rangeA: [200, 750], rangeB: [100, 250] },
    ladderFractions: { steps: 3, maxWhole: 3, maxDen: 6 },
    unitDigitSum: { termCount: 4, minVal: 3000, maxVal: 19999, distinctUnitDigits: true },
  },

  HARD: {
    distractorOffsets: [-4, -3, -2, -1, 1, 2, 3, 4],
    vbodmas: { divisorRange: [18, 65], quotientRange: [25, 85], multiplierRange: [7, 24], useVinculum: true },
    percentFraction: { termCount: 3, allowedTiers: ["MEDIUM", "HARD"], multiplierRange: [50, 280] },
    mixedFractions: { termCount: 3, wholeRange: [6, 22], denominators: [6, 7, 8, 9, 11, 12, 15] },
    squaresCubesRoots: { sqRootRange: [45, 95], cubeRootRange: [12, 25], allowSquaredRhs: true },
    surdsIndices: { bases: [2, 3, 4, 5, 6, 7], exponentMode: "DECIMAL" },
    decimals: { termCount: 5, decimalPlaces: 3, maxDigit: 9 },
    algebraicIdentities: { pattern: "DIFF_OF_CUBES_PLUS_SQUARE", rangeA: [350, 850], rangeB: [120, 320] },
    ladderFractions: { steps: 3, maxWhole: 5, maxDen: 9 },
    unitDigitSum: { termCount: 5, minVal: 12000, maxVal: 89999, distinctUnitDigits: false },
  },
};

// Add this export to config/difficultyProfiles.js
export const APPROXIMATION_PROFILES = {
  EASY: {
    multA: [12, 30],
    multB: [3, 8],
    divQuot: [10, 35],
    divDen: [4, 12],
    sqRange: [12, 28],
    cubeRange: [5, 11],
    addRange: [40, 220],
    pctPool: [10, 20, 25, 30, 40, 50, 75],
  },
  MEDIUM: {
    multA: [18, 55],
    multB: [6, 15],
    divQuot: [18, 65],
    divDen: [8, 22],
    sqRange: [22, 55],
    cubeRange: [8, 18],
    addRange: [120, 600],
    pctPool: [15, 18, 24, 32, 35, 45, 55, 65],
  },
  HARD: {
    multA: [25, 85],
    multB: [11, 24],
    divQuot: [30, 105],
    divDen: [12, 32],
    sqRange: [35, 85],
    cubeRange: [11, 24],
    addRange: [250, 1100],
    pctPool: [16, 22, 28, 36, 42, 54, 68, 85],
  },
};

export const NUMBER_SERIES_PROFILES = {
  EASY: {
    startRange: [4, 30],
    diffStepRange: [3, 9],
    doubleDiffStart: [4, 12],
    doubleDiffStep: [2, 6],
    multRange: [2, 3],
    offsetRange: [1, 5],
    distractorOffsets: [-12, -8, -4, -2, 2, 4, 8, 12],
  },
  MEDIUM: {
    startRange: [8, 45],
    diffStepRange: [6, 15],
    doubleDiffStart: [6, 18],
    doubleDiffStep: [4, 10],
    multRange: [2, 4],
    offsetRange: [2, 9],
    distractorOffsets: [-10, -6, -3, -2, 2, 3, 6, 10],
  },
  HARD: {
    startRange: [12, 65],
    diffStepRange: [9, 22],
    doubleDiffStart: [8, 25],
    doubleDiffStep: [6, 14],
    multRange: [2, 5],
    offsetRange: [3, 14],
    distractorOffsets: [-8, -5, -3, -2, -1, 1, 2, 3, 5, 8],
  },
};
