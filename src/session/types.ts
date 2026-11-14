import type { Action, GameState, Role } from "../types";
import type { Player } from "../net/online";
import type { GameRecord } from "./storage";
import type { Store, ValueStore } from "./store";

export type GameStore = Store<GameState, Action>;

// Что не входит в состояние игры, но нужно экрану: связь с сервером и результат одиночной миссии
export type SessionMeta = {
  connected: boolean;
  players: Player[];
  hostId: string | null;
  record: { best: GameRecord; isNew: boolean } | null;
};

export type OnlineInfo = { room: string; role: Role; playerId: string };

// Как живёт игра: одиночная (автосохранение, рекорды) или совместная (действия идут через сервер).
// Экран не знает, какая именно: он читает store и отправляет действия через send
export type GameSession = {
  store: GameStore;
  meta: ValueStore<SessionMeta>;
  online: OnlineInfo | null;
  // Действие игрока: в одиночной игре применяется сразу, в совместной уходит на сервер
  send(action: Action): void;
  // Прошло ms мс игрового времени (в совместной игре его двигает только ведущий)
  tick(ms: number): void;
  // Может ли этот клиент двигать время
  canTick(): boolean;
  // Сохраняет одиночную игру немедленно (перед выходом в меню). В совместной игре ничего не делает
  save(): void;
  // Подключает побочные эффекты (автосохранение, поток событий сервера). Возвращает отмену. Можно вызывать повторно
  start(): () => void;
};
