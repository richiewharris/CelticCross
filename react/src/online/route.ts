// Online games live at #/<game>/play/<id>.
import { useEffect, useState } from "react";

export const onlineIdFrom = (hash: string, game: string): string | null => {
  const m = hash.match(new RegExp(`^#/?${game}/play/([A-Za-z0-9]{8,40})/?$`));
  return m ? m[1] : null;
};

export function useOnlineId(game: string): string | null {
  const [id, setId] = useState(() => onlineIdFrom(window.location.hash, game));
  useEffect(() => {
    const on = () => setId(onlineIdFrom(window.location.hash, game));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, [game]);
  return id;
}

export const onlineHash = (game: string, id: string) => `#/${game}/play/${id}`;
export const inviteUrl = (game: string, id: string) =>
  `${window.location.origin}${window.location.pathname}${window.location.search}${onlineHash(game, id)}`;
export const goOnline = (game: string, id: string) => { window.location.hash = onlineHash(game, id); };
export const leaveOnline = (game: string) => { window.location.hash = `#/${game}`; };
