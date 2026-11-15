import { createContext } from "react";
import type { GameSession } from "./types";

export const SessionContext = createContext<GameSession | null>(null);
