import {Command} from "commander"
import { runwakeup } from "./terminalui/wakeup";

const program=new Command();

program.name("clawbot-ai").description("A CLI tool for Clawbot AI").version("0.1.0");

//program to run the wakeup using the wakeup build in function
program.command("wakeup").description("Wake up the Clawbot AI").action(async ()=>{
   await runwakeup();
});

program.parseAsync(process.argv);