import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState, reduce } from "@/engine";
import { createOnlineSession } from "@/session/online";
import type { Session as RoomSession } from "@/net/online";
import { createSoloSession } from "@/session/solo";
import { createStore, createValueStore, shallowEqual } from "@/session/store";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  writes: string[] = [];

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
    this.writes.push(key);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  close = vi.fn();

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }
}

function room(overrides: Partial<RoomSession> = {}): RoomSession {
  return {
    room: "TESTROOM",
    playerId: "player-one",
    role: "engineer",
    seed: 47,
    actions: [],
    players: [{ id: "player-one", role: "engineer" }],
    hostId: "player-one",
    ...overrides,
  };
}

function stubWindow() {
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout,
    clearTimeout,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockEventSource.instances = [];
});

describe("createStore", () => {
  it("dispatches changed state to subscribers, skips the same reference, and unsubscribes", () => {
    const initial = { count: 0 };
    const store = createStore(initial, (state, action: "increment" | "unchanged") =>
      action === "increment" ? { count: state.count + 1 } : state,
    );
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch("increment");
    expect(store.getState()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    store.dispatch("unchanged");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.dispatch("increment");
    expect(store.getState()).toEqual({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("createValueStore", () => {
  it("sets values directly or from an updater and skips equal values", () => {
    const store = createValueStore(2);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(3);
    store.set((value) => value + 4);
    store.set(7);

    expect(store.get()).toBe(7);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("shallowEqual", () => {
  it("compares primitives, objects, arrays, null, and key counts", () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual(1, "1")).toBe(false);
    expect(shallowEqual({ a: 1, b: "two" }, { a: 1, b: "two" })).toBe(true);
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual([1, 2], [2, 1])).toBe(false);
    expect(shallowEqual(null, null)).toBe(true);
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});

describe("createSoloSession", () => {
  it("advances the seeded game and returns a repeat-safe cleanup from start", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    stubWindow();
    const session = createSoloSession(initialState(321));

    const stop = session.start();
    expect(typeof stop).toBe("function");
    session.send({ type: "tick", ms: 750 });
    expect(session.store.getState().clockMs).toBe(750);

    stop();
    stop();
    const stopAgain = session.start();
    stopAgain();
  });

  it("autosaves no more than once every two seconds", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    stubWindow();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const session = createSoloSession(initialState(322));
    const stop = session.start();

    session.tick(100);
    vi.advanceTimersByTime(1999);
    session.tick(100);
    expect(storage.writes.filter((key) => key === "moonbase:save")).toHaveLength(0);

    vi.advanceTimersByTime(1);
    session.tick(100);
    expect(storage.writes.filter((key) => key === "moonbase:save")).toHaveLength(1);
    stop();
  });

  it("records a finished mission once and saves only while the mission is playing", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    stubWindow();
    const start = initialState(323);
    const doomed = { ...start, resources: { ...start.resources, health: 0 } };
    const session = createSoloSession(doomed);
    const stop = session.start();

    session.save();
    expect(storage.getItem("moonbase:save")).not.toBeNull();
    session.send({ type: "tick", ms: 90_000 });

    expect(session.store.getState().status).toBe("lost");
    expect(storage.getItem("moonbase:save")).toBeNull();
    expect(JSON.parse(storage.getItem("moonbase:records") ?? "[]")).toHaveLength(1);
    const recordWrites = storage.writes.filter((key) => key === "moonbase:records").length;

    session.save();
    expect(storage.writes.filter((key) => key === "moonbase:records")).toHaveLength(recordWrites);
    stop();
  });
});

describe("createOnlineSession", () => {
  it("replays room actions from the seed and applies new stream actions", () => {
    const firstAction = { type: "tick", ms: 1200 } as const;
    const seededRoom = room({ actions: [firstAction] });
    const session = createOnlineSession(seededRoom);
    const expected = reduce(initialState(seededRoom.seed), firstAction);
    expect(session.store.getState()).toEqual(expected);

    vi.stubGlobal("EventSource", MockEventSource);
    stubWindow();
    const stop = session.start();
    MockEventSource.instances[0].onmessage?.({
      data: JSON.stringify({ type: "action", action: { type: "tick", ms: 500 } }),
    } as MessageEvent);
    expect(session.store.getState()).toEqual(reduce(expected, { type: "tick", ms: 500 }));
    stop();
  });

  it("batches ticks in groups of at least 500 ms", () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal("fetch", fetchMock);
    const session = createOnlineSession(room());

    session.tick(200);
    session.tick(299);
    expect(fetchMock).not.toHaveBeenCalled();

    session.tick(1);
    session.tick(300);
    session.tick(500);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).action.ms)).toEqual([500, 800]);
  });

  it("allows only the connected host to advance time", () => {
    vi.stubGlobal("EventSource", MockEventSource);
    stubWindow();
    vi.useFakeTimers();
    const host = createOnlineSession(room());
    const guest = createOnlineSession(room({ playerId: "player-two", role: "scientist" }));
    expect(host.canTick()).toBe(true);
    expect(guest.canTick()).toBe(false);

    const stop = host.start();
    MockEventSource.instances[0].onerror?.(new Event("error"));
    expect(host.canTick()).toBe(false);
    MockEventSource.instances[0].onopen?.();
    expect(host.canTick()).toBe(true);
    stop();
  });
});
