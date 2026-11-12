// Writes one balance run into the cube: <dir>/<id>.jsonl.gz (one row per match) and <dir>/<id>.meta.json.
// The run id names the rules, the engine (a hash of its source) and the run's settings, so runs accumulate and a
// later run can name an earlier one as its base.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { resolveParams } from "../../../src/games/roth/engine/params";
import { DEFAULT_RULES, type Rules } from "../../../src/games/roth/engine/engine";

const ENGINE = fileURLToPath(new URL("../../../src/games/roth/engine/", import.meta.url));

/** A hash of the engine's source (not its tests): two runs with the same hash played under the same code. */
export function engineHash(): string {
  const h = createHash("sha256");
  for (const f of readdirSync(ENGINE).filter((f) => (f.endsWith(".ts") || f.endsWith(".json")) && f !== "insights.json").sort()) {
    h.update(f);
    h.update(readFileSync(join(ENGINE, f)));
  }
  return h.digest("hex").slice(0, 12);
}

export interface RunMeta {
  rules: unknown; seed: number; n: number; level: string; levelB: string; decks: string[];
  base: string | null; touch: { setting?: string[]; deck?: string[] } | null;
}

export function writeCubeRun(dir: string, meta: RunMeta, rows: unknown[]): string {
  mkdirSync(dir, { recursive: true });
  const engine = engineHash();
  const created = new Date().toISOString();
  const id = `${created.slice(0, 10)}-${createHash("sha256").update(JSON.stringify({ ...meta, engine, created })).digest("hex").slice(0, 8)}`;
  // every parameter's value (engine/params.ts), so each run has numeric coordinates in the rules space
  const params = resolveParams({ ...DEFAULT_RULES, ...(meta.rules as Partial<Rules>) });
  writeFileSync(join(dir, `${id}.meta.json`), JSON.stringify({ id, created, engine, matches: rows.length, ...meta, params }, null, 1) + "\n");
  writeFileSync(join(dir, `${id}.jsonl.gz`), gzipSync(rows.map((r) => JSON.stringify(r)).join("\n") + "\n"));
  return id;
}
