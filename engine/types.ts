export type Color = "black" | "white";
export type Stone = Color | null;
export type BoardSize = 9 | 13 | 19;
export interface GoOptions { readonly boardSize: BoardSize }
export type Action =
  | { readonly type: "PLACE"; readonly point: number }
  | { readonly type: "PASS" }
  | { readonly type: "MARK_DEAD"; readonly point: number }
  | { readonly type: "CONFIRM_SCORE" }
  | { readonly type: "RESUME" }
  | { readonly type: "RESIGN" };
export interface Intent { readonly color: Color; readonly action: Action }
export interface Score {
  readonly stones: Readonly<Record<Color, number>>;
  readonly territory: Readonly<Record<Color, number>>;
  readonly totals: Readonly<Record<Color, number>>;
  readonly ownership: readonly Stone[];
  readonly neutral: number;
}
export interface GameResult {
  readonly winner: Color;
  readonly reason: "score" | "resignation";
  readonly margin: number | null;
}
export interface GoState {
  readonly size: BoardSize;
  readonly komi: number;
  readonly board: readonly Stone[];
  readonly turn: Color;
  readonly phase: "play" | "scoring" | "finished";
  readonly captures: Readonly<Record<Color, number>>;
  readonly moveNumber: number;
  readonly consecutivePasses: number;
  readonly lastMove: { readonly color: Color; readonly point: number | null } | null;
  readonly positions: readonly string[];
  readonly dead: readonly number[];
  readonly confirmed: readonly Color[];
  readonly result: GameResult | null;
}
export type FailureReason = "Game is finished" | "Not your turn" | "Not in play"
  | "Not scoring" | "Invalid intersection" | "Intersection is occupied"
  | "Suicide is not allowed" | "Ko: this move repeats an earlier board position"
  | "Choose a stone" | "Score already confirmed";
export type MoveResult = { readonly ok: true; readonly state: GoState }
  | { readonly ok: false; readonly reason: FailureReason };
