import {select,isCancel} from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";


const BANNER_FONT="ANSI Shadow";
const shadowColor=chalk.hex("#2b2b25");
const face=chalk.hex("#b3bcb3").bold;


function printBannerWithShadow(ascii:string)
{
    const bannerLines = ascii.replace(/\s+$/, '').split('\n');
    const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
    const rowWidth = maxLen + 2;

    for(const line of bannerLines)
    {
        console.log(shadowColor(('  ' + line).padEnd(rowWidth)));
    }

  process.stdout.write(`\x1b[${bannerLines.length}A`);
  for (const line of bannerLines) {
    console.log(face(line.padEnd(rowWidth)));
  }
  console.log();
}

export async function runwakeup()
{
    let ascii:string;

    try{
      ascii=figlet.textSync("Clawbot-ai",{font:BANNER_FONT});
    }
    catch(e)
    {
    ascii=figlet.textSync("Clawbot",{
        font:"Standard"
    });
    }
    printBannerWithShadow(ascii);

    const mode=await select({
        message:"Select a mode to wake up the Clawbot AI",
        options:[
            {value:"CLI",label:"Command Line Interface (CLI)"},
            {value:"Telegram",label:"Telegram Bot"},
        ]
    });

    if(isCancel(mode))
    {
        process.exit(0);
    }
    
    if(mode==="CLI")
    {
        console.log(chalk.dim("Starting Clawbot AI in CLI mode..."));
    }

    if(mode==="Telegram")
    {
        console.log(chalk.dim("Starting Clawbot AI in Telegram mode..."));
    }
}

