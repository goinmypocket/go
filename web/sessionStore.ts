import type { Action } from "../engine/types";
import type { PlatformGameContext, Snapshot } from "../shared/protocol";
import { isRecord } from "../shared/protocol";

interface ClientState { readonly snapshot: Snapshot | null; readonly error: string | null; readonly pending: boolean }

/** Subscribes to the platform transport; the browser never owns the rules state. */
export function createSessionStore(ctx: PlatformGameContext) {
  let state: ClientState = { snapshot: null, error: null, pending: false };
  const listeners = new Set<() => void>();
  const update = (next: ClientState) => { state = next; for (const notify of listeners) notify(); };
  return {
    getSnapshot: () => state,
    subscribe: (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    connect: () => {
      const unsubscribe = ctx.subscribe(message => {
        if (!isRecord(message)) return;
        if (message.type === "SNAPSHOT") update({ snapshot: message as unknown as Snapshot, error: state.error, pending: false });
        else if (message.type === "REJECTED" && typeof message.reason === "string")
          update({ ...state, error: message.reason, pending: false });
      });
      ctx.send({ type: "REQUEST_SNAPSHOT" });
      return unsubscribe;
    },
    dispatch: (action: Action) => {
      if (!state.snapshot || state.pending) return;
      const revision = state.snapshot.revision;
      update({ ...state, pending: true, error: null });
      ctx.send({ type: "ACTION", revision, action });
    },
    dismissError: () => update({ ...state, error: null }),
  };
}
