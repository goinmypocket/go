// =============================================================================
// Platform-level wire protocol. The C2S / S2C envelopes that travel
// between a browser holding table capabilities and the platform server. Game-specific
// payloads ride inside GAME_MSG / GAME_MSG_OUT and are opaque to the
// platform.
//
// Versioning: bump PLATFORM_PROTOCOL_VERSION when these envelopes
// change. Each game module versions its own protocol independently.
// =============================================================================

import type { OptionsSchema } from "./GameDefinition";
import type { GameId, SaveId, TableId, UserId } from "./ids";

export const PLATFORM_PROTOCOL_VERSION = 3;

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

// HTTP establishes a browser cookie; each command resolves its table grant.

export type ClientMessage =
  // --- Games ---
  | { type: "LIST_GAMES" }
  // --- Tables ---
  | {
      type: "CREATE_TABLE";
      gameId: GameId;
      name: string;
      displayName?: string;
      isPrivate: boolean;
      /** Host-controlled per-table toggle. Defaults to the game's
       *  static `supportsSpectators`; the host can opt out for
       *  individual tables (e.g. tournaments) without disabling the
       *  feature game-wide. Ignored when the game itself doesn't
       *  support spectators. */
      allowSpectators?: boolean;
      options: Record<string, unknown>;
    }
  | { type: "LIST_TABLES"; filter?: TableFilter }
  | { type: "OPEN_TABLE"; tableId: TableId; displayName?: string }
  | { type: "JOIN_TABLE"; tableId: TableId; seatIndex: number; kind: "player" | "spectator" }
  | { type: "LEAVE_TABLE"; tableId: TableId }
  | { type: "KICK_USER"; tableId: TableId; seatIndex: number }
  | { type: "START_GAME"; tableId: TableId }
  | { type: "DELETE_TABLE"; tableId: TableId }
  // --- Saves ---
  | {
      type: "SAVE_TABLE";
      tableId: TableId;
      name: string;
      /** When set, overwrite this existing save row (host-only,
       *  owner-gated). When omitted, a new save is created. */
      overwriteSaveId?: SaveId;
    }
  | { type: "LIST_SAVES" }
  | { type: "LOAD_TABLE"; saveId: SaveId; name: string; isPrivate: boolean }
  | { type: "DELETE_SAVE"; saveId: SaveId }
  // --- Game-specific (opaque to platform) ---
  | { type: "GAME_MSG"; tableId: TableId; payload: unknown };

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { type: "HELLO"; protocolVersion: number }
  | { type: "ERROR"; reason: string; cause?: string }
  // The browser revision changes when a table grant is replaced.
  | { type: "BROWSER_OK"; browser: { id: string; revision: number } }
  // --- Games ---
  | { type: "GAMES_LIST"; games: readonly GameInfo[] }
  // --- Tables ---
  | { type: "TABLES_LIST"; tables: readonly TableSummary[] }
  | { type: "TABLE_STATE"; table: TableState; opened?: boolean }
  | { type: "TABLE_CLOSED"; tableId: TableId; reason: string }
  // --- Saves ---
  | { type: "SAVES_LIST"; saves: readonly SaveSummary[] }
  // --- Game-specific (opaque to platform) ---
  | { type: "GAME_MSG_OUT"; tableId: TableId; payload: unknown };

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

export interface ParticipantSummary {
  readonly id: UserId;
  readonly displayName: string;
}

export interface TableFilter {
  readonly gameId?: GameId;
  readonly status?: "lobby" | "playing" | "finished";
  readonly mineOnly?: boolean;
}

export interface TableSummary {
  readonly id: TableId;
  readonly gameId: GameId;
  readonly name: string;
  readonly hostUserId: UserId;
  readonly status: "lobby" | "playing" | "finished";
  readonly playerCount: number;
  readonly maxPlayers: number;
  readonly spectatorCount: number;
  readonly isPrivate: boolean;
  readonly headline?: string;
}

export interface TableState {
  readonly id: TableId;
  readonly scopeId: string;
  readonly viewer: ParticipantSummary | null;
  readonly gameId: GameId;
  readonly name: string;
  readonly hostUserId: UserId;
  readonly status: "lobby" | "playing" | "finished";
  readonly options: Record<string, unknown>;
  /** Whether new spectators can join this table. Set at create-time by
   *  the host; orthogonal to the game module's `supportsSpectators`
   *  capability flag (which is a hard prerequisite). */
  readonly allowSpectators: boolean;
  readonly slots: readonly TableSlot[];
  /** The most recent save this table is associated with (loaded from
   *  or saved to). The host UI uses this to offer overwrite vs new
   *  on the next save. null until the first save / load. */
  readonly currentSaveId: SaveId | null;
  readonly currentSaveName: string | null;
  /** Slot indices a player can claim right now. Populated from the
   *  session's describe(). In lobby every slot is claimable; once
   *  the game has started only the seats that were actually in play
   *  remain claimable (others were never engine seats). */
  readonly playableSeatIndices: readonly number[];
}

export interface TableSlot {
  readonly seatIndex: number;
  readonly kind: "player" | "spectator";
  readonly claimedBy: ParticipantSummary | null;
  readonly displayName?: string;
}

export interface GameInfo {
  readonly id: GameId;
  readonly displayName: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly supportsSpectators: boolean;
  readonly optionsSchema: OptionsSchema;
}

export interface SaveSummary {
  readonly id: SaveId;
  readonly scopeId: string;
  readonly gameId: GameId;
  readonly name: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly summary: Record<string, unknown>;
}
