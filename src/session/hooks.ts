import { useContext, useRef, useSyncExternalStore } from "react";
import type { Action, GameState } from "@/types";
import { SessionContext } from "./context";
import type { GameSession, SessionMeta } from "./types";

export function useSession(): GameSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession вне SessionProvider");
  return session;
}

// Читает кусок состояния игры. Компонент перерисовывается, только когда выбранное значение изменилось
// (по умолчанию по ссылке, для новых объектов с теми же значениями передайте shallowEqual)
export function useGame<T>(selector: (state: GameState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const { store } = useSession();
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = () => {
    const next = selector(store.getState());
    if (cache.current && isEqual(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

// То же для связи с сервером и результата миссии
export function useMeta<T>(selector: (meta: SessionMeta) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const { meta } = useSession();
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = () => {
    const next = selector(meta.get());
    if (cache.current && isEqual(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(meta.subscribe, getSnapshot, getSnapshot);
}

export function useSend(): (action: Action) => void {
  return useSession().send;
}
