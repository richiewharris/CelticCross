import { beforeEach, describe, expect, it, vi } from "vitest";
import { localRaces, raceIdFrom, raceLine, seatOf, statusAfterRun, type RaceDoc, type RaceScore } from "./races";
import { NEW_RUN, failRun, finishRun, solveRun, type RaceOptions } from "../games/lock/race/engine";

// The local stand-in keeps races in localStorage; give the tests an in-memory one (and no BroadcastChannel).
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
vi.stubGlobal("BroadcastChannel", undefined);

const o: RaceOptions = { minutes: 1, kind: "dial", tier: 2, resets: "free", penalty: true, bonus: true };
const fresh = (): RaceDoc => ({
  v: 1, options: o, seed: 5, creator: "A", seats: { a: "A", b: null }, players: ["A"], names: { a: null, b: null }, status: "open",
  ready: { a: false, b: false }, runs: { a: NEW_RUN, b: NEW_RUN }, startedAt: null, next: null, createdAt: 1, updatedAt: 1,
});
const tick = () => new Promise(r => setTimeout(r, 0));

describe("race addresses and words", () => {
  it("reads a race id from the address", () => {
    expect(raceIdFrom("#/lock/race/AbCdEf123456")).toBe("AbCdEf123456");
    expect(raceIdFrom("#lock/race/AbCdEf123456/")).toBe("AbCdEf123456");
    expect(raceIdFrom("#/lock/race")).toBeNull();
    expect(raceIdFrom("#/lock/race/short")).toBeNull();
    expect(raceIdFrom("#/cnoc/play/AbCdEf123456")).toBeNull();
  });
  it("describes a race in a line", () => {
    expect(raceLine(o)).toBe("1-minute race · Bronze dial");
    expect(raceLine({ ...o, kind: "cross", tier: 5, minutes: 10 })).toBe("10-minute race · Ogham classic cross");
  });
  it("finds a player's seat", () => {
    const d = { ...fresh(), seats: { a: "A", b: "B" } };
    expect(seatOf(d, "A")).toBe("a"); expect(seatOf(d, "B")).toBe("b"); expect(seatOf(d, "C")).toBeNull(); expect(seatOf(d, null)).toBeNull();
  });
  it("ends the race when the second run finishes", () => {
    const d: RaceDoc = { ...fresh(), status: "running", runs: { a: { ...NEW_RUN, finished: true, finishedAt: 5 }, b: NEW_RUN } };
    expect(statusAfterRun(d, "b", { ...NEW_RUN, finished: true, finishedAt: 6 })).toBe("done");
    expect(statusAfterRun(d, "b", { ...NEW_RUN, solves: 1, bonus: 1 })).toBe("running");
    expect(statusAfterRun({ ...d, runs: { a: NEW_RUN, b: NEW_RUN } }, "b", { ...NEW_RUN, finished: true, finishedAt: 6 })).toBe("running");
  });
});

describe("the local race store", () => {
  beforeEach(() => mem.clear());

  it("plays a race through: create, join, ready, runs, done, rematch", async () => {
    const s = localRaces();
    const id = await s.createRace(fresh());
    const seen: (RaceDoc | null)[] = [];
    const stop = s.watchRace(id, d => seen.push(d), () => {});
    await tick();
    expect(seen.at(-1)?.status).toBe("open");

    await expect(s.setReady(id, "A")).rejects.toThrow(); // nobody to race yet
    await expect(s.joinRace(id, "A", null)).rejects.toThrow(); // the creator can't take both seats
    await s.joinRace(id, "B", "Bea");
    await expect(s.joinRace(id, "C", null)).rejects.toThrow(); // full
    expect(seen.at(-1)).toMatchObject({ status: "ready", seats: { a: "A", b: "B" }, players: ["A", "B"], names: { b: "Bea" } });

    await s.setReady(id, "A");
    expect(seen.at(-1)).toMatchObject({ status: "ready", ready: { a: true, b: false }, startedAt: null });
    await expect(s.updateRun(id, "A", { ...NEW_RUN, solves: 1, bonus: 1 })).rejects.toThrow(); // not running yet
    await s.setReady(id, "B");
    expect(seen.at(-1)?.status).toBe("running");
    expect(typeof seen.at(-1)?.startedAt).toBe("number");

    const a1 = solveRun(o, NEW_RUN, 0, 1000)!.run;
    await s.updateRun(id, "A", a1);
    await expect(s.updateRun(id, "C", a1)).rejects.toThrow(); // not a racer
    const b1 = failRun(o, NEW_RUN, 0, 1000)!.run;
    await s.updateRun(id, "B", b1);
    expect(seen.at(-1)?.runs).toEqual({ a: a1, b: b1 });

    await expect(s.endRace(id, "A")).rejects.toThrow(); // A is still racing
    const aDone = finishRun(o, a1, 0, 61000);
    await s.updateRun(id, "A", aDone);
    expect(seen.at(-1)?.status).toBe("running");
    await expect(s.updateRun(id, "A", { ...aDone, solves: 9 })).rejects.toThrow(); // frozen
    await s.updateRun(id, "B", finishRun(o, b1, 0, 50000));
    expect(seen.at(-1)?.status).toBe("done");

    await s.offerRematch(id, "B", "next1");
    await expect(s.offerRematch(id, "A", "next2")).rejects.toThrow();
    expect(seen.at(-1)?.next).toBe("next1");
    stop();
  });

  it("closes a race when the other racer went away", async () => {
    const s = localRaces();
    const id = await s.createRace(fresh());
    await s.joinRace(id, "B", null); await s.setReady(id, "A"); await s.setReady(id, "B");
    await s.updateRun(id, "A", finishRun(o, NEW_RUN, 0, 61000));
    await s.endRace(id, "A");
    let d: RaceDoc | null = null;
    s.watchRace(id, x => { d = x; }, () => {}); await tick();
    expect(d!.status).toBe("done");
  });

  it("keeps one challenge score per player, never for the racers, growing until finished", async () => {
    const s = localRaces();
    const id = await s.createRace(fresh());
    await expect(s.startScore(id, "C", null)).rejects.toThrow(); // not started yet
    await s.joinRace(id, "B", null); await s.setReady(id, "A"); await s.setReady(id, "B");
    await expect(s.startScore(id, "A", null)).rejects.toThrow(); // a racer
    let board: RaceScore[] = [];
    s.watchScores(id, x => { board = x; }, () => {});
    expect(await s.startScore(id, "C", "Cara")).toBe("started");
    expect(await s.startScore(id, "C", "Cara")).toBe("exists");
    const r = solveRun(o, NEW_RUN, 0, 1)!.run;
    await s.postScore(id, "C", r);
    await s.postScore(id, "C", finishRun(o, r, 0, 61000));
    await expect(s.postScore(id, "C", { ...r, solves: 5 })).rejects.toThrow();
    await tick();
    expect(board).toHaveLength(1);
    expect(board[0]).toMatchObject({ uid: "C", name: "Cara", solves: 1, bonus: 1, finished: true });
  });

  it("lists a player's races, newest first", async () => {
    const s = localRaces();
    const one = await s.createRace(fresh());
    const two = await s.createRace({ ...fresh(), updatedAt: 99 });
    await s.createRace({ ...fresh(), creator: "Z", seats: { a: "Z", b: null }, players: ["Z"] });
    let list: string[] = [];
    s.watchMyRaces("A", x => { list = x.map(r => r.id); }, () => {}); await tick();
    expect(list).toEqual([two, one]);
  });
});
