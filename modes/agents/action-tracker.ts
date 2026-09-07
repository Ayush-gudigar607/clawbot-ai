import type { ActionLog, ActionStats } from "./types";
import { isMutationType } from "./types";

export class ActionTracker {
  private actions: ActionLog[] = [];

  log(
    entry: Omit<ActionLog, "id" | "timestamp"> & {
      id?: string;
      timestamp?: Date;
    },
  ): ActionLog {
    const action: ActionLog = {
      id: entry.id ?? `action_${this.actions.length}`,
      timestamp: entry.timestamp ?? new Date(),
      type: entry.type,
      path: entry.path,
      details: { ...entry.details },
      status: entry.status,
      userApproved: entry.userApproved,
    };
    this.actions.push(action);
    return action;
  }

  getActions():readonly ActionLog[] {
    return this.actions;
  }

  getPendingMutations(): readonly ActionLog[] {
    return this.actions.filter(
      (action) => isMutationType(action.type) && action.status === "pending",
    );
  }

  updateStatus(id: String, status: ActionStats, userApproved?: boolean): void {
    const action = this.actions.find((action) => action.id === id);
    if (action) {
      action.status = status;
      if (userApproved !== undefined) {
        action.userApproved = userApproved;
      }
    }
  }
}



