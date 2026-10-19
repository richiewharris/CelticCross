// Copy the built site into the repo's /next/ folder, which GitHub Pages serves.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "../dist"), out = resolve(here, "../../next");
if (!existsSync(dist)) throw new Error("Run the build first: no dist folder.");
rmSync(out, { recursive: true, force: true });
cpSync(dist, out, { recursive: true });
console.log(`Copied ${dist} -> ${out}`);
