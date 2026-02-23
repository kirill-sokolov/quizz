import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs/api-usage");
const LOG_FILE = path.join(LOG_DIR, "cost.txt");

// Ensure log directory exists
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  console.warn("[CostLogger] Failed to create log directory:", err);
}

interface CostLogEntry {
  timestamp: string;
  provider: string;
  model: string;
  creditsUsed?: number;
  tokensPrompt?: number;
  tokensCompletion?: number;
  tokensTotal?: number;
  details?: string;
}

export function logCost(entry: CostLogEntry): void {
  try {
    const line = JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
  } catch (err) {
    console.warn("[CostLogger] Failed to write log:", err);
  }
}
