import {Telegraf} from "telegraf";
import { WELCOME } from "./constant.ts";
import { registerHandlers } from "./handler.ts";
import { env } from "../src/config/env";
import { logger } from "../src/logger";
import { withTelegramRetry } from "./hardening";
import { clearExpiredApprovalSessions } from "./approval-session";
import { clearExpiredPlanSessions } from "./plan-session";

export async function runTelegramBot() {
   const token=env.TELEGRAM_BOT_TOKEN;
   const ownerId=env.TELEGRAM_OWNER_ID;
   if(!token) {
      logger.error("Telegram bot token is not configured");
      return;
   }

   if(!ownerId) {
      logger.error("Telegram owner ID is not configured");
      return;
   }

   const bot = new Telegraf(token!);
   registerHandlers(bot)
   bot.catch((err, ctx) => {
         logger.error("Telegram update failed", {
            updateId: ctx.update.update_id,
            error: err instanceof Error ? err.message : String(err),
         });
   });

    await withTelegramRetry("sendWelcomeMessage", () =>
       bot.telegram.sendMessage(ownerId, WELCOME, { parse_mode: "Markdown" }),
    );

   logger.info("Sent welcome message to Telegram");

   try {
     await withTelegramRetry("launchBot", () => bot.launch());
     logger.info("Telegram bot is running");
   } catch (err) {
     logger.error("Failed to launch Telegram bot", {
       error: err instanceof Error ? err.message : String(err),
     });
     return;
   }

   const cleanupTimer = setInterval(() => {
     clearExpiredApprovalSessions();
     clearExpiredPlanSessions();
   }, 60_000);
   cleanupTimer.unref();

   await new Promise<void>((resolve) => {
      let stopped = false;
      const stop = () => {
         if (stopped) return;
         stopped = true;
         clearInterval(cleanupTimer);
         bot.stop();
         logger.info("Telegram bot stopped");
         resolve();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
   });
}
