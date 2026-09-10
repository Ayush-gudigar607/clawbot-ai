import type { ActionTracker } from "./action-tracker";
import {select,isCancel} from "@clack/prompts";
import chalk from "chalk";
import type {ActionLog} from "./types";
import { composeBeforeAfter, formatPatch } from "./diff-view";


interface ReviewGroup {
  label: string;
  actionIds: string[];
  patch: string | null;
}

function groupPending(pending: ActionLog[]): ReviewGroup[] {
  const byPath = new Map<string, ActionLog[]>();
  const shells: ActionLog[] = [];

  for (const a of pending) {
    if (a.type === "tool_execute") {
      shells.push(a);
      continue;
    }
    const key = a.path;
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key)!.push(a);
  }

  const groups: ReviewGroup[] = [];

  const pathEntries = [...byPath.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [p, acts] of pathEntries) {
    const sorted = acts.sort(
      (x, y) => x.timestamp.getTime() - y.timestamp.getTime(),
    );
    const ids = sorted.map((x) => x.id);

    if (sorted.every((x) => x.type === "folder_create")) {
      groups.push({
        label: `Create folder: ${p}`,
        actionIds: ids,
        patch: null,
      });
      continue;
    }

    const { before, after } = composeBeforeAfter(sorted);
    const patch = formatPatch(p, before, after);
    const kinds = [...new Set(sorted.map((x) => x.type))].join(", ");
    groups.push({ label: `${p} (${kinds})`, actionIds: ids, patch });
  }

  for (const s of shells) {
    groups.push({
      label: `Shell: ${s.details.command ?? "(no command)"}`,
      actionIds: [s.id],
      patch: null,
    });
  }

  return groups;
}

export async function runApprovalFlow(tracker: ActionTracker): Promise<boolean> {
  const pending=tracker.getPendingMutations();
  if(pending.length===0){
    console.log(chalk.green("No pending changes to review."));
    return true;
  }

  const choice=await select({
    message:"Apply staged changes?",
    options:[
      {
        value:"all",label:"Approve and apply all"
      },
      {
        value:"select",label:"Review one by one"
      },
      {
        value:"cancel",label:"Cancel"
      }
    ]
})


if(isCancel(choice)||choice==="cancel"){
  for(const action of pending){
    tracker.updateStatus(action.id,"rejected",false);
  }
  return false;
}

if(choice==="all"){
  for(const action of pending){
    tracker.updateStatus(action.id,"approved",true);
  }
  return true;
}


}