export const ACTION_TYPES = ["tick", "build", "resolveEvent", "repair", "research"] as const;

export const ROLES = ["engineer", "technician", "doctor", "scientist"] as const;

export const ROOM_NAME = /^[A-Za-z]{1,20}$/;

export type OnlineActionType = (typeof ACTION_TYPES)[number];
export type Role = (typeof ROLES)[number];

export type ModuleType =
  | "habitat"
  | "lifeSupport"
  | "solar"
  | "battery"
  | "greenhouse"
  | "shelter"
  | "iceMine"
  | "rockMine"
  | "storage"
  | "medbay";

export type OnlineAction =
  | { type: "tick"; ms: number }
  | { type: "build"; slot: number; module: ModuleType }
  | { type: "resolveEvent"; choice: string }
  | { type: "repair"; slot: number }
  | { type: "research"; id: "moonDust"; answer: "shield" | "brush" }
  | { type: "research"; id: "iceScout"; answer: "ice" | "rock" };

export type Player = {
  id: string;
  role: Role;
};

export type ActionRequest = {
  player: string;
  action: OnlineAction;
};

export type ActionBroadcast = {
  type: "action";
  action: OnlineAction;
};

export type PlayersBroadcast = {
  type: "players";
  players: Player[];
  hostId: string | null;
};

export type RoomEvent = ActionBroadcast | PlayersBroadcast;

export type JoinResponse = {
  playerId: string;
  role: Role;
  seed: number;
  actions: OnlineAction[];
  players: Player[];
  hostId: string | null;
};

export type ActionResponse = {
  ok: true;
};

export type ErrorResponse = {
  error: "not found" | "bad name" | "join first" | "bad action" | "not host" | "method not allowed";
};
