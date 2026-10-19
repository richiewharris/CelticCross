// Publish the built site at the root of the repo, which GitHub Pages serves:
// dist/index.html -> index.html, dist/assets/ -> assets/ (old assets are removed first).
// The old per-game addresses (/monsiv/, /cnoc/, ...) are small redirect pages kept in the repo.
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist"), root = resolve(here, "../..");
if (!existsSync(dist)) throw new Error("Run the build first: no dist folder.");
const top = readdirSync(dist);
const unexpected = top.filter(f => f !== "index.html" && f !== "assets");
if (unexpected.length) throw new Error(`Unexpected files in dist: ${unexpected.join(", ")}`);
rmSync(resolve(root, "assets"), { recursive: true, force: true });
cpSync(resolve(dist, "assets"), resolve(root, "assets"), { recursive: true });
cpSync(resolve(dist, "index.html"), resolve(root, "index.html"));
console.log(`Published ${dist} -> ${root} (index.html, assets/)`);
