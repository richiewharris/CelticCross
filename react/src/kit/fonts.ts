const loaded = new Set<string>();
/** Load a Google Fonts stylesheet once (call at module level in a game that needs extra fonts). */
export function loadFonts(href: string) {
  if (loaded.has(href) || typeof document === "undefined") return;
  loaded.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
