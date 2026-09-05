import { describe, expect, it } from "vitest";
import { GoSession } from "../server/GoSession";
import { asTableId, asUserId } from "../shared";
import type { Action } from "../engine/types";
import type { ServerMessage, Snapshot } from "../shared/protocol";

const alice = asUserId("alice"), bob = asUserId("bob"), viewer = asUserId("viewer");
const opts = { hostUserId: alice, tableId: asTableId("test"), options: { boardSize: 9 } };
function setup(save?: unknown) {
  const session = new GoSession(opts, save);
  const messages = new Map([alice, bob, viewer].map(id => [id, [] as ServerMessage[]]));
  for (const [id, out] of messages) session.attachConnection(id, msg => out.push(msg as ServerMessage));
  expect(session.claimSeat(alice, 0, { displayName: "Alice" }).ok).toBe(true);
  expect(session.claimSeat(bob, 1, { displayName: "Bob" }).ok).toBe(true);
  expect(session.startGame(alice).ok).toBe(true);
  const snapshot = (id = alice) => messages.get(id)!.filter((m): m is Snapshot => m.type === "SNAPSHOT").at(-1)!;
  const act = (id: typeof alice, action: Action) => session.handleGameMessage(id,
    { type: "ACTION", revision: snapshot(id).revision, action });
  return { session, messages, snapshot, act };
}

describe("Go session", () => {
  it("enforces host-only start and two distinct seats", () => {
    const session = new GoSession(opts);
    expect(session.startGame(alice).ok).toBe(false);
    expect(session.claimSeat(alice, 0).ok).toBe(true);
    expect(session.claimSeat(alice, 1).ok).toBe(false);
    expect(session.claimSeat(bob, 0).ok).toBe(false);
    expect(session.claimSeat(bob, 1.5).ok).toBe(false);
    expect(session.claimSeat(bob, 1).ok).toBe(true);
    expect(session.startGame(bob).ok).toBe(false);
    expect(session.startGame(alice).ok).toBe(true);
  });
  it("projects identities and public state, rejects spectators and spoofed colors", () => {
    const { session, act, snapshot, messages } = setup();
    expect(snapshot().viewer).toBe("black"); expect(snapshot(bob).viewer).toBe("white");
    expect(snapshot(viewer).viewer).toBeNull(); expect(snapshot().state).not.toHaveProperty("positions");
    act(viewer, { type: "PLACE", point: 0 }); expect(snapshot().revision).toBe(0);
    expect(messages.get(viewer)!.at(-1)).toEqual({ type: "REJECTED", reason: "Spectators cannot play" });
    session.handleGameMessage(bob, { type: "ACTION", revision: 0, color: "black", action: { type: "PLACE", point: 0 } });
    expect(snapshot().revision).toBe(0);
    act(alice, { type: "PLACE", point: 0 });
    expect(snapshot(bob).state.board[0]).toBe("black");
  });
  it("rejects malformed and stale actions without changing saves", () => {
    const { session, act, snapshot } = setup();
    const before = session.serialize();
    for (const payload of [null, [], {}, { type: "ACTION", revision: 0, action: { type: "PLACE", point: "0" } }])
      session.handleGameMessage(alice, payload);
    expect(session.serialize()).toEqual(before);
    act(alice, { type: "PASS" }); act(bob, { type: "PASS" });
    const scoring = session.serialize();
    session.handleGameMessage(alice, { type: "ACTION", revision: 0, action: { type: "CONFIRM_SCORE" } });
    expect(session.serialize()).toEqual(scoring); expect(snapshot().state.confirmed).toEqual([]);
  });
  it("reconnects accounts and supports replacement players without resetting play", () => {
    const { session, act, snapshot, messages } = setup();
    act(alice, { type: "PLACE", point: 0 }); session.detachConnection(alice);
    session.attachConnection(alice, m => messages.get(alice)!.push(m as ServerMessage));
    expect(snapshot().state.board[0]).toBe("black"); expect(snapshot().viewer).toBe("black");
    expect(session.kickSeat(bob, 0).ok).toBe(false);
    expect(session.releaseSeat(bob, 0).ok).toBe(false);
    expect(session.kickSeat(alice, 1).ok).toBe(true);
    expect(session.claimSeat(viewer, 1).ok).toBe(true);
    act(viewer, { type: "PLACE", point: 1 }); expect(snapshot().state.board[1]).toBe("white");
  });
  it("round-trips play, scoring proposals, confirmations and finished results", () => {
    const current = setup();
    current.act(alice, { type: "PLACE", point: 0 });
    function roundTrip() {
      const save = JSON.parse(JSON.stringify(current.session.serialize()));
      const loaded = setup(save);
      expect(loaded.snapshot().state).toEqual(current.snapshot().state);
      expect(loaded.session.serialize()).toEqual(save);
      return loaded;
    }
    roundTrip();
    current.act(bob, { type: "PASS" }); current.act(alice, { type: "PASS" });
    current.act(bob, { type: "MARK_DEAD", point: 0 });
    current.act(alice, { type: "CONFIRM_SCORE" });
    const loaded = roundTrip();
    loaded.act(bob, { type: "CONFIRM_SCORE" });
    expect(loaded.session.describe().status).toBe("finished");
    current.act(bob, { type: "CONFIRM_SCORE" }); roundTrip();
  });
  it("returns to the lobby on load and does not persist account data", () => {
    const { session } = setup();
    const saved = session.serialize();
    expect(JSON.stringify(saved)).not.toMatch(/alice|bob|Alice|Bob/);
    expect(new GoSession(opts, saved).describe().status).toBe("lobby");
  });
  it("validates save versions, actions and move legality", () => {
    const saved = setup().session.serialize();
    for (const bad of [null, {}, { ...saved, schemaVersion: 2 }, { ...saved, ruleset: "other" },
      { ...saved, options: {} }, { ...saved, options: { boardSize: 10 } }, { ...saved, intents: [{ color: "white", action: { type: "PLACE", point: 0 } }] },
      { ...saved, intents: [{ color: "black", action: { type: "NOPE" } }] }]) {
      expect(() => new GoSession(opts, bad)).toThrow();
    }
  });
});
