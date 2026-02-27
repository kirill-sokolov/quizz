/**
 * Vitest Global Setup — runs once before all test suites.
 * Creates quiz_test database and applies all migrations.
 */
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync, readdirSync } from "fs";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAIN_DB_URL = "postgresql://wedding:wedding@wedding_db:5432/wedding";
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://wedding:wedding@wedding_db:5432/quiz_test";

export async function setup() {
  // 1. Create quiz_test database if it doesn't exist
  const mainSql = postgres(MAIN_DB_URL, { max: 1, onnotice: () => {} });
  try {
    await mainSql.unsafe("CREATE DATABASE quiz_test");
  } catch (e: unknown) {
    const msg = (e as Error).message ?? "";
    if (!msg.includes("already exists")) throw e;
  }
  await mainSql.end();

  // 2. Apply all migrations to quiz_test
  const testSql = postgres(TEST_DB_URL, { max: 1, onnotice: () => {} });
  const migrationsDir = resolve(__dirname, "../../drizzle");

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const content = readFileSync(resolve(migrationsDir, file), "utf-8");
    // drizzle uses '--> statement-breakpoint' as separator between statements
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await testSql.unsafe(stmt).catch((e: unknown) => {
        const msg = (e as Error).message ?? "";
        // Ignore errors for objects that already exist (idempotent re-runs)
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate") ||
          msg.includes("does not exist") // e.g. ADD COLUMN IF NOT EXISTS on old pg
        )
          return;
        throw e;
      });
    }
  }

  await testSql.end();
}

export async function teardown() {
  // Keep quiz_test for post-run inspection; tables are cleaned per-test
}
