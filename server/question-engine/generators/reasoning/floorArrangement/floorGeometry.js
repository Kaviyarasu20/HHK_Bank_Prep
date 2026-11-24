// Place at: server/question-engine/generators/reasoning/floorArrangement/floorGeometry.js

/**
 * HHK Floor Arrangement - Geometry Models
 *
 * Supports 5 puzzle families:
 *  1. SINGLE_BUILDING      - 1 building, N floors (5-12), 1 person/floor
 *  2. MULTI_BUILDING       - 2-3 buildings, 4-8 floors each, persons across buildings
 *  3. FLOOR_FLAT           - 1 building, N floors (5-10), 2-4 flats/floor
 *  4. PROFESSIONS          - 1 building, 6-10 floors, 1 person/floor + unique profession
 *  5. MULTI_VARIABLE       - 1 building, 6-10 floors, 1 person/floor + 3-5 unique attributes
 *
 * Floor numbering: index 0 = bottommost/ground floor, index N-1 = topmost.
 */

export const FLOOR_PUZZLE_TYPES = {
  SINGLE_BUILDING: "SINGLE_BUILDING",
  MULTI_BUILDING: "MULTI_BUILDING",
  FLOOR_FLAT: "FLOOR_FLAT",
  PROFESSIONS: "PROFESSIONS",
  MULTI_VARIABLE: "MULTI_VARIABLE",
};

export const FLAT_POSITIONS = ["FLAT_1", "FLAT_2", "FLAT_3", "FLAT_4"];
export const BUILDING_NAMES = ["A", "B", "C"];

/**
 * Build a single-building geometry.
 * Returns { type, floors: N, positions: [{floor, floorLabel, index}], posCount }
 */
export function createSingleBuildingGeometry(floorCount = 8) {
  const floors = [];
  for (let i = 0; i < floorCount; i++) {
    floors.push({
      index: i,
      floor: i + 1,
      floorLabel: `${i + 1}${ordinalSuffix(i + 1)}`,
      isBottom: i === 0,
      isTop: i === floorCount - 1,
    });
  }
  return {
    type: FLOOR_PUZZLE_TYPES.SINGLE_BUILDING,
    floorCount,
    positions: floors,
    posCount: floorCount,
    label: `${floorCount}-Floor Single Building`,
    stepAbove: (idx) => (idx < floorCount - 1 ? idx + 1 : null),
    stepBelow: (idx) => (idx > 0 ? idx - 1 : null),
    getNeighbours: (idx) => {
      const n = [];
      if (idx > 0) n.push(idx - 1);
      if (idx < floorCount - 1) n.push(idx + 1);
      return n;
    },
    getBetweenCount: (a, b) => Math.abs(a - b) - 1,
    getBottomIndex: () => 0,
    getTopIndex: () => floorCount - 1,
    isOdd: (idx) => (idx + 1) % 2 === 1,
    isEven: (idx) => (idx + 1) % 2 === 0,
    canonicalize: (assignment) => assignment.join(","),
  };
}

/**
 * Build a multi-building geometry.
 * buildings: [{name, floors}] e.g. [{name:'A',floors:6},{name:'B',floors:6},{name:'C',floors:5}]
 * Positions are (building, floor) pairs.
 */
export function createMultiBuildingGeometry(buildings) {
  const positions = [];
  const buildingIndex = {};
  let offset = 0;
  for (const b of buildings) {
    buildingIndex[b.name] = { start: offset, floors: b.floors };
    for (let i = 0; i < b.floors; i++) {
      positions.push({
        index: offset + i,
        building: b.name,
        floor: i + 1,
        floorLabel: `${b.name}-${i + 1}`,
        globalIndex: offset + i,
        isBottom: i === 0,
        isTop: i === b.floors - 1,
      });
    }
    offset += b.floors;
  }
  const posCount = positions.length;
  return {
    type: FLOOR_PUZZLE_TYPES.MULTI_BUILDING,
    buildings,
    positions,
    posCount,
    buildingIndex,
    label: buildings.map((b) => `${b.name}(${b.floors}F)`).join(" + "),
    stepAbove: (idx) => {
      const pos = positions[idx];
      const bInfo = buildingIndex[pos.building];
      if (pos.floor < bInfo.floors) return idx + 1;
      return null;
    },
    stepBelow: (idx) => {
      const pos = positions[idx];
      if (pos.floor > 1) return idx - 1;
      return null;
    },
    getNeighbours: (idx) => {
      const pos = positions[idx];
      const n = [];
      if (pos.floor > 1) n.push(idx - 1);
      const bInfo = buildingIndex[pos.building];
      if (pos.floor < bInfo.floors) n.push(idx + 1);
      return n;
    },
    getBetweenCount: (a, b) => Math.abs(a - b) - 1,
    getBottomIndex: (building) => {
      if (building) return buildingIndex[building].start;
      return 0;
    },
    getTopIndex: (building) => {
      if (building) return buildingIndex[building].start + buildingIndex[building].floors - 1;
      return posCount - 1;
    },
    isOdd: (idx) => positions[idx].floor % 2 === 1,
    isEven: (idx) => positions[idx].floor % 2 === 0,
    canonicalize: (assignment) => assignment.join(","),
    positionOf: (building, floor) => {
      const bInfo = buildingIndex[building];
      if (!bInfo || floor < 1 || floor > bInfo.floors) return null;
      return bInfo.start + (floor - 1);
    },
  };
}

/**
 * Build a floor+flat geometry.
 * Each floor has `flatsPerFloor` flats (left-to-right).
 */
export function createFloorFlatGeometry(floorCount = 6, flatsPerFloor = 2) {
  const positions = [];
  for (let f = 0; f < floorCount; f++) {
    for (let flat = 0; flat < flatsPerFloor; flat++) {
      positions.push({
        index: positions.length,
        floor: f + 1,
        floorLabel: `${f + 1}${ordinalSuffix(f + 1)}`,
        flat: FLAT_POSITIONS[flat] || `FLAT_${flat + 1}`,
        flatLabel: flat === 0 ? "Left" : flat === 1 ? "Right" : `Flat ${flat + 1}`,
        flatIndex: flat,
        isBottomFloor: f === 0,
        isTopFloor: f === floorCount - 1,
      });
    }
  }
  const posCount = positions.length;
  return {
    type: FLOOR_PUZZLE_TYPES.FLOOR_FLAT,
    floorCount,
    flatsPerFloor,
    positions,
    posCount,
    label: `${floorCount}F x ${flatsPerFloor} flats`,
    stepAbove: (idx) => {
      const pos = positions[idx];
      const sameFlatAbove = positions.findIndex(
        (p) => p.floor === pos.floor + 1 && p.flatIndex === pos.flatIndex
      );
      return sameFlatAbove >= 0 ? sameFlatAbove : null;
    },
    stepBelow: (idx) => {
      const pos = positions[idx];
      const sameFlatBelow = positions.findIndex(
        (p) => p.floor === pos.floor - 1 && p.flatIndex === pos.flatIndex
      );
      return sameFlatBelow >= 0 ? sameFlatBelow : null;
    },
    getNeighbours: (idx) => {
      const pos = positions[idx];
      const n = [];
      // same floor adjacent flat
      const sameFloorAdj = positions.findIndex(
        (p) => p.floor === pos.floor && Math.abs(p.flatIndex - pos.flatIndex) === 1
      );
      if (sameFloorAdj >= 0) n.push(sameFloorAdj);
      // floor above same flat
      const above = positions.findIndex(
        (p) => p.floor === pos.floor + 1 && p.flatIndex === pos.flatIndex
      );
      if (above >= 0) n.push(above);
      // floor below same flat
      const below = positions.findIndex(
        (p) => p.floor === pos.floor - 1 && p.flatIndex === pos.flatIndex
      );
      if (below >= 0) n.push(below);
      return n;
    },
    getBetweenCount: (a, b) => Math.abs(positions[a].floor - positions[b].floor) - 1,
    getBottomIndex: () => 0,
    getTopIndex: () => posCount - 1,
    isOdd: (idx) => positions[idx].floor % 2 === 1,
    isEven: (idx) => positions[idx].floor % 2 === 0,
    canonicalize: (assignment) => assignment.join(","),
    positionOfFloorFlat: (floor, flatIndex) => {
      return positions.findIndex((p) => p.floor === floor && p.flatIndex === flatIndex);
    },
  };
}

function ordinalSuffix(n) {
  if (n >= 11 && n <= 13) return "th";
  switch (n % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
