import type { ActionLog, ActionStatus } from "./types";
import { isMutationType } from "./types";
import { randomUUID } from "node:crypto";
import { env } from "../../src/config/env";

export class ActionTracker {
  private actions: ActionLog[] = [];

  constructor(
    private readonly sessionId: string = randomUUID(),
    private readonly userId: string = env.CLAWBOT_USER_ID ?? "local-user",
  ) {}

  log(
    entry: Omit<ActionLog, "id" | "timestamp" | "sessionId" | "userId"> & {
      id?: string;
      timestamp?: Date;
      sessionId?: string;
      userId?: string;
    },
  ): ActionLog {
  const action: ActionLog = {
      id: entry.id ?? randomUUID(),
      timestamp: entry.timestamp ?? new Date(),

      type: entry.type,
      path: entry.path,

      sessionId: entry.sessionId ?? this.sessionId,
      userId: entry.userId ?? this.userId,

      details: { ...entry.details },
      status: entry.status,
      userApproved: entry.userApproved,

      beforeHash: entry.beforeHash,
      afterHash: entry.afterHash,

      approvedAt: entry.approvedAt,
      appliedAt: entry.appliedAt,
      error: entry.error,
    };

  this.actions.push(action);

  return action;
}

  getActions():readonly ActionLog[] {
    return this.actions;
  }

  restore(actions: readonly ActionLog[]): void {
    this.actions = actions.map((action) => ({
      ...action,
      timestamp: new Date(action.timestamp),
      approvedAt: action.approvedAt ? new Date(action.approvedAt) : undefined,
      appliedAt: action.appliedAt ? new Date(action.appliedAt) : undefined,
      details: { ...action.details },
    }));
  }

  getPendingMutations(): readonly ActionLog[] {
    return this.actions.filter(
      (action) => isMutationType(action.type) && action.status === "pending",
    );
  }

  updateStatus(
    id: string,
    status: ActionStatus,
    userApproved?: boolean,
    error?: string,
  ): void {
    const action = this.actions.find((action) => action.id === id);
    if (action) {
      action.status = status;
      if (userApproved !== undefined) {
        action.userApproved = userApproved;
      }
      if (status === "approved") {
        action.approvedAt = new Date();
      }
      if (status === "applied") {
        action.appliedAt = new Date();
      }
      if (error !== undefined) {
        action.error = error;
      }
    }
  }
}



