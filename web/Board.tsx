import { useId, useRef, useState, type KeyboardEvent } from "react";
import { coordinate, starPoints } from "../engine/board";
import type { Action, Color, Score } from "../engine/types";
import type { PublicState } from "../shared/protocol";

interface Props {
  readonly state: PublicState;
  readonly score: Score | null;
  readonly viewer: Color | null;
  readonly interactive: boolean;
  readonly dispatch: (action: Action) => void;
}

export function Board({ state, score, viewer, interactive, dispatch }: Props) {
  const { size, board } = state;
  const [focus, setFocus] = useState(Math.floor(board.length / 2));
  const [hover, setHover] = useState<number | null>(null);
  const cells = useRef(new Map<number, SVGGElement>());
  const id = useId().replace(/:/g, "");
  const dead = new Set(state.dead);
  const unit = 40, padding = 40, edge = (size - 1) * unit + padding * 2;
  const x = (point: number) => padding + (point % size) * unit;
  const y = (point: number) => padding + Math.floor(point / size) * unit;
  const canSelect = (point: number) => interactive && (state.phase === "scoring" ? !!board[point] : !board[point]);
  function select(point: number) {
    setFocus(point);
    if (canSelect(point)) dispatch({ type: state.phase === "scoring" ? "MARK_DEAD" : "PLACE", point });
  }
  function keyDown(event: KeyboardEvent<SVGGElement>, point: number) {
    const row = Math.floor(point / size), col = point % size;
    const next = event.key === "ArrowLeft" ? row * size + Math.max(0, col - 1)
      : event.key === "ArrowRight" ? row * size + Math.min(size - 1, col + 1)
      : event.key === "ArrowUp" ? Math.max(0, row - 1) * size + col
      : event.key === "ArrowDown" ? Math.min(size - 1, row + 1) * size + col
      : event.key === "Home" ? row * size : event.key === "End" ? row * size + size - 1 : null;
    if (next !== null) { event.preventDefault(); setFocus(next); cells.current.get(next)?.focus(); }
    else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(point); }
  }

  return <div className="go-board-region">
    <svg className="go-board" viewBox={`0 0 ${edge} ${edge}`} role="grid"
      aria-label={`${size} by ${size} Go board`} aria-rowcount={size} aria-colcount={size}
      aria-describedby={`${id}-help`}>
      <defs>
        <radialGradient id={`${id}-black`} cx="32%" cy="25%" r="75%"><stop stopColor="#555b59"/><stop offset="0.55" stopColor="#252b29"/><stop offset="1" stopColor="#111614"/></radialGradient>
        <radialGradient id={`${id}-white`} cx="32%" cy="25%" r="75%"><stop stopColor="#fff"/><stop offset="0.55" stopColor="#f5f4ed"/><stop offset="1" stopColor="#d6d5cb"/></radialGradient>
      </defs>
      <rect x="17" y="17" width={edge - 34} height={edge - 34} rx="5" fill="#dfb675" stroke="#a8814b"/>
      <g stroke="#4e3c26" strokeWidth="1" aria-hidden="true">
        {Array.from({ length: size }, (_, i) => <g key={i}>
          <line x1={padding} y1={padding + i * unit} x2={edge - padding} y2={padding + i * unit}/>
          <line x1={padding + i * unit} y1={padding} x2={padding + i * unit} y2={edge - padding}/>
        </g>)}
      </g>
      <g className="go-coordinates" style={{ fontSize: size === 19 ? 20 : size === 13 ? 16 : 12 }} aria-hidden="true">
        {Array.from({ length: size }, (_, i) => <g key={i}>
          <text x={padding + i * unit} y="9">{"ABCDEFGHJKLMNOPQRST"[i]}</text>
          <text x={padding + i * unit} y={edge - 5}>{"ABCDEFGHJKLMNOPQRST"[i]}</text>
          <text x="7" y={padding + i * unit}>{size - i}</text>
          <text x={edge - 7} y={padding + i * unit}>{size - i}</text>
        </g>)}
      </g>
      {starPoints(size).map(point => <circle key={point} cx={x(point)} cy={y(point)} r="3" fill="#362a1b" aria-hidden="true"/>)}
      {Array.from({ length: size }, (_, row) => <g role="row" aria-rowindex={row + 1} key={row}>
        {Array.from({ length: size }, (_, col) => {
          const point = row * size + col, stone = board[point], owner = score?.ownership[point];
          const label = `${coordinate(point, size)}: ${stone ?? "empty"}${dead.has(point) ? ", marked dead" : ""}${owner ? `, ${owner} territory` : ""}`;
          return <g key={point} role="gridcell" aria-label={label} aria-colindex={col + 1}
            aria-disabled={!canSelect(point)} tabIndex={point === focus ? 0 : -1}
            className={`go-intersection${canSelect(point) ? " go-intersection--active" : ""}`}
            ref={element => { if (element) cells.current.set(point, element); else cells.current.delete(point); }}
            onFocus={() => setFocus(point)} onKeyDown={event => keyDown(event, point)}
            onMouseEnter={() => setHover(point)} onMouseLeave={() => setHover(null)} onClick={() => select(point)}>
            <rect x={x(point) - unit / 2} y={y(point) - unit / 2} width={unit} height={unit} fill="transparent"/>
            {stone && <circle cx={x(point)} cy={y(point)} r="17.5" fill={`url(#${id}-${stone})`}
              stroke={stone === "black" ? "#111614" : "#a9a89e"} strokeWidth="0.8" opacity={dead.has(point) ? 0.55 : 1}/>}
            {!stone && hover === point && canSelect(point) && viewer && <circle cx={x(point)} cy={y(point)} r="17" fill={viewer === "black" ? "#151b18" : "#fff"} opacity="0.45"/>}
            {state.lastMove?.point === point && stone && !dead.has(point) && <circle cx={x(point)} cy={y(point)} r="5" fill="none" stroke={stone === "black" ? "#fff" : "#111"} strokeWidth="2"/>}
            {owner && <rect x={x(point) - 5} y={y(point) - 5} width="10" height="10" fill={owner === "black" ? "#111614" : "#fff"} stroke="#584731" strokeWidth="1"/>}
            {dead.has(point) && <path d={`M${x(point)-9},${y(point)-9}l18,18m0,-18l-18,18`} stroke="#9b241b" strokeWidth="3"/>}
            <rect className="go-board-focus" x={x(point) - 19} y={y(point) - 19} width="38" height="38" rx="3"/>
          </g>;
        })}
      </g>)}
    </svg>
    <p id={`${id}-help`} className="go-board-help">Arrow keys move focus. Enter or Space selects an intersection.</p>
  </div>;
}
