import {Telegraf} from "telegraf";
import chalk from "chalk";
import { WELCOME } from "./constant.ts";
import { registerHandlers } from "./handler.ts";

export async function runTelegramBot() {
   const token=process.env.TELEGRAM_BOT_TOKEN;
   const ownerId=process.env.TELEGRAM_OWNER_ID;
   if(!token) {
      console.log(chalk.red("TELEGRAM_BOT_TOKEN is not set in .env file"));
      return;
   }

   if(!ownerId) {
      console.log(chalk.red("TELEGRAM_OWNER_ID is not set in .env file"));
      return;
   }

   const bot = new Telegraf(token!);
   registerHandlers(bot)

   await bot.telegram.sendMessage(ownerId!, WELCOME, {parse_mode: "Markdown"});

   console.log(chalk.green("Sent Welcome message to Telegram.\n"));

   bot.launch().then(() => {
      console.log(chalk.green("Telegram bot is running..."));
   }).catch((err) => {
      console.log(chalk.red("Failed to launch Telegram bot:", err));
   });

   await new Promise<void>((resolve) => {
      const stop = () => {
         bot.stop();
         resolve();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
   });
}
