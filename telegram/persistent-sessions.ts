import fs from "node:fs";
import path from "node:path";
import type { ActionLog } from "../modes/agents/types.ts";
import type { Plan } from "../modes/plan/types.ts";

interface PersistedState {
  plans: Record<string, { plan: Plan; selected: string[]; expiresAt: number }>;
  approvals: Record<string, { pending: ActionLog[]; expiresAt: number }>;
}

const statePath = path.join(process.cwd(), ".clawbot", "telegram-sessions.json");
let state: PersistedState = { plans: {}, approvals: {} };

try {
  state = JSON.parse(fs.readFileSync(statePath, "utf8")) as PersistedState;
} catch {
  // A missing or corrupt session file starts with an empty state.
}

function save(): void {
  const directory = path.dirname(statePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
}

export function readPlanSession(chatId: number) {
  return state.plans[String(chatId)];
}

export function writePlanSession(
  chatId: number,
  session: { plan: Plan; selected: string[]; expiresAt: number },
): void {
  state.plans[String(chatId)] = session;
  save();
}

export function deletePlanSession(chatId: number): void {
  delete state.plans[String(chatId)];
  save();
}

export function readApprovalSession(chatId: number) {
  return state.approvals[String(chatId)];
}

export function writeApprovalSession(
  chatId: number,
  session: { pending: readonly ActionLog[]; expiresAt: number },
): void {
  state.approvals[String(chatId)] = {
    pending: [...session.pending],
    expiresAt: session.expiresAt,
  };
  save();
}

export function deleteApprovalSession(chatId: number): void {
  delete state.approvals[String(chatId)];
  save();
}

export function clearExpiredPersistentSessions(now = Date.now()): void {
  let changed = false;
  for (const [chatId, session] of Object.entries(state.plans)) {
    if (session.expiresAt <= now) {
      delete state.plans[chatId];
      changed = true;
    }
  }
  for (const [chatId, session] of Object.entries(state.approvals)) {
    if (session.expiresAt <= now) {
      delete state.approvals[chatId];
      changed = true;
    }
  }
  if (changed) save();
}
