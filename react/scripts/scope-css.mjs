// Scope a game's stylesheet so several games can share one site without their styles clashing.
//   node scripts/scope-css.mjs original.css gm-monsiv > src/games/monsiv/monsiv.css
// Every selector is placed under body.<scope>; :root/html/body become body.<scope> (so colour tokens
// live there and reach portalled dialogs); theme switches like :root[data-theme="dark"] stay on the
// root; @keyframes names get a suffix so two games can each have their own "pop".
import { readFileSync } from "node:fs";

export function scopeCss(css, scope) {
  const S = `body.${scope}`;
  const suffix = scope.replace(/^gm-/, "");
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const frames = new Set();
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)/g)) frames.add(m[1]);

  const scopeSel = sel => sel.split(",").map(raw => {
    const s = raw.trim();
    if (!s) return s;
    // :root:not([data-theme="light"]) / :root[data-theme="dark"] -> keep the root part, add the scope
    const rootPart = s.match(/^:root((?:\[[^\]]*\]|:not\([^)]*\))*)/);
    if (rootPart) {
      const rest = s.slice(rootPart[0].length).trim();
      const head = rootPart[1] ? `:root${rootPart[1]} ${S}` : S;
      return rest ? `${head} ${rest}` : head;
    }
    const hb = s.match(/^(html|body)\b(.*)$/);
    if (hb) return `${S}${hb[2]}`.trim();
    return `${S} ${s}`;
  }).join(", ");

  // Walk the blocks, recursing into @media/@supports, leaving @keyframes bodies and @font-face alone.
  let out = "", i = 0;
  function readBlock(start) { // returns index just after the matching }
    let depth = 0, j = start;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") { depth--; if (depth === 0) return j + 1; }
    }
    return j;
  }
  function walk(text) {
    let res = "", k = 0;
    while (k < text.length) {
      const open = text.indexOf("{", k);
      if (open < 0) { res += text.slice(k); break; }
      const head = text.slice(k, open);
      // find the end of this block within text
      let depth = 0, j = open;
      for (; j < text.length; j++) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") { depth--; if (depth === 0) break; }
      }
      const body = text.slice(open + 1, j);
      const h = head.trim();
      if (h.startsWith("@keyframes")) res += `${h.replace(/@keyframes\s+([\w-]+)/, (_, n) => `@keyframes ${n}-${suffix}`)} {${body}}\n`;
      else if (h.startsWith("@media") || h.startsWith("@supports") || h.startsWith("@container")) res += `${h} {\n${walk(body)}}\n`;
      else if (h.startsWith("@")) res += `${h} {${body}}\n`;
      else res += `${scopeSel(h)} {${body}}\n`;
      k = j + 1;
    }
    return res;
  }
  void readBlock; void i;
  out = walk(css);
  if (frames.size) {
    const names = [...frames].map(n => n.replace(/[-]/g, "\\-")).join("|");
    out = out.replace(new RegExp(`(animation(?:-name)?\\s*:[^;}]*?)\\b(${names})\\b(?!-${suffix})`, "g"), `$1$2-${suffix}`);
  }
  return out.replace(/\n{3,}/g, "\n\n");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [file, scope] = process.argv.slice(2);
  if (!file || !scope) { console.error("usage: node scripts/scope-css.mjs file.css gm-name"); process.exit(1); }
  process.stdout.write(scopeCss(readFileSync(file, "utf8"), scope));
}
