import "dotenv/config";

export const config = {
  BOT_TOKEN: process.env.BOT_TOKEN!,
  API_URL: process.env.API_URL || "http://localhost:3000",
};

if (!config.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing. Put it in .env");
}
