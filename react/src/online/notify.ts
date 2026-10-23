// "Your move" alerts while the page is open in the background: a browser notification (if the
// player allowed them) and a marker in the tab title. Closed-tab push needs a server (Blaze plan).
export const canNotify = () => typeof Notification === "function";
export const notifyPermission = (): NotificationPermission | "unsupported" => (canNotify() ? Notification.permission : "unsupported");
export async function askToNotify(): Promise<NotificationPermission | "unsupported"> {
  if (!canNotify()) return "unsupported";
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

let baseTitle: string | null = null;
export function markTitle(on: boolean, text = "Your move") {
  if (baseTitle === null) baseTitle = document.title.replace(/^● [^·]+ · /, "");
  document.title = on ? `● ${text} · ${baseTitle}` : baseTitle;
}

export function yourMoveAlert(title: string, body: string, tag: string) {
  if (!document.hidden) return;
  markTitle(true);
  if (canNotify() && Notification.permission === "granted") {
    try {
      const n = new Notification(title, { body, tag, icon: "images/cnoc.jpg" });
      n.onclick = () => { window.focus(); n.close(); };
    } catch { /* some mobile browsers only allow notifications from a service worker */ }
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => { if (!document.hidden && baseTitle !== null) markTitle(false); });
}
