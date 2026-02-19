import "dotenv/config";

export const config = {
  DATABASE_URL: process.env.DATABASE_URL!,
  PORT: parseInt(process.env.PORT || "3000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  MEDIA_DIR: process.env.MEDIA_DIR || "./uploads",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-change-in-production",
};
