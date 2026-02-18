import "dotenv/config";

export const config = {
  DATABASE_URL: process.env.DATABASE_URL!,
  PORT: parseInt(process.env.PORT || "3000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  MEDIA_DIR: process.env.MEDIA_DIR || "./uploads",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};
