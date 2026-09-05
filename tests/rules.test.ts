import { describe, expect, it } from "vitest";
import { coordinate, groupAt, positionKey } from "../engine/board";
import { initialState, normalizeOptions, reduce, score } from "../engine/rules";
import type { Action, Color, GoState } from "../engine/types";

function play(state: GoState, action: Action, color = state.turn): GoState {
  const result = reduce(state, { color, action });
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}
function position(rows: string[], turn: Color = "black"): GoState {
  const state = initialState({ boardSize: 9 });
  const board = [...state.board];
  rows.forEach((row, y) => [...row].forEach((cell, x) => {
    board[y * 9 + x] = cell === "b" ? "black" : cell === "w" ? "white" : null;
  }));
  return { ...state, board, turn, positions: [positionKey(board)] };
}

describe("Go rules", () => {
  it.each([9, 13, 19] as const)("initializes %i×%i with Black first and 7.5 komi", size => {
    const state = initialState({ boardSize: size });
    expect(state.board).toHaveLength(size * size);
    expect(state.turn).toBe("black");
    expect(state.komi).toBe(7.5);
    expect(normalizeOptions({ boardSize: String(size) })).toEqual({ boardSize: size });
  });
  it.each([0, 10, 9.5, true, "9x", [], NaN])("rejects invalid board size %s", boardSize => {
    expect(() => normalizeOptions({ boardSize })).toThrow();
  });
  it("uses orthogonal groups and unique liberties", () => {
    const state = position(["bb", "b.b"]);
    const group = groupAt(state.board, 0, 9);
    expect(group.stones.size).toBe(3);
    expect(group.liberties.size).toBe(3);
    expect(group.stones.has(11)).toBe(false);
  });
  it("captures an edge group and preserves its input", () => {
    const corner = position(["wb"]);
    const before = structuredClone(corner);
    const next = play(corner, { type: "PLACE", point: 9 });
    expect(next.board[0]).toBeNull();
    expect(next.captures.black).toBe(1);
    expect(corner).toEqual(before);
  });
  it("captures multiple adjacent opposing groups at once", () => {
    const state = position([".b.b", "bwbw", ".b.b"]);
    // Two white stones at B8/D8 share C8 as their last liberty.
    const board = [...state.board]; board[11] = null; board[13] = "black";
    const next = play({ ...state, board }, { type: "PLACE", point: 11 });
    expect(next.captures.black).toBe(2);
    expect(next.board[10]).toBeNull(); expect(next.board[12]).toBeNull();
  });
  it("captures a multi-stone group only once when touched on two sides", () => {
    const state = position(["bwwb", "bw.b", ".bb"]);
    const next = play(state, { type: "PLACE", point: 11 });
    expect(next.captures.black).toBe(3);
  });
  it("checks suicide after capture", () => {
    const state = position([".wb", "wb", "b"]);
    const next = play(state, { type: "PLACE", point: 0 });
    expect(next.captures.black).toBe(2);
    expect(next.board[0]).toBe("black");
    const suicide = position([".w", "w"]);
    expect(reduce(suicide, { color: "black", action: { type: "PLACE", point: 0 } }))
      .toEqual({ ok: false, reason: "Suicide is not allowed" });
  });
  it("rejects occupied, out-of-bounds, fractional and wrong-turn moves", () => {
    const state = position(["b"]);
    for (const point of [-1, 81, 1.2, Infinity, NaN, 0]) {
      expect(reduce(state, { color: "black", action: { type: "PLACE", point } }).ok).toBe(false);
    }
    expect(reduce(state, { color: "white", action: { type: "PASS" } }).ok).toBe(false);
  });
  it("enforces immediate ko and preserves ko across scoring/resumption", () => {
    const state = position([".bw", "bw.w", ".bw"]);
    const taken = play(state, { type: "PLACE", point: 11 });
    expect(taken.board[10]).toBeNull();
    expect(reduce(taken, { color: "white", action: { type: "PLACE", point: 10 } }))
      .toEqual({ ok: false, reason: "Ko: this move repeats an earlier board position" });
    const scoring = play(play(taken, { type: "PASS" }), { type: "PASS" });
    const resumed = play(scoring, { type: "RESUME" }, "black");
    expect(resumed.turn).toBe("white");
    expect(reduce(resumed, { color: "white", action: { type: "PLACE", point: 10 } }).ok).toBe(false);
    const threat = play(taken, { type: "PLACE", point: 80 });
    const response = play(threat, { type: "PLACE", point: 79 });
    expect(play(response, { type: "PLACE", point: 10 }).captures.white).toBe(1);
  });
  it("checks older positions, not only the previous position", () => {
    const state = initialState({ boardSize: 9 });
    const next = play(state, { type: "PLACE", point: 40 });
    const history = { ...state, positions: [positionKey(next.board), positionKey(state.board), "unrelated"] };
    expect(reduce(history, { color: "black", action: { type: "PLACE", point: 40 } }).ok).toBe(false);
    expect(play(history, { type: "PASS" }).consecutivePasses).toBe(1);
  });
  it("resets passes on placement and enters agreement after two passes", () => {
    const state = initialState({ boardSize: 9 });
    const placed = play(play(state, { type: "PASS" }), { type: "PLACE", point: 40 });
    expect(placed.consecutivePasses).toBe(0);
    const scoring = play(play(placed, { type: "PASS" }), { type: "PASS" });
    expect(scoring.phase).toBe("scoring");
    expect(reduce(scoring, { color: scoring.turn, action: { type: "PLACE", point: 41 } }).ok).toBe(false);
  });
  it("marks entire groups, resets confirmations and supports resumption", () => {
    const state = { ...position(["bb", "..w"]), phase: "scoring" as const };
    const accepted = play(state, { type: "CONFIRM_SCORE" }, "white");
    const marked = play(accepted, { type: "MARK_DEAD", point: 0 });
    expect(marked.dead).toEqual([0, 1]); expect(marked.confirmed).toEqual([]);
    expect(play(marked, { type: "MARK_DEAD", point: 1 }).dead).toEqual([]);
    const resumed = play(marked, { type: "RESUME" }, "white");
    expect(resumed.board).toEqual(state.board); expect(resumed.phase).toBe("play");
    expect(resumed.dead).toEqual([]); expect(resumed.positions).toEqual(state.positions);
  });
  it("scores stones and exclusive territory, not captures or mixed regions", () => {
    const state = position([".bw", "b.w"]);
    const tally = score({ ...state, captures: { black: 99, white: 99 } });
    expect(tally.stones).toEqual({ black: 2, white: 2 });
    expect(tally.territory).toEqual({ black: 1, white: 0 });
    expect(tally.totals).toEqual({ black: 3, white: 9.5 });
    expect(tally.neutral).toBe(76);
    expect(score(initialState({ boardSize: 9 })).totals).toEqual({ black: 0, white: 7.5 });
  });
  it("removes marked stones for scoring without changing the board", () => {
    const state = { ...position(["wb", "b"]), dead: [0] };
    const tally = score(state);
    expect(tally.stones.white).toBe(0);
    expect(tally.totals.black).toBe(81);
    expect(state.board[0]).toBe("white");
  });
  it("requires both confirmations of the same proposal", () => {
    let state = play(play(initialState({ boardSize: 9 }), { type: "PASS" }), { type: "PASS" });
    state = play(state, { type: "CONFIRM_SCORE" }, "black");
    expect(state.phase).toBe("scoring");
    expect(reduce(state, { color: "black", action: { type: "CONFIRM_SCORE" } }).ok).toBe(false);
    state = play(state, { type: "CONFIRM_SCORE" }, "white");
    expect(state.result).toEqual({ winner: "white", reason: "score", margin: 7.5 });
    expect(reduce(state, { color: "black", action: { type: "RESUME" } }).ok).toBe(false);
  });
  it("allows either player to resign and rejects all later actions", () => {
    const result = play(initialState({ boardSize: 9 }), { type: "RESIGN" }, "white");
    expect(result.result).toEqual({ winner: "black", reason: "resignation", margin: null });
    expect(reduce(result, { color: "black", action: { type: "PASS" } }).ok).toBe(false);
  });
  it("labels coordinates without I", () => {
    expect(coordinate(8, 9)).toBe("J9"); expect(coordinate(80, 9)).toBe("J1");
    expect(coordinate(360, 19)).toBe("T1");
  });
});
