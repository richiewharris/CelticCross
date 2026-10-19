import { describe, expect, it } from "vitest";
import { BITS, E, N, OPP, S_, W, minTurns, pop, rotCCW, rotCW, signedSteps } from "../engine/knot";
import { mulberry32 } from "../engine/testkit";
import {
  CUBE_TIERS, FACES, ORIENTATIONS, QID, TURNS, backOf, countLoops, cross, cubeGeom, deal, dot, dragCube, faceFacing, frontFace,
  knotFromColours, looseEnds, makeKnot, nbOf, qaxis, qmat, qmul, qnorm, qrot, sideVec, snapQuat, solved, turnCube, visibleFaces,
  type CubeTurn, type Quat,
} from "./engine";

const TIERS = [1, 2, 3, 4, 5] as const;
const nz = (v: readonly number[]) => v.map(x => x + 0);

describe("the cube's surface", () => {
  it("every face frame is right-handed and outward", () => {
    for (const F of FACES) expect(nz(cross(F.r, F.d))).toEqual(nz(F.n));
    expect(new Set(FACES.map(F => F.n.join())).size).toBe(6);
  });
  for (const n of [2, 3, 4]) it(`${n}×${n}: neighbours are symmetric with matching sides on every edge and corner`, () => {
    const g = cubeGeom(n);
    expect(g.count).toBe(6 * n * n);
    let crossFace = 0;
    for (let k = 0; k < g.count; k++) {
      const seen = new Set<number>();
      for (const b of BITS) {
        const j = nbOf(g, k, b), bb = backOf(g, k, b);
        expect(j).not.toBe(k);
        seen.add(j);
        expect(nbOf(g, j, bb)).toBe(k);
        expect(backOf(g, j, bb)).toBe(b);
        // the two stones sit side by side: two units apart (on a face) or one diagonal step round an edge
        const c = g.centre[k], d = g.centre[j], dist2 = (c[0] - d[0]) ** 2 + (c[1] - d[1]) ** 2 + (c[2] - d[2]) ** 2;
        if (g.face[j] === g.face[k]) { expect(dist2).toBe(4); expect(bb).toBe(OPP[b]); }
        else {
          crossFace++;
          expect(dist2).toBe(2);
          // the side arrived on points back along the old face's normal
          expect(nz(sideVec(g.face[j], bb))).toEqual(nz(FACES[g.face[k]].n));
          expect(dot(sideVec(g.face[k], b), FACES[g.face[j]].n)).toBe(1);
        }
      }
      expect(seen.size).toBe(4);
    }
    expect(crossFace).toBe(6 * 4 * n);
  });
  it("vertices: 4 stones round each, 3 at the cube's corners", () => {
    for (const n of [2, 3, 4]) {
      const g = cubeGeom(n);
      const sizes = g.vtiles.map(t => t.length);
      expect(sizes.filter(s => s === 3)).toHaveLength(8);
      expect(sizes.filter(s => s === 4)).toHaveLength(g.vertices - 8);
      expect(g.vertices).toBe(6 * n * n + 2); // Euler: V − E + F = 2 with E = 2F
    }
  });
  it("flipping one vertex toggles a closed cycle of joins", () => {
    const g = cubeGeom(3);
    for (let v = 0; v < g.vertices; v++) {
      const col = new Uint8Array(g.vertices); col[v] = 1;
      const m = knotFromColours(g, col);
      expect(solved(g, m)).toBe(true);
      expect(m.filter(x => x).length).toBe(g.vtiles[v].length);
      for (const k of g.vtiles[v]) expect(pop(m[k])).toBe(2);
      expect(countLoops(g, m)).toBe(1);
    }
  });
});

describe("solved and loose ends", () => {
  it("agree, and a turned stone shows its loose ends", () => {
    const g = cubeGeom(3), T = CUBE_TIERS[3];
    for (let seed = 1; seed <= 40; seed++) {
      const rng = mulberry32(seed), sol = makeKnot(T, rng);
      expect(looseEnds(g, sol)).toEqual([]);
      const cur = sol.slice(), k = cur.findIndex(x => x !== 15 && x !== 5 && x !== 10);
      cur[k] = rotCW(cur[k]);
      expect(solved(g, cur)).toBe(false);
      const ends = looseEnds(g, cur);
      expect(ends.length).toBeGreaterThan(0);
      expect(ends.some(([j]) => j === k)).toBe(true);
      const d = deal(3, sol, 30, rng);
      expect(solved(g, d.cur)).toBe(looseEnds(g, d.cur).length === 0);
    }
  });
  it("a strand running off the face edge needs a strand on the next face", () => {
    const g = cubeGeom(2), m = new Array(g.count).fill(0);
    // front face, top-right stone: a strand going north crosses onto the top face
    const k = 0 * 4 + 0 * 2 + 1, j = nbOf(g, k, N);
    expect(g.face[j]).toBe(4);
    m[k] = N | S_;
    expect(looseEnds(g, m)).toEqual(expect.arrayContaining([[k, N], [k, S_]]));
    m[j] = backOf(g, k, N) | rotCW(rotCW(backOf(g, k, N)));
    expect(looseEnds(g, m).some(([x, b]) => x === k && b === N)).toBe(false);
  });
});

describe("knot generation", () => {
  for (const t of TIERS) {
    it(`${CUBE_TIERS[t].name}: knots are closed and keep to the tier's rules`, () => {
      const T = CUBE_TIERS[t], g = cubeGeom(T.N);
      for (let seed = 1; seed <= 60; seed++) {
        const m = makeKnot(T, mulberry32(seed * 7 + t));
        expect(m).toHaveLength(g.count);
        expect(solved(g, m)).toBe(true);
        for (const x of m) expect(T.crossings ? [2, 4] : [2]).toContain(pop(x));
        const crossings = m.filter(x => x === 15).length;
        if (T.crossings) expect(crossings).toBeGreaterThanOrEqual(2);
        expect(crossings).toBeLessThanOrEqual(g.count * .2);
        expect(countLoops(g, m)).toBeLessThanOrEqual(T.N >= 4 ? 3 : 2);
        // the knot runs over every face and across face edges
        for (let f = 0; f < 6; f++) expect(m.some((x, k) => g.face[k] === f && x)).toBe(true);
      }
    });
  }
  it("is deterministic for a seeded rng", () => {
    expect(makeKnot(CUBE_TIERS[5], mulberry32(9))).toEqual(makeKnot(CUBE_TIERS[5], mulberry32(9)));
  });
});

describe("dealing a lock", () => {
  for (const t of TIERS) {
    it(`${CUBE_TIERS[t].name}: every lock is unsolved and solvable within its budget`, () => {
      const T = CUBE_TIERS[t], g = cubeGeom(T.N);
      for (let seed = 1; seed <= 80; seed++) {
        const rng = mulberry32(seed * 31 + t), sol = makeKnot(T, rng);
        for (const skill of [0, 20, 55, 100]) {
          const d = deal(t, sol, skill, rng);
          expect(solved(g, d.cur)).toBe(false);
          d.cur.forEach((c, k) => { if (sol[k] === 15) expect(c).toBe(15); });
          const moved = d.cur.filter((c, k) => c !== sol[k]).length;
          expect(moved).toBeGreaterThanOrEqual(1);
          expect(moved).toBeLessThanOrEqual(T.turned + 1);
          const need = minTurns(d.cur, sol);
          expect(d.budget).toBeGreaterThan(need);
          expect(d.orient).toBeGreaterThanOrEqual(0); expect(d.orient).toBeLessThan(24);
          const cur = d.cur.slice();
          let used = 0;
          for (let k = 0; k < cur.length; k++) {
            const s = signedSteps(cur[k], sol[k]);
            for (let i = 0; i < Math.abs(s); i++) { cur[k] = s > 0 ? rotCW(cur[k]) : rotCCW(cur[k]); used++; }
          }
          expect(used).toBe(need);
          expect(solved(g, cur)).toBe(true);
        }
      }
    });
  }
});

describe("turning the cube", () => {
  const isSigned = (m: number[]) => m.every(x => Math.abs(x) < 1e-9 || Math.abs(Math.abs(x) - 1) < 1e-9);
  it("has 24 face-square orientations", () => {
    expect(ORIENTATIONS).toHaveLength(24);
    for (const o of ORIENTATIONS) expect(isSigned(qmat(o))).toBe(true);
    const mats = new Set(ORIENTATIONS.map(o => qmat(o).map(x => Math.round(x)).join()));
    expect(mats.size).toBe(24);
  });
  it("snaps any orientation to one of the 24, and leaves those alone", () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const q = qnorm([rng() - .5, rng() - .5, rng() - .5, rng() - .5]);
      const s = snapQuat(q);
      expect(s.index).toBeGreaterThanOrEqual(0); expect(s.index).toBeLessThan(24);
      expect(isSigned(qmat(s.q))).toBe(true);
      expect(s.q[0] * q[0] + s.q[1] * q[1] + s.q[2] * q[2] + s.q[3] * q[3]).toBeGreaterThanOrEqual(Math.SQRT1_2 - 1e-9); // within 90° of rotation
    }
    ORIENTATIONS.forEach((o, i) => {
      expect(snapQuat(o).index).toBe(i);
      expect(snapQuat(qnorm(qmul(qaxis([1, 2, 3], 30), o))).index).toBe(i);
    });
  });
  it("quarter turns move the front face the way they say", () => {
    const where: Record<CubeTurn, [number, number, number]> = { left: [-1, 0, 0], right: [1, 0, 0], up: [0, -1, 0], down: [0, 1, 0], roll: [0, 0, 1], unroll: [0, 0, 1] };
    for (const t of Object.keys(TURNS) as CubeTurn[]) {
      const q = turnCube(QID, t);
      expect(qrot(q, [0, 0, 1]).map(x => Math.round(x) + 0)).toEqual(where[t]);
      expect(snapQuat(q).index).toBe(ORIENTATIONS.findIndex(o => Math.abs(qmat(o).map((x, i) => x - qmat(q)[i]).reduce((a, b) => a + Math.abs(b), 0)) < 1e-6));
    }
    // four of a kind come home
    for (const t of Object.keys(TURNS) as CubeTurn[]) {
      let q: Quat = QID; for (let i = 0; i < 4; i++) q = turnCube(q, t);
      expect(snapQuat(q).index).toBe(0);
    }
    expect(qrot(turnCube(QID, "roll"), [1, 0, 0]).map(x => Math.round(x) + 0)).toEqual([0, 1, 0]); // clockwise on screen
  });
  it("shows three faces, never all six, with the front one most square", () => {
    for (const o of ORIENTATIONS) {
      const v = visibleFaces(o);
      expect(v).toHaveLength(3);
      expect(v).toContain(frontFace(o));
      // the three are mutually adjacent (they meet at one corner)
      for (const a of v) for (const b of v) if (a !== b) expect(dot(FACES[a].n, FACES[b].n)).toBe(0);
    }
    const z = faceFacing(QID);
    expect(frontFace(QID)).toBe(0);
    expect(z[0]).toBeGreaterThan(.7);
    expect(visibleFaces(QID).sort()).toEqual([0, 1, 4]); // front, right, top
  });
  it("a drag to the right turns the front face to the right", () => {
    const q = dragCube(QID, 180, 0);
    expect(frontFace(snapQuat(q).q)).toBe(3); // the left face comes round to the front
    expect(frontFace(snapQuat(dragCube(QID, 0, -180)).q)).toBe(5); // drag up: the bottom comes to the front
  });
  it("the side bits are a clockwise cycle seen from outside", () => {
    for (let f = 0; f < 6; f++) for (const b of [N, E, S_, W]) {
      // turning a side clockwise about the outward normal gives the next side
      expect(qrot(qaxis(FACES[f].n, 90), sideVec(f, b)).map(x => Math.round(x) + 0)).toEqual(nz(sideVec(f, rotCW(b))));
    }
  });
});
