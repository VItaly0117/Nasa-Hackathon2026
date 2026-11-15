// Маленькое хранилище без зависимостей: состояние, действие, подписка. Компоненты читают его через хуки
// (session/react.tsx) и получают перерисовку только когда меняется то, что они выбрали.

export type Listener = () => void;

export type Store<S, A> = {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: Listener): () => void;
};

export function createStore<S, A>(initial: S, reduce: (state: S, action: A) => S): Store<S, A> {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduce(state, action);
      if (next === state) return; // ничего не изменилось: подписчиков не будим
      state = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

// Хранилище одного значения (например, состояние соединения)
export type ValueStore<T> = {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(listener: Listener): () => void;
};

export function createValueStore<T>(initial: T): ValueStore<T> {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next) {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
      if (Object.is(resolved, value)) return;
      value = resolved;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

// Поверхностное сравнение объектов и массивов: для выборок, которые каждый раз собирают новый объект с теми же значениями
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
