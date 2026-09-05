import { groupAt, neighbors, positionKey } from "./board";
import type { BoardSize, Color, GoOptions, GoState, Intent, MoveResult, Score, Stone } from "./types";

export const RULESET = "area-psk-v1";
export const KOMI = 7.5;
export const opposite = (color: Color): Color => color === "black" ? "white" : "black";

export function normalizeOptions(options: Record<string, unknown>): GoOptions {
  const value = options.boardSize ?? 9;
  const size = typeof value === "string" && /^(9|13|19)$/.test(value) ? Number(value) : value;
  if (size !== 9 && size !== 13 && size !== 19) throw new Error("Board size must be 9, 13 or 19");
  return { boardSize: size as BoardSize };
}

export function initialState(options: GoOptions): GoState {
  const size = normalizeOptions({ boardSize: options.boardSize }).boardSize;
  const board: Stone[] = Array<Stone>(size * size).fill(null);
  return { size, komi: KOMI, board, turn: "black", phase: "play",
    captures: { black: 0, white: 0 }, moveNumber: 0, consecutivePasses: 0,
    lastMove: null, positions: [positionKey(board)], dead: [], confirmed: [], result: null };
}

export function score(state: GoState): Score {
  const dead = new Set(state.dead);
  const board = state.board.map((stone, point) => dead.has(point) ? null : stone);
  const stones = { black: 0, white: 0 };
  const territory = { black: 0, white: 0 };
  const ownership: Stone[] = Array<Stone>(board.length).fill(null);
  const visited = new Set<number>();
  let neutral = 0;
  board.forEach((stone, point) => {
    if (stone) { stones[stone]++; return; }
    if (visited.has(point)) return;
    const region = [point];
    const boundary = new Set<Color>();
    visited.add(point);
    for (let i = 0; i < region.length; i++) {
      for (const next of neighbors(region[i]!, state.size)) {
        const color = board[next];
        if (color) boundary.add(color);
        else if (!visited.has(next)) { visited.add(next); region.push(next); }
      }
    }
    if (boundary.size === 1) {
      const color = [...boundary][0]!;
      territory[color] += region.length;
      for (const p of region) ownership[p] = color;
    } else neutral += region.length;
  });
  return { stones, territory, ownership, neutral,
    totals: { black: stones.black + territory.black,
      white: stones.white + territory.white + state.komi } };
}

export function reduce(state: GoState, intent: Intent): MoveResult {
  const { color, action } = intent;
  if (state.phase === "finished") return { ok: false, reason: "Game is finished" };
  if (action.type === "RESIGN") return { ok: true, state: { ...state, phase: "finished",
    result: { winner: opposite(color), reason: "resignation", margin: null } } };
  if (action.type === "MARK_DEAD" || action.type === "CONFIRM_SCORE" || action.type === "RESUME") {
    if (state.phase !== "scoring") return { ok: false, reason: "Not scoring" };
    if (action.type === "RESUME") return { ok: true, state: { ...state,
      phase: "play", consecutivePasses: 0, dead: [], confirmed: [] } };
    if (action.type === "MARK_DEAD") {
      if (!validPoint(action.point, state)) return { ok: false, reason: "Invalid intersection" };
      if (!state.board[action.point]) return { ok: false, reason: "Choose a stone" };
      const group = groupAt(state.board, action.point, state.size).stones;
      const dead = new Set(state.dead);
      const remove = dead.has(action.point);
      for (const point of group) { if (remove) dead.delete(point); else dead.add(point); }
      return { ok: true, state: { ...state, dead: [...dead].sort((a, b) => a - b), confirmed: [] } };
    }
    if (state.confirmed.includes(color)) return { ok: false, reason: "Score already confirmed" };
    const confirmed = [...state.confirmed, color];
    if (confirmed.length < 2) return { ok: true, state: { ...state, confirmed } };
    const totals = score(state).totals;
    return { ok: true, state: { ...state, confirmed, phase: "finished",
      result: { winner: totals.black > totals.white ? "black" : "white",
        reason: "score", margin: Math.abs(totals.black - totals.white) } } };
  }
  if (state.phase !== "play") return { ok: false, reason: "Not in play" };
  if (state.turn !== color) return { ok: false, reason: "Not your turn" };
  if (action.type === "PASS") {
    const consecutivePasses = state.consecutivePasses + 1;
    return { ok: true, state: { ...state, turn: opposite(color), consecutivePasses,
      moveNumber: state.moveNumber + 1, lastMove: { color, point: null },
      phase: consecutivePasses === 2 ? "scoring" : "play", dead: [], confirmed: [] } };
  }
  if (!validPoint(action.point, state)) return { ok: false, reason: "Invalid intersection" };
  if (state.board[action.point]) return { ok: false, reason: "Intersection is occupied" };
  const board = [...state.board];
  board[action.point] = color;
  let captured = 0;
  for (const next of neighbors(action.point, state.size)) {
    if (board[next] !== opposite(color)) continue;
    const group = groupAt(board, next, state.size);
    if (group.liberties.size === 0) {
      captured += group.stones.size;
      for (const point of group.stones) board[point] = null;
    }
  }
  if (groupAt(board, action.point, state.size).liberties.size === 0)
    return { ok: false, reason: "Suicide is not allowed" };
  const key = positionKey(board);
  if (state.positions.includes(key)) return { ok: false, reason: "Ko: this move repeats an earlier board position" };
  return { ok: true, state: { ...state, board, turn: opposite(color),
    captures: { ...state.captures, [color]: state.captures[color] + captured },
    moveNumber: state.moveNumber + 1, consecutivePasses: 0,
    lastMove: { color, point: action.point }, positions: [...state.positions, key] } };
}

function validPoint(point: number, state: GoState): boolean {
  return Number.isInteger(point) && point >= 0 && point < state.board.length;
}
