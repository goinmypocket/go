import type { Action, Color, GoState, Score } from "../engine/types";

export interface PlatformGameContext {
  readonly userId: string;
  readonly tableId: string;
  readonly hostUserId: string;
  send(payload: unknown): void;
  subscribe(callback: (payload: unknown) => void): () => void;
}
export interface PlayerView {
  readonly color: Color;
  readonly name: string;
  readonly connected: boolean;
  readonly claimed: boolean;
}
export type PublicState = Omit<GoState, "positions">;
export interface Snapshot {
  readonly type: "SNAPSHOT";
  readonly revision: number;
  readonly status: "lobby" | "playing" | "finished";
  readonly viewer: Color | null;
  readonly players: readonly PlayerView[];
  readonly state: PublicState;
  readonly score: Score | null;
}
export type ServerMessage = Snapshot | { readonly type: "REJECTED"; readonly reason: string };
export type ClientMessage = { readonly type: "REQUEST_SNAPSHOT" }
  | { readonly type: "ACTION"; readonly revision: number; readonly action: Action };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse the untrusted wire/save action into a fresh canonical value. */
export function parseAction(value: unknown): Action | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case "PLACE": case "MARK_DEAD":
      return typeof value.point === "number" && Number.isInteger(value.point)
        ? { type: value.type, point: value.point } : null;
    case "PASS": case "CONFIRM_SCORE": case "RESUME": case "RESIGN":
      return { type: value.type };
    default: return null;
  }
}
