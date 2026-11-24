// Place at: server/question-engine/generators/reasoning/bloodRelations/bloodRelationsSolver.js

/**
 * Deterministic Family Graph & Constraint Solver for Indian Banking Blood Relations
 *
 * Strictly enforces:
 *  - Every person is a unique node with gender: 'M' | 'F' | 'U' (Unknown — never assumed!)
 *  - Explicit edges: parent -> child, spouse <-> spouse, sibling <-> sibling
 *  - Cycle detection (prevents impossible ancestor loops)
 *  - Generation-level consistency (parent = child + 1, spouses & siblings share generation)
 *  - Contradiction detection (dual genders, >2 parents, 2 fathers/2 mothers, incestuous marriage)
 *  - Exact Maternal vs Paternal distinction
 *  - Returns "Cannot be determined" whenever required gender or lineage link is genuinely missing
 */

export class FamilyGraph {
  constructor() {
    this.nodes = new Map(); // id -> { id, name, gender: 'M'|'F'|'U' }
    this.parentsOf = new Map(); // childId -> Set(parentId)
    this.childrenOf = new Map(); // parentId -> Set(childId)
    this.spouseOf = new Map(); // id -> spouseId
    this.siblingsOf = new Map(); // id -> Set(siblingId)
    this.contradictions = [];
  }

  addPerson(id, gender = "U", name = null) {
    const key = String(id).trim();
    const normG = gender === "M" || gender === "F" ? gender : "U";
    if (!this.nodes.has(key)) {
      this.nodes.set(key, { id: key, name: name || key, gender: normG });
      this.parentsOf.set(key, new Set());
      this.childrenOf.set(key, new Set());
      this.siblingsOf.set(key, new Set());
    } else if (normG !== "U") {
      this.setGender(key, normG);
    }
    return this.nodes.get(key);
  }

  setGender(id, gender) {
    const key = String(id).trim();
    if (gender !== "M" && gender !== "F") return;
    const node = this.addPerson(key);
    if (node.gender !== "U" && node.gender !== gender) {
      this.contradictions.push(
        `Gender contradiction for ${key}: already ${node.gender}, cannot set ${gender}.`
      );
      return;
    }
    node.gender = gender;
  }

  addParentChild(parentId, childId) {
    const p = String(parentId).trim();
    const c = String(childId).trim();
    if (p === c) {
      this.contradictions.push(`Self-parenting cycle detected on ${p}.`);
      return;
    }
    this.addPerson(p);
    this.addPerson(c);
    this.parentsOf.get(c).add(p);
    this.childrenOf.get(p).add(c);
  }

  addSpouse(aId, bId) {
    const a = String(aId).trim();
    const b = String(bId).trim();
    if (a === b) {
      this.contradictions.push(`Self-marriage detected on ${a}.`);
      return;
    }
    this.addPerson(a);
    this.addPerson(b);
    const existingA = this.spouseOf.get(a);
    const existingB = this.spouseOf.get(b);
    if (existingA && existingA !== b) {
      this.contradictions.push(`Multiple spouses detected for ${a}: ${existingA} and ${b}.`);
      return;
    }
    if (existingB && existingB !== a) {
      this.contradictions.push(`Multiple spouses detected for ${b}: ${existingB} and ${a}.`);
      return;
    }
    this.spouseOf.set(a, b);
    this.spouseOf.set(b, a);
  }

  addSibling(aId, bId) {
    const a = String(aId).trim();
    const b = String(bId).trim();
    if (a === b) return;
    this.addPerson(a);
    this.addPerson(b);
    this.siblingsOf.get(a).add(b);
    this.siblingsOf.get(b).add(a);
  }

  /**
   * Performs deterministic logical closure:
   * 1. Spouse gender inference (in Indian banking exams, married couples are M-F).
   * 2. Transitive sibling closure & shared-parent propagation between explicit siblings.
   * 3. Shared-child spouse parenting propagation (if P is parent of C and P is married to S, S is also parent of C).
   * 4. Validates cycles, generation alignment, and parent gender uniqueness.
   */
  solve({ inferOppositeSpouseGender = true, propagateSpouseParenting = true } = {}) {
    let changed = true;
    let guard = 0;

    while (changed && guard < 30) {
      changed = false;
      guard++;

      // 1. Opposite spouse gender inference
      if (inferOppositeSpouseGender) {
        for (const [a, b] of this.spouseOf.entries()) {
          const ga = this.nodes.get(a).gender;
          const gb = this.nodes.get(b).gender;
          if (ga !== "U" && gb === "U") {
            this.setGender(b, ga === "M" ? "F" : "M");
            changed = true;
          } else if (ga !== "U" && gb !== "U" && ga === gb) {
            this.contradictions.push(`Same-gender spouse conflict between ${a} (${ga}) and ${b} (${gb}).`);
          }
        }
      }

      // 2. If P is parent of C and married to S, S is also parent of C
      if (propagateSpouseParenting) {
        for (const [child, parents] of this.parentsOf.entries()) {
          for (const p of Array.from(parents)) {
            const sp = this.spouseOf.get(p);
            if (sp && !parents.has(sp)) {
              parents.add(sp);
              this.childrenOf.get(sp).add(child);
              changed = true;
            }
          }
        }
      }

      // 3. Transitive sibling closure & parent sharing among explicit siblings
      for (const [a, sibs] of this.siblingsOf.entries()) {
        for (const b of Array.from(sibs)) {
          // Transitivity: if a-b and b-c then a-c
          for (const c of this.siblingsOf.get(b)) {
            if (c !== a && !sibs.has(c)) {
              sibs.add(c);
              this.siblingsOf.get(c).add(a);
              changed = true;
            }
          }
          // Share known parents between explicit siblings
          for (const p of this.parentsOf.get(a)) {
            if (!this.parentsOf.get(b).has(p)) {
              this.parentsOf.get(b).add(p);
              this.childrenOf.get(p).add(b);
              changed = true;
            }
          }
        }
      }

      // 4. Two people sharing the exact same two married parents are siblings
      const allIds = Array.from(this.nodes.keys());
      for (let i = 0; i < allIds.length; i++) {
        for (let j = i + 1; j < allIds.length; j++) {
          const u = allIds[i];
          const v = allIds[j];
          if (this.siblingsOf.get(u).has(v)) continue;
          const pu = this.parentsOf.get(u);
          const pv = this.parentsOf.get(v);
          const shared = Array.from(pu).filter((p) => pv.has(p));
          if (shared.length >= 1) {
            this.siblingsOf.get(u).add(v);
            this.siblingsOf.get(v).add(u);
            changed = true;
          }
        }
      }
    }

    const validation = this.validateConsistency();
    return validation;
  }

  validateConsistency() {
    const errors = [...this.contradictions];

    // Check max 2 parents and at most 1 male parent + 1 female parent
    for (const [child, parents] of this.parentsOf.entries()) {
      if (parents.size > 2) {
        errors.push(`${child} has ${parents.size} parents (max 2 allowed).`);
      }
      let fathers = 0;
      let mothers = 0;
      for (const p of parents) {
        const g = this.nodes.get(p).gender;
        if (g === "M") fathers++;
        if (g === "F") mothers++;
      }
      if (fathers > 1) errors.push(`${child} has more than one father.`);
      if (mothers > 1) errors.push(`${child} has more than one mother.`);
    }

    // Check ancestor cycles via DFS
    const state = new Map(); // 0=unvisited, 1=visiting, 2=done
    const dfs = (u) => {
      state.set(u, 1);
      for (const child of this.childrenOf.get(u) || []) {
        if (state.get(child) === 1) {
          errors.push(`Ancestor cycle detected involving ${u} and ${child}.`);
          return;
        }
        if (!state.get(child)) dfs(child);
      }
      state.set(u, 2);
    };
    for (const id of this.nodes.keys()) {
      if (!state.get(id)) dfs(id);
    }

    // Check spouse cannot be sibling, parent, or child
    for (const [a, b] of this.spouseOf.entries()) {
      if (this.siblingsOf.get(a).has(b)) {
        errors.push(`Invalid relationship: ${a} and ${b} are both spouses and siblings.`);
      }
      if (this.parentsOf.get(a).has(b) || this.childrenOf.get(a).has(b)) {
        errors.push(`Invalid relationship: ${a} and ${b} are both spouses and parent-child.`);
      }
    }

    // Check generation levels across connected components
    const genMap = new Map();
    for (const startId of this.nodes.keys()) {
      if (genMap.has(startId)) continue;
      genMap.set(startId, 0);
      const queue = [startId];
      while (queue.length) {
        const u = queue.shift();
        const g = genMap.get(u);
        const checks = [
          ...Array.from(this.childrenOf.get(u)).map((v) => [v, g - 1]),
          ...Array.from(this.parentsOf.get(u)).map((v) => [v, g + 1]),
          ...Array.from(this.siblingsOf.get(u)).map((v) => [v, g]),
          ...(this.spouseOf.has(u) ? [[this.spouseOf.get(u), g]] : []),
        ];
        for (const [v, expectedGen] of checks) {
          if (!genMap.has(v)) {
            genMap.set(v, expectedGen);
            queue.push(v);
          } else if (genMap.get(v) !== expectedGen) {
            errors.push(
              `Generation conflict on ${v}: expected ${expectedGen}, found ${genMap.get(v)}.`
            );
          }
        }
      }
    }

    // Normalize generation levels so oldest = 1
    const maxGen = genMap.size ? Math.max(...genMap.values()) : 0;
    const normalizedGenerations = {};
    for (const [id, g] of genMap.entries()) {
      normalizedGenerations[id] = maxGen - g + 1;
    }

    const uniqueErrors = Array.from(new Set(errors));
    return {
      consistent: uniqueErrors.length === 0,
      errors: uniqueErrors,
      generations: normalizedGenerations,
      generationCount: genMap.size ? new Set(Object.values(normalizedGenerations)).size : 0,
    };
  }

  getGender(id) {
    return this.nodes.get(String(id).trim())?.gender || "U";
  }

  /**
   * Answers: "How is `sourceId` related to `targetId`?"
   * Returns { relation: string, known: boolean, maternalOrPaternal: 'paternal'|'maternal'|null }
   */
  resolveRelation(sourceId, targetId) {
    const s = String(sourceId).trim();
    const t = String(targetId).trim();
    if (!this.nodes.has(s) || !this.nodes.has(t)) {
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }
    if (s === t) {
      return { relation: "Self", known: true, maternalOrPaternal: null };
    }

    const gS = this.getGender(s);
    const parentsOfT = this.parentsOf.get(t);
    const childrenOfT = this.childrenOf.get(t);
    const siblingsOfT = this.siblingsOf.get(t);
    const spouseOfT = this.spouseOf.get(t);

    // 1. Spouse
    if (spouseOfT === s) {
      if (gS === "M") return { relation: "Husband", known: true, maternalOrPaternal: null };
      if (gS === "F") return { relation: "Wife", known: true, maternalOrPaternal: null };
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }

    // 2. Parent (Father / Mother)
    if (parentsOfT.has(s)) {
      if (gS === "M") return { relation: "Father", known: true, maternalOrPaternal: null };
      if (gS === "F") return { relation: "Mother", known: true, maternalOrPaternal: null };
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }

    // 3. Child (Son / Daughter)
    if (childrenOfT.has(s)) {
      if (gS === "M") return { relation: "Son", known: true, maternalOrPaternal: null };
      if (gS === "F") return { relation: "Daughter", known: true, maternalOrPaternal: null };
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }

    // 4. Sibling (Brother / Sister)
    if (siblingsOfT.has(s)) {
      if (gS === "M") return { relation: "Brother", known: true, maternalOrPaternal: null };
      if (gS === "F") return { relation: "Sister", known: true, maternalOrPaternal: null };
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }

    // 5. Grandparent (Paternal / Maternal Grandfather / Grandmother)
    for (const p of parentsOfT) {
      if (this.parentsOf.get(p).has(s)) {
        const pGender = this.getGender(p);
        const side = pGender === "M" ? "Paternal" : pGender === "F" ? "Maternal" : null;
        if (gS === "U") return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
        const base = gS === "M" ? "Grandfather" : "Grandmother";
        return {
          relation: side ? `${side} ${base}` : base,
          known: true,
          maternalOrPaternal: side ? side.toLowerCase() : null,
        };
      }
    }

    // 6. Grandchild (Grandson / Granddaughter)
    for (const c of childrenOfT) {
      if (this.childrenOf.get(c).has(s)) {
        if (gS === "M") return { relation: "Grandson", known: true, maternalOrPaternal: null };
        if (gS === "F") return { relation: "Granddaughter", known: true, maternalOrPaternal: null };
        return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
      }
    }

    // 7. Uncle / Aunt (sibling of parent OR spouse of sibling of parent)
    for (const p of parentsOfT) {
      const pGender = this.getGender(p);
      const side = pGender === "M" ? "Paternal" : pGender === "F" ? "Maternal" : null;
      const isDirectUncleAunt = this.siblingsOf.get(p).has(s);
      const isSpouseOfUncleAunt = Array.from(this.siblingsOf.get(p)).some(
        (sib) => this.spouseOf.get(sib) === s
      );
      if (isDirectUncleAunt || isSpouseOfUncleAunt) {
        if (gS === "U") return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
        const base = gS === "M" ? "Uncle" : "Aunt";
        return {
          relation: side ? `${side} ${base}` : base,
          known: true,
          maternalOrPaternal: side ? side.toLowerCase() : null,
        };
      }
    }

    // 8. Nephew / Niece (child of sibling OR child of spouse's sibling)
    for (const sib of siblingsOfT) {
      if (this.childrenOf.get(sib).has(s)) {
        if (gS === "M") return { relation: "Nephew", known: true, maternalOrPaternal: null };
        if (gS === "F") return { relation: "Niece", known: true, maternalOrPaternal: null };
        return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
      }
    }
    if (spouseOfT) {
      for (const spSib of this.siblingsOf.get(spouseOfT)) {
        if (this.childrenOf.get(spSib).has(s)) {
          if (gS === "M") return { relation: "Nephew", known: true, maternalOrPaternal: null };
          if (gS === "F") return { relation: "Niece", known: true, maternalOrPaternal: null };
          return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
        }
      }
    }

    // 9. Cousin (child of parent's sibling)
    for (const p of parentsOfT) {
      for (const pSib of this.siblingsOf.get(p)) {
        if (this.childrenOf.get(pSib).has(s)) {
          return { relation: "Cousin", known: true, maternalOrPaternal: null };
        }
      }
    }

    // 10. In-laws
    // Father-in-law / Mother-in-law (parent of spouse)
    if (spouseOfT && this.parentsOf.get(spouseOfT).has(s)) {
      if (gS === "M") return { relation: "Father-in-law", known: true, maternalOrPaternal: null };
      if (gS === "F") return { relation: "Mother-in-law", known: true, maternalOrPaternal: null };
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }

    // Son-in-law / Daughter-in-law (spouse of child)
    for (const c of childrenOfT) {
      if (this.spouseOf.get(c) === s) {
        if (gS === "M") return { relation: "Son-in-law", known: true, maternalOrPaternal: null };
        if (gS === "F") return { relation: "Daughter-in-law", known: true, maternalOrPaternal: null };
        return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
      }
    }

    // Brother-in-law / Sister-in-law (spouse's sibling OR sibling's spouse)
    const isSpouseSibling = spouseOfT && this.siblingsOf.get(spouseOfT).has(s);
    const isSiblingSpouse = Array.from(siblingsOfT).some((sib) => this.spouseOf.get(sib) === s);
    if (isSpouseSibling || isSiblingSpouse) {
      if (gS === "M") return { relation: "Brother-in-law", known: true, maternalOrPaternal: null };
      if (gS === "F") return { relation: "Sister-in-law", known: true, maternalOrPaternal: null };
      return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
    }

    // 11. Great-Grandparent (parent of grandparent)
    for (const p of parentsOfT) {
      for (const gp of this.parentsOf.get(p)) {
        if (this.parentsOf.get(gp).has(s)) {
          if (gS === "M") return { relation: "Great-Grandfather", known: true, maternalOrPaternal: null };
          if (gS === "F") return { relation: "Great-Grandmother", known: true, maternalOrPaternal: null };
          return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
        }
      }
    }

    return { relation: "Cannot be determined", known: false, maternalOrPaternal: null };
  }

  /**
   * Exact family counting (every person node counted once).
   */
  getFamilyCounts() {
    let males = 0;
    let females = 0;
    let unknownGender = 0;
    for (const node of this.nodes.values()) {
      if (node.gender === "M") males++;
      else if (node.gender === "F") females++;
      else unknownGender++;
    }
    const couplePairs = new Set();
    for (const [a, b] of this.spouseOf.entries()) {
      couplePairs.add([a, b].sort().join("::"));
    }
    const check = this.validateConsistency();
    return {
      totalMembers: this.nodes.size,
      males,
      females,
      unknownGender,
      couples: couplePairs.size,
      generations: check.generationCount,
    };
  }

  /**
   * Exports structured family tree data for UI visualization / auditing.
   */
  exportFamilyTreeData() {
    const check = this.validateConsistency();
    return {
      members: Array.from(this.nodes.values()).map((n) => ({
        id: n.id,
        name: n.name,
        gender: n.gender,
        generation: check.generations[n.id] ?? 1,
      })),
      parentChildEdges: Array.from(this.childrenOf.entries()).flatMap(([p, cs]) =>
        Array.from(cs).map((c) => ({ parent: p, child: c }))
      ),
      spouseEdges: Array.from(
        new Set(
          Array.from(this.spouseOf.entries()).map(([a, b]) => [a, b].sort().join("::"))
        )
      ).map((pair) => {
        const [a, b] = pair.split("::");
        return { a, b };
      }),
      siblingEdges: Array.from(
        new Set(
          Array.from(this.siblingsOf.entries()).flatMap(([a, sibs]) =>
            Array.from(sibs).map((b) => [a, b].sort().join("::"))
          )
        )
      ).map((pair) => {
        const [a, b] = pair.split("::");
        return { a, b };
      }),
    };
  }
}

/**
 * Reconstructs and solves a FamilyGraph from a declarative logicModel specification.
 * Used by both templates AND the independent validator.
 */
export function buildAndSolveFamilyGraph(logicModel) {
  const graph = new FamilyGraph();
  for (const person of logicModel.members || []) {
    graph.addPerson(person.id, person.gender || "U", person.name || person.id);
  }
  for (const [p, c] of logicModel.parentChild || []) {
    graph.addParentChild(p, c);
  }
  for (const [a, b] of logicModel.spouses || []) {
    graph.addSpouse(a, b);
  }
  for (const [a, b] of logicModel.siblings || []) {
    graph.addSibling(a, b);
  }
  const validation = graph.solve({
    inferOppositeSpouseGender: logicModel.inferOppositeSpouseGender !== false,
    propagateSpouseParenting: logicModel.propagateSpouseParenting !== false,
  });
  return { graph, validation };
}