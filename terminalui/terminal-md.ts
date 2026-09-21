import chalk from 'chalk';
import {marked} from 'marked';
import {markedTerminal} from 'marked-terminal';

let ready=false;

function ensureMarked():void{
  if(ready){
        return;
    }
    const w=Math.max(40,Math.min(process.stdout.columns || 80,120));
    //@ts-ignore
    marked.use(markedTerminal({
        width:
        w,
        reflowText:true,
    },{}));
    ready=true;
}

export function renderTerminalMarkdown(md: string): string {
    ensureMarked();
  return marked.parse(md.trimEnd(),{
    async: false,
  })
}

export function logToolCall(toolName: string, input?: unknown): void {
  let target = "";
  if (typeof input === "object" && input !== null) {
    const inp = input as Record<string, unknown>;
    if (typeof inp.path === "string") target = inp.path;
    else if (typeof inp.query === "string") target = inp.query;
    else if (typeof inp.command === "string") target = inp.command;
    else if (typeof inp.url === "string") target = inp.url;
  }
  const detail = target ? ` ${chalk.dim(target)}` : "";
  console.log(`  ${chalk.green("✓")} ${chalk.cyan(toolName)}${detail}`);
}