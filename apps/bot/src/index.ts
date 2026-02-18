import { config } from "./config.js";
import { Bot } from "grammy";
import { registerStartHandlers } from "./handlers/start.js";
import { registerCaptainHandlers } from "./handlers/captain.js";
import { startWsListener } from "./ws-listener.js";

const bot = new Bot(config.BOT_TOKEN);

registerStartHandlers(bot);
registerCaptainHandlers(bot);

startWsListener(bot);

bot.catch((err) => {
  console.error("Bot error:", err.error);
});

console.log("Wedding bot is starting (long polling)...");
try {
  await bot.start();
} catch (err) {
  console.error("Bot failed to start:", err);
  process.exit(1);
}
