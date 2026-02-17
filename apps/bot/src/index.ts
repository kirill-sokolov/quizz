import "dotenv/config";
import { Bot } from "grammy";
import { registerStartHandlers } from "./handlers/start.js";
import { registerAdminHandlers } from "./handlers/admin.js";
import { registerCaptainHandlers } from "./handlers/captain.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is missing. Put it in root .env");
}

const bot = new Bot(token);

registerStartHandlers(bot);
registerAdminHandlers(bot);
registerCaptainHandlers(bot);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

console.log("Wedding bot is starting (long polling)...");
await bot.start();
