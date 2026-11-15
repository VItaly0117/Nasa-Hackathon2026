import { useEffect } from "react";
import type { ReactNode } from "react";
import { SessionContext } from "./context";
import type { GameSession } from "./types";

// Подключает сессию к дереву компонентов и запускает её побочные эффекты (автосохранение, поток сервера)
export function SessionProvider({ session, children }: { session: GameSession; children: ReactNode }) {
  useEffect(() => session.start(), [session]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
