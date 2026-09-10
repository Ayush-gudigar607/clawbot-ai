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
        width:w,
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