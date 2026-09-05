import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Color } from "../engine/types";
import type { PlatformGameContext } from "../shared/protocol";
import { coordinate } from "../engine/board";
import { Board } from "./Board";
import { createSessionStore } from "./sessionStore";
import "./styles.css";

const colorName = (color: Color) => color === "black" ? "Black" : "White";

export default function PlatformApp({ ctx }: { ctx: PlatformGameContext }) {
  const store = useMemo(() => createSessionStore(ctx), [ctx]);
  const { snapshot, pending, error } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [confirmResign, setConfirmResign] = useState(false);
  useEffect(() => store.connect(), [store]);
  if (!snapshot) return <div className="go-game" role="status">Loading Go…</div>;
  const { state, viewer, score } = snapshot;
  const isPlaying = snapshot.status !== "lobby";
  const active = isPlaying && state.phase !== "finished" && viewer !== null && !pending;
  const yourTurn = active && state.phase === "play" && state.turn === viewer;
  const headline = snapshot.status === "lobby" ? "Waiting for two players"
    : state.result ? `${colorName(state.result.winner)} wins${state.result.reason === "resignation" ? " by resignation" : ` by ${state.result.margin} points`}`
    : state.phase === "scoring" ? "Agree on the score" : `${colorName(state.turn)} to play`;
  return <section className="go-game" aria-label="Go game">
    <header className="go-heading"><h1>Go</h1><p>{state.size} × {state.size} · Area scoring · Komi {state.komi}</p></header>
    <div className="go-layout">
      <Board state={state} score={score} viewer={viewer} interactive={!!(yourTurn || (active && state.phase === "scoring"))} dispatch={store.dispatch}/>
      <aside className="go-sidebar" aria-label="Players and actions">
        <div className="go-players">
          {snapshot.players.map(player => <div className="go-player" key={player.color}>
            <span className={`go-stone go-stone--${player.color}`} aria-hidden="true"/>
            <div className="go-player-name"><strong>{colorName(player.color)}</strong><span>{player.name}{viewer === player.color ? " (you)" : ""}</span>
              {!player.claimed ? <small>Seat open</small> : !player.connected ? <small>Disconnected</small> : null}</div>
            <span className="go-captures">Captures: {state.captures[player.color]}</span>
          </div>)}
        </div>
        <div className="go-status" role="status" aria-live="polite"><h2>{headline}</h2>
          <p>{viewer ? `You are ${colorName(viewer)}` : "You are spectating"} · Move {state.moveNumber}</p>
          {state.lastMove && <p className="go-last-move">{colorName(state.lastMove.color)} {state.lastMove.point === null ? "passed" : `played ${coordinate(state.lastMove.point, state.size)}`}</p>}
        </div>
        {error && <div className="go-error" role="alert"><span>{error}</span><button onClick={store.dismissError} aria-label="Dismiss error">×</button></div>}
        {snapshot.status === "lobby" ? <p>Seat 1 plays Black; seat 2 plays White. Claim seats and start using the table controls.</p> : <>
          {state.phase === "play" && <><button className="go-primary" disabled={!yourTurn} onClick={() => store.dispatch({ type: "PASS" })}>Pass</button>
            <p className="go-hint">{viewer === null ? "Watch both players build their territories." : yourTurn ? "Select an empty intersection to place a stone." : "Waiting for your opponent’s move."}</p></>}
          {score && <div className="go-score">
            {state.phase === "scoring" && <p>Mark dead groups on the board, then both players confirm. Disagree? Resume play.</p>}
            <table><caption>{state.phase === "scoring" ? "Proposed score" : "Final score"}</caption><thead><tr><th scope="col">Area</th><th scope="col">Black</th><th scope="col">White</th></tr></thead>
              <tbody><tr><th scope="row">Stones</th><td>{score.stones.black}</td><td>{score.stones.white}</td></tr>
              <tr><th scope="row">Territory</th><td>{score.territory.black}</td><td>{score.territory.white}</td></tr>
              <tr><th scope="row">Komi</th><td>0</td><td>{state.komi}</td></tr>
              <tr className="go-total"><th scope="row">Total</th><td>{score.totals.black}</td><td>{score.totals.white}</td></tr></tbody></table>
            <p className="go-hint">{score.neutral} neutral points · Captures are not extra points.</p>
            {state.phase === "scoring" && <><p>{(["black", "white"] as const).map(color => `${colorName(color)}: ${state.confirmed.includes(color) ? "confirmed" : "not confirmed"}`).join(" · ")}</p>
              <button className="go-primary" disabled={!active || state.confirmed.includes(viewer!)} onClick={() => store.dispatch({ type: "CONFIRM_SCORE" })}>{viewer && state.confirmed.includes(viewer) ? "Score confirmed" : "Confirm score"}</button>
              <button disabled={!active} onClick={() => store.dispatch({ type: "RESUME" })}>Resume play</button></>}
          </div>}
          {state.phase !== "finished" && viewer && (confirmResign ? <div className="go-resign-confirm" role="group" aria-label="Confirm resignation">
            <p>Resign this game? {colorName(viewer === "black" ? "white" : "black")} will win.</p>
            <button className="go-danger" disabled={!active} onClick={() => { setConfirmResign(false); store.dispatch({ type: "RESIGN" }); }}>Confirm resignation</button>
            <button autoFocus onClick={() => setConfirmResign(false)}>Keep playing</button>
          </div> : <button disabled={!active} onClick={() => setConfirmResign(true)}>Resign</button>)}
        </>}
        <details className="go-rules"><summary>How to play</summary>
          <p>Black plays first. Place a stone on an empty intersection. Connected stones form a group; its adjacent empty intersections are liberties.</p>
          <p>Surround a group to capture it. You cannot leave your own group without liberties or repeat an earlier board position (positional superko).</p>
          <p>Two consecutive passes begin scoring. Mark dead groups, then agree on the score. Either player may resume play to settle a dispute.</p>
          <p>Area scoring counts surviving stones and empty intersections surrounded only by your color. Shared regions are neutral. White adds 7.5 komi.</p>
        </details>
      </aside>
    </div>
  </section>;
}
