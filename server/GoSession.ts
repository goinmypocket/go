import { initialState, normalizeOptions, reduce, RULESET, score } from "../engine/rules";
import type { Color, GoOptions, GoState, Intent } from "../engine/types";
import type { CreateOpts, GameSession, Result, SeatOptions, SessionDescription, UserId } from "../shared";
import { isRecord, parseAction, type ServerMessage, type Snapshot } from "../shared/protocol";

export interface GoSave {
  readonly schemaVersion: 1;
  readonly ruleset: typeof RULESET;
  readonly options: GoOptions;
  readonly intents: readonly Intent[];
}

/** A table adapter. Only this class associates account identities with colors. */
export class GoSession implements GameSession<GoSave> {
  private readonly hostUserId: UserId;
  private readonly options: GoOptions;
  private state: GoState;
  private intents: Intent[] = [];
  private started = false;
  private lastActivityAt = Date.now();
  private readonly seats = new Map<number, { userId: UserId; name: string }>();
  private readonly connections = new Map<UserId, (message: unknown) => void>();

  constructor(opts: CreateOpts, save?: unknown) {
    this.hostUserId = opts.hostUserId;
    if (save !== undefined) {
      if (!isRecord(save) || save.schemaVersion !== 1 || save.ruleset !== RULESET ||
          !isRecord(save.options) || save.options.boardSize === undefined ||
          !Array.isArray(save.intents) || save.intents.length > 100_000)
        throw new Error("Invalid or unsupported Go save");
      this.options = normalizeOptions(save.options);
      this.state = initialState(this.options);
      for (const entry of save.intents) {
        if (!isRecord(entry) || (entry.color !== "black" && entry.color !== "white"))
          throw new Error("Invalid Go replay record");
        const action = parseAction(entry.action);
        if (!action) throw new Error("Invalid Go replay action");
        const intent: Intent = { color: entry.color, action };
        const result = reduce(this.state, intent);
        if (!result.ok) throw new Error(`Invalid Go replay: ${result.reason}`);
        this.state = result.state;
        this.intents.push(intent);
      }
    } else {
      this.options = normalizeOptions(opts.options);
      this.state = initialState(this.options);
    }
  }

  attachConnection(userId: UserId, send: (message: unknown) => void): void {
    this.connections.set(userId, send);
    this.broadcast();
  }

  detachConnection(userId: UserId): void {
    this.connections.delete(userId);
    this.broadcast();
  }

  claimSeat(userId: UserId, seatIndex: number, options?: SeatOptions): Result {
    if (seatIndex !== 0 && seatIndex !== 1) return { ok: false, reason: "Invalid seat" };
    const current = this.seats.get(seatIndex);
    if (current && current.userId !== userId) return { ok: false, reason: "Seat taken" };
    for (const [index, seat] of this.seats)
      if (seat.userId === userId && index !== seatIndex) return { ok: false, reason: "Already seated" };
    this.seats.set(seatIndex, { userId, name: options?.displayName?.trim().slice(0, 80) || this.colorName(seatIndex) });
    this.changed();
    return { ok: true };
  }

  releaseSeat(userId: UserId, seatIndex: number): Result {
    if (this.seats.get(seatIndex)?.userId !== userId) return { ok: false, reason: "Not your seat" };
    this.seats.delete(seatIndex);
    this.changed();
    return { ok: true };
  }

  kickSeat(callerUserId: UserId, seatIndex: number): Result {
    if (callerUserId !== this.hostUserId) return { ok: false, reason: "Only host can kick" };
    const seat = this.seats.get(seatIndex);
    if (!seat) return { ok: false, reason: "Seat empty" };
    return this.releaseSeat(seat.userId, seatIndex);
  }

  startGame(callerUserId: UserId): Result {
    if (callerUserId !== this.hostUserId) return { ok: false, reason: "Only host can start" };
    if (this.started) return { ok: false, reason: "Already started" };
    if (this.seats.size !== 2) return { ok: false, reason: "Both Black and White seats must be claimed" };
    this.started = true;
    this.changed();
    return { ok: true };
  }

  handleGameMessage(userId: UserId, payload: unknown): void {
    if (!this.connections.has(userId)) return;
    if (!isRecord(payload)) { this.reject(userId, "Invalid message"); return; }
    if (payload.type === "REQUEST_SNAPSHOT") { this.send(userId, this.snapshot(userId)); return; }
    if (!this.started) { this.reject(userId, "Game has not started"); return; }
    const color = this.colorFor(userId);
    if (!color) { this.reject(userId, "Spectators cannot play"); return; }
    const action = parseAction(payload.action);
    if (payload.type !== "ACTION" || !action) { this.reject(userId, "Invalid action"); return; }
    // A delayed second tab must not accept a different scoring proposal or play twice.
    if (payload.revision !== this.intents.length) {
      this.reject(userId, "The board changed. Review it and try again.");
      this.send(userId, this.snapshot(userId));
      return;
    }
    const intent = { color, action };
    const result = reduce(this.state, intent);
    if (!result.ok) { this.reject(userId, result.reason); return; }
    this.state = result.state;
    this.intents.push(intent);
    this.changed();
  }

  serialize(): GoSave {
    return { schemaVersion: 1, ruleset: RULESET, options: { ...this.options },
      intents: this.intents.map(intent => ({ color: intent.color, action: { ...intent.action } })) };
  }

  describe(): SessionDescription {
    return { status: !this.started ? "lobby" : this.state.phase === "finished" ? "finished" : "playing",
      playerCount: this.seats.size, maxPlayers: 2,
      spectatorCount: [...this.connections.keys()].filter(u => !this.colorFor(u)).length,
      lastActivityAt: this.lastActivityAt, playableSeatIndices: [0, 1],
      headline: `${this.state.size}×${this.state.size} · ${!this.started ? "Area scoring" : this.state.phase === "scoring" ? "Agreeing score" : this.state.result ? `${this.state.result.winner === "black" ? "Black" : "White"} wins` : `${this.state.turn === "black" ? "Black" : "White"} to play`}` };
  }

  private snapshot(userId: UserId): Snapshot {
    const { positions: _positions, ...publicState } = this.state;
    return { type: "SNAPSHOT", revision: this.intents.length, status: this.describe().status,
      viewer: this.colorFor(userId), state: structuredClone(publicState),
      score: this.state.phase === "scoring" || this.state.result?.reason === "score" ? score(this.state) : null,
      players: ([0, 1] as const).map(index => ({ color: index === 0 ? "black" : "white",
        name: this.seats.get(index)?.name ?? this.colorName(index), claimed: this.seats.has(index),
        connected: this.connections.has(this.seats.get(index)?.userId as UserId) })) };
  }

  private colorName(index: number): string { return index === 0 ? "Black" : "White"; }
  private colorFor(userId: UserId): Color | null {
    return this.seats.get(0)?.userId === userId ? "black" : this.seats.get(1)?.userId === userId ? "white" : null;
  }
  private send(userId: UserId, message: ServerMessage): void { this.connections.get(userId)?.(message); }
  private reject(userId: UserId, reason: string): void { this.send(userId, { type: "REJECTED", reason }); }
  private broadcast(): void { for (const userId of this.connections.keys()) this.send(userId, this.snapshot(userId)); }
  private changed(): void { this.lastActivityAt = Date.now(); this.broadcast(); }
}
