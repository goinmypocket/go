import type { GameDefinition } from "./shared";
import { asGameId } from "./shared";
import { normalizeOptions } from "./engine/rules";
import { GoSession, type GoSave } from "./server/GoSession";

export const def: GameDefinition<GoSave> = {
  id: asGameId("go"), displayName: "Go", minPlayers: 2, maxPlayers: 2, supportsSpectators: true,
  optionsSchema: [{ kind: "enum", key: "boardSize", label: "Board size", default: "9", choices: ["9", "13", "19"] }],
  normalizeOptions: options => ({ ...normalizeOptions(options) }),
  createSession: opts => new GoSession(opts),
  loadSession: (save, opts) => new GoSession(opts, save),
};
