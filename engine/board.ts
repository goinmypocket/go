import type { BoardSize, Stone } from "./types";

export function neighbors(point: number, size: number): number[] {
  const row = Math.floor(point / size);
  const col = point % size;
  return [row > 0 ? point - size : -1, row < size - 1 ? point + size : -1,
    col > 0 ? point - 1 : -1, col < size - 1 ? point + 1 : -1].filter(p => p >= 0);
}

export function groupAt(board: readonly Stone[], point: number, size: number) {
  const stones = new Set<number>();
  const liberties = new Set<number>();
  const color = board[point];
  if (!color) return { stones, liberties };
  const pending = [point];
  stones.add(point);
  while (pending.length) {
    for (const next of neighbors(pending.pop()!, size)) {
      if (board[next] === null) liberties.add(next);
      else if (board[next] === color && !stones.has(next)) {
        stones.add(next);
        pending.push(next);
      }
    }
  }
  return { stones, liberties };
}

export function positionKey(board: readonly Stone[]): string {
  return board.map(s => s === "black" ? "b" : s === "white" ? "w" : ".").join("");
}

export function coordinate(point: number, size: number): string {
  return `${"ABCDEFGHJKLMNOPQRST"[point % size]}${size - Math.floor(point / size)}`;
}

export function starPoints(size: BoardSize): number[] {
  const low = size === 9 ? 2 : 3;
  const high = size - low - 1;
  const middle = (size - 1) / 2;
  if (size < 19) return [[low, low], [low, high], [high, low], [high, high], [middle, middle]]
    .map(([r, c]) => r! * size + c!);
  return [low, middle, high].flatMap(r => [low, middle, high].map(c => r * size + c));
}
