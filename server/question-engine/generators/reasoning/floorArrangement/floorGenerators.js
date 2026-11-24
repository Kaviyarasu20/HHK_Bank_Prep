// Place at: server/question-engine/generators/reasoning/floorArrangement/floorGenerators.js

/**
 * HHK Floor Arrangement - Generators
 *
 * Workflow per puzzle:
 *  1. Build geometry model.
 *  2. Sample a ground-truth assignment (persons -> positions) + optional attributes.
 *  3. Generate candidate CSP constraints + human-readable clue statements from the solution.
 *  4. Select clues incrementally, verifying via solveFloorCSP until solutionCount === 1.
 *  5. Prune redundant clues while keeping solutionCount === 1.
 */

import { solveFloorCSP } from "./floorSolver.js";
import {
  createSingleBuildingGeometry,
  createMultiBuildingGeometry,
  createFloorFlatGeometry,
  FLOOR_PUZZLE_TYPES,
  FLAT_POSITIONS,
  BUILDING_NAMES,
} from "./floorGeometry.js";

export function createRng(seedInput = Date.now()) {
  const seed = (Number(seedInput) >>> 0) || 0x9e3779b9;
  let state = seed;
  return {
    seed,
    random() {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (state >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) {
      return min + Math.floor(this.random() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(this.random() * arr.length)];
    },
    shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

const PERSON_NAMES = [
  "Aarav", "Bhavna", "Chetan", "Divya", "Esha", "Farhan", "Gauri", "Harsh",
  "Ishita", "Jai", "Kabir", "Lakshmi", "Meera", "Naina", "Om", "Pooja",
  "Rohan", "Sneha", "Tanvi", "Vikram", "Aanya", "Dev", "Ira", "Kian",
];

const PROFESSIONS = [
  "Doctor", "Engineer", "Teacher", "Lawyer", "Banker", "Architect",
  "Journalist", "Accountant", "Designer", "Pharmacist", "Professor", "Scientist",
];

const CITIES = ["Pune", "Chennai", "Mumbai", "Delhi", "Kolkata", "Bengaluru", "Hyderabad", "Jaipur"];
const AGES = [24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];
const COLOURS = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "White", "Black"];
const VEHICLES = ["Car", "Bike", "Bus", "Metro", "Bicycle", "Auto", "Scooter"];
const FOODS = ["Pizza", "Burger", "Dosa", "Idli", "Paneer", "Biryani", "Samosa", "Chaat"];

function ordinalSuffix(n) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/* -------------------------------------------------------------------------- */
/*  Random solution sampler                                                   */
/* -------------------------------------------------------------------------- */

function sampleSingleBuildingSolution({ geometry, persons, rng }) {
  const positions = geometry.positions;
  const assignment = rng.shuffle([...positions].map((_, i) => i));
  const personAt = {};
  const posOfPerson = new Map();
  assignment.forEach((posIdx, personIdx) => {
    personAt[persons[personIdx]] = posIdx;
    posOfPerson.set(persons[personIdx], posIdx);
  });
  return { personAt, posOfPerson, assignment };
}

function sampleMultiBuildingSolution({ geometry, persons, rng }) {
  const positions = geometry.positions;
  const assignment = rng.shuffle([...positions].map((_, i) => i));
  const personAt = {};
  const posOfPerson = new Map();
  assignment.forEach((posIdx, personIdx) => {
    personAt[persons[personIdx]] = posIdx;
    posOfPerson.set(persons[personIdx], posIdx);
  });
  return { personAt, posOfPerson, assignment };
}

function sampleFloorFlatSolution({ geometry, persons, rng }) {
  const positions = geometry.positions;
  const assignment = rng.shuffle([...positions].map((_, i) => i));
  const personAt = {};
  const posOfPerson = new Map();
  assignment.forEach((posIdx, personIdx) => {
    personAt[persons[personIdx]] = posIdx;
    posOfPerson.set(persons[personIdx], posIdx);
  });
  return { personAt, posOfPerson, assignment };
}

function assignAttributes({ persons, rng, attrCount = 3 }) {
  const pools = {
    profession: [...PROFESSIONS],
    city: [...CITIES],
    age: [...AGES],
    colour: [...COLOURS],
    vehicle: [...VEHICLES],
    food: [...FOODS],
  };
  const attrKeys = Object.keys(pools).slice(0, attrCount);
  const attributesByPerson = {};
  for (const person of persons) {
    const attrs = {};
    for (const key of attrKeys) {
      const pool = pools[key];
      const val = rng.pick(pool);
      const idx = pool.indexOf(val);
      pool.splice(idx, 1); // unique per category
      attrs[key] = val;
    }
    attributesByPerson[person] = attrs;
  }
  return { attributesByPerson, attrKeys };
}

/* -------------------------------------------------------------------------- */
/*  Candidate constraint generation                                           */
/* -------------------------------------------------------------------------- */

function buildCandidateConstraints({
  geometry,
  persons,
  personAt,
  posOfPerson,
  attributesByPerson,
  puzzleType,
  rng,
}) {
  const candidates = [];
  const positions = geometry.positions;

  // Helpers
  const add = (type, statement, constraint, weight = 1) => {
    candidates.push({ type, statement, constraint, weight });
  };

  const n = geometry.posCount;

  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    const posIdx = personAt[person];
    const pos = positions[posIdx];

    // Fixed position / floor / building / flat
    add("FIXED_POSITION", `${person} lives on ${pos.floorLabel}.`, {
      type: "FIXED_POSITION", person, positionIndex: posIdx,
    }, 3);
    add("FIXED_FLOOR", `${person} lives on floor ${pos.floor}.`, {
      type: "FIXED_FLOOR", person, floor: pos.floor,
    }, 2);
    if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
      add("FIXED_BUILDING", `${person} lives in Building ${pos.building}.`, {
        type: "FIXED_BUILDING", person, building: pos.building,
      }, 2);
    }
    if (puzzleType === FLOOR_PUZZLE_TYPES.FLOOR_FLAT) {
      add("FIXED_FLAT", `${person} lives in ${pos.flatLabel} flat (${pos.flat}) on floor ${pos.floor}.`, {
        type: "FIXED_FLAT", person, flat: pos.flat,
      }, 1);
    }

    // Topmost / bottommost / not extreme
    if (posIdx === geometry.getTopIndex(pos.building)) {
      add("TOPMOST", `${person} lives on the topmost floor${pos.building ? ` of Building ${pos.building}` : ""}.`, {
        type: "TOPMOST", person, building: pos.building,
      }, 3);
    }
    if (posIdx === geometry.getBottomIndex(pos.building)) {
      add("BOTTOMMOST", `${person} lives on the bottommost floor${pos.building ? ` of Building ${pos.building}` : ""}.`, {
        type: "BOTTOMMOST", person, building: pos.building,
      }, 3);
    }
    if (!pos.isTop && !pos.isBottom) {
      add("NOT_TOPMOST", `${person} does not live on the topmost floor.`, {
        type: "NOT_TOPMOST", person, building: pos.building,
      }, 1);
      add("NOT_BOTTOMMOST", `${person} does not live on the bottommost floor.`, {
        type: "NOT_BOTTOMMOST", person, building: pos.building,
      }, 1);
    }

    // Odd / even
    if (pos.floor % 2 === 1) {
      add("ODD_FLOOR", `${person} lives on an odd-numbered floor.`, { type: "ODD_FLOOR", person }, 2);
    } else {
      add("EVEN_FLOOR", `${person} lives on an even-numbered floor.`, { type: "EVEN_FLOOR", person }, 2);
    }

    // Floor comparisons
    if (pos.floor > 3) {
      add("FLOOR_GREATER_THAN", `${person} lives on a floor above ${pos.floor - 2}.`, {
        type: "FLOOR_GREATER_THAN", person, value: pos.floor - 2,
      }, 1);
    }
    if (pos.floor < n - 2) {
      add("FLOOR_LESS_THAN", `${person} lives on a floor below ${pos.floor + 2}.`, {
        type: "FLOOR_LESS_THAN", person, value: pos.floor + 2,
      }, 1);
    }
  }

  // Pairwise relationships
  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const pA = persons[i];
      const pB = persons[j];
      const posA = personAt[pA];
      const posB = personAt[pB];
      const posObjA = positions[posA];
      const posObjB = positions[posB];

      // Immediate above / below (same building)
      if (geometry.stepAbove(posB) === posA) {
        add("IMMEDIATE_ABOVE", `${pA} lives immediately above ${pB}${posObjA.building ? ` in Building ${posObjA.building}` : ""}.`, {
          type: "IMMEDIATE_ABOVE", personA: pA, personB: pB,
        }, 3);
      }
      if (geometry.stepBelow(posB) === posA) {
        add("IMMEDIATE_BELOW", `${pA} lives immediately below ${pB}${posObjA.building ? ` in Building ${posObjA.building}` : ""}.`, {
          type: "IMMEDIATE_BELOW", personA: pA, personB: pB,
        }, 3);
      }

      // Not adjacent
      if (!geometry.getNeighbours(posB).includes(posA)) {
        add("NOT_ADJACENT", `${pA} does not live on a floor adjacent to ${pB}.`, {
          type: "NOT_ADJACENT", personA: pA, personB: pB,
        }, 1);
      }

      // Exactly N floors between
      const between = geometry.getBetweenCount(posA, posB);
      if (between >= 1 && between <= 4) {
        add("BETWEEN_COUNT", `Exactly ${between} floor${between > 1 ? "s" : ""} is/are between ${pA} and ${pB}.`, {
          type: "BETWEEN_COUNT", personA: pA, personB: pB, count: between,
        }, 2);
      }

      // Higher / lower floor (across or within building)
      if (posObjA.floor > posObjB.floor) {
        add("HIGHER_FLOOR_THAN", `${pA} lives on a higher floor than ${pB}.`, {
          type: "HIGHER_FLOOR_THAN", personA: pA, personB: pB,
        }, 1);
        add("LOWER_FLOOR_THAN", `${pB} lives on a lower floor than ${pA}.`, {
          type: "LOWER_FLOOR_THAN", personA: pB, personB: pA,
        }, 1);
      }

      // Same building / different building
      if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
        if (posObjA.building === posObjB.building) {
          add("SAME_BUILDING", `${pA} and ${pB} live in the same building.`, {
            type: "SAME_BUILDING", personA: pA, personB: pB,
          }, 1);
          if (posObjA.floor === posObjB.floor) {
            add("SAME_FLOOR_SAME_BUILDING", `${pA} and ${pB} live on the same floor in the same building.`, {
              type: "SAME_FLOOR_SAME_BUILDING", personA: pA, personB: pB,
            }, 1);
          }
        } else {
          add("DIFFERENT_BUILDING", `${pA} and ${pB} live in different buildings.`, {
            type: "DIFFERENT_BUILDING", personA: pA, personB: pB,
          }, 1);
          if (posObjA.floor === posObjB.floor) {
            add("SAME_FLOOR_DIFFERENT_BUILDING", `${pA} and ${pB} live on the same floor number in different buildings.`, {
              type: "SAME_FLOOR_DIFFERENT_BUILDING", personA: pA, personB: pB,
            }, 2);
          }
        }
      }
    }
  }

  // Attribute constraints
  if (attributesByPerson) {
    for (const person of persons) {
      const attrs = attributesByPerson[person] || {};
      const posIdx = personAt[person];
      const pos = positions[posIdx];

      for (const [key, val] of Object.entries(attrs)) {
        add("ATTRIBUTE_EQUALS", `${person} is the ${val}.`, {
          type: "ATTRIBUTE_EQUALS", person, attrKey: key, attrValue: val,
          positionIndex: posIdx,
        }, 2);
      }

      // Attribute above another attribute (cross-person)
      if (Object.keys(attrs).length === 0) continue;
      for (const other of persons) {
        if (other === person) continue;
        const otherAttrs = attributesByPerson[other] || {};
        if (Object.keys(otherAttrs).length === 0) continue;
        const otherPos = personAt[other];
        const otherPosObj = positions[otherPos];
        if (pos.floor > otherPosObj.floor) {
          const myKey = Object.keys(attrs)[0];
          const theirKey = Object.keys(otherAttrs)[0];
          add("ATTRIBUTE_ABOVE", `The ${attrs[myKey]} lives somewhere above the ${otherAttrs[theirKey]}.`, {
            type: "ATTRIBUTE_ABOVE",
            personA: person, personB: other,
            attrKeyA: myKey, attrValueA: attrs[myKey],
            attrKeyB: theirKey, attrValueB: otherAttrs[theirKey],
          }, 1);
        }
      }
    }
  }

  // Higher weight first; stable sort keeps same-weight candidates in random (rng.shuffled) order
  const shuffled = rng.shuffle(candidates);
  shuffled.sort((a, b) => b.weight - a.weight);
  return shuffled;
}

/* -------------------------------------------------------------------------- */
/*  Clue selection + uniqueness verification                                  */
/* -------------------------------------------------------------------------- */

function constraintsToStatement(c) {
  return c.statement;
}

export function generateFloorArrangement({
  puzzleType = FLOOR_PUZZLE_TYPES.SINGLE_BUILDING,
  difficulty = "Medium",
  exam = "IBPS-PO",
  stage = "Prelims",
  seed = null,
  maxAttempts = 20,
  clueCount = 7,
  personCount = null,
  buildings = null,
  floorCount = null,
  flatsPerFloor = null,
  attributeCount = null,
} = {}) {
  const rng = createRng(seed);

  // --- Determine geometry params based on puzzle type & difficulty ---
  let geometry, persons, buildingInfo;

  if (puzzleType === FLOOR_PUZZLE_TYPES.SINGLE_BUILDING) {
    const fc = floorCount || rng.int(5, 12);
    persons = rng.shuffle([...PERSON_NAMES]).slice(0, fc);
    geometry = createSingleBuildingGeometry(fc);
    buildingInfo = { floors: fc };
  } else if (puzzleType === FLOOR_PUZZLE_TYPES.FLOOR_FLAT) {
    const fc = floorCount || rng.int(5, 10);
    const fp = flatsPerFloor || rng.int(2, 4);
    const total = fc * fp;
    persons = rng.shuffle([...PERSON_NAMES]).slice(0, total);
    geometry = createFloorFlatGeometry(fc, fp);
    buildingInfo = { floors: fc, flatsPerFloor: fp };
  } else if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
    const bCount = rng.int(2, 3);
    const bList = [];
    for (let i = 0; i < bCount; i++) {
      bList.push({ name: BUILDING_NAMES[i], floors: rng.int(4, 8) });
    }
    const total = bList.reduce((s, b) => s + b.floors, 0);
    persons = rng.shuffle([...PERSON_NAMES]).slice(0, total);
    geometry = createMultiBuildingGeometry(bList);
    buildingInfo = { buildings: bList };
  } else if (puzzleType === FLOOR_PUZZLE_TYPES.PROFESSIONS) {
    const fc = floorCount || rng.int(6, 10);
    persons = rng.shuffle([...PERSON_NAMES]).slice(0, fc);
    geometry = createSingleBuildingGeometry(fc);
    buildingInfo = { floors: fc };
  } else if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_VARIABLE) {
    const fc = floorCount || rng.int(6, 10);
    persons = rng.shuffle([...PERSON_NAMES]).slice(0, fc);
    geometry = createSingleBuildingGeometry(fc);
    buildingInfo = { floors: fc };
  }

  const attrCount = attributeCount || (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_VARIABLE ? rng.int(3, 5) : 0);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptRng = createRng((rng.seed || 0) + attempt * 7919);

    // Sample solution
    let solution;
    if (puzzleType === FLOOR_PUZZLE_TYPES.FLOOR_FLAT) {
      solution = sampleFloorFlatSolution({ geometry, persons, rng: attemptRng });
    } else if (puzzleType === FLOOR_PUZZLE_TYPES.MULTI_BUILDING) {
      solution = sampleMultiBuildingSolution({ geometry, persons, rng: attemptRng });
    } else {
      solution = sampleSingleBuildingSolution({ geometry, persons, rng: attemptRng });
    }

    let attributesByPerson = {};
    if (puzzleType === FLOOR_PUZZLE_TYPES.PROFESSIONS) {
      // force profession pool (one unique profession per person)
      attributesByPerson = {};
      const profPool = [...PROFESSIONS];
      for (const p of persons) {
        const v = attemptRng.pick(profPool);
        profPool.splice(profPool.indexOf(v), 1);
        attributesByPerson[p] = { profession: v };
      }
    } else if (attrCount > 0) {
      ({ attributesByPerson } = assignAttributes({ persons, rng: attemptRng, attrCount }));
    }

    // Generate candidate constraints
    const candidates = buildCandidateConstraints({
      geometry, persons, personAt: solution.personAt, posOfPerson: solution.posOfPerson,
      attributesByPerson, puzzleType, rng: attemptRng,
    });

    // Select clues incrementally until UNIQUE.
    // Order: FIXED_POSITION anchors first (weight 3), then relational clues
    // (weight 2 then 1). This is fast and guaranteed: pinning every person but
    // the last forces uniqueness, so the solver always reaches UNIQUE before
    // exhausting FIXED_POSITION candidates. Pruning afterward removes anything
    // redundant, keeping the clue set minimal and realistic.
    const selected = [];
    const seenStatements = new Set();
    // Higher weight first; stable sort keeps same-weight in candidate order
    const ordered = [...candidates].sort((a, b) => b.weight - a.weight);
    for (const cand of ordered) {
      if (seenStatements.has(cand.statement)) continue;
      selected.push(cand);
      seenStatements.add(cand.statement);
      const result = solveFloorCSP({
        geometry, persons, constraints: selected.map((c) => c.constraint), attributesByPerson, maxSolutions: 2,
      });
      if (result.status === "UNIQUE") break;
    }

    // Prune redundant clues: try removing each, keep only if still unique
    let pruned = [...selected];
    let changed = true;
    while (changed && pruned.length > 1) {
      changed = false;
      for (let k = 0; k < pruned.length; k++) {
        const trial = pruned.filter((_, idx) => idx !== k).map((c) => c.constraint);
        const chk = solveFloorCSP({
          geometry, persons, constraints: trial, attributesByPerson, maxSolutions: 2,
        });
        if (chk.unique) {
          pruned.splice(k, 1);
          changed = true;
          break;
        }
      }
    }

    const finalClues = pruned.map((c) => c.constraint);
    const finalVerify = solveFloorCSP({
      geometry, persons, constraints: finalClues, attributesByPerson, maxSolutions: 2,
    });
    if (!finalVerify.unique) continue;

    const solutionArrangement = finalVerify.solutions[0];

    return {
      puzzleType,
      difficulty,
      exam,
      stage,
      seed: attemptRng.seed,
      persons,
      geometry,
      attributesByPerson,
      constraints: finalClues,
      clueStatements: pruned.map((c) => c.statement),
      solvedArrangement: solutionArrangement,
      personAt: solution.personAt,
      posOfPerson: solution.posOfPerson,
      buildingInfo,
      validationStatus: "VERIFIED",
      generatorVersion: "1.0.0",
    };
  }

  throw new Error(`Unable to synthesize a unique-solution ${puzzleType} floor puzzle after ${maxAttempts} attempts.`);
}
