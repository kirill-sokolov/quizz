/**
 * Vitest Setup File — runs in each test worker before the test file.
 * Exports resetDb() helper; clears mock state between tests.
 */
import { afterAll, beforeEach, vi } from "vitest";
import postgres from "postgres";

const TEST_DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://wedding:wedding@wedding_db:5432/quiz_test";

let sql: ReturnType<typeof postgres> | null = null;

function getTestSql() {
  if (!sql) {
    sql = postgres(TEST_DB_URL, { max: 2, onnotice: () => {} });
  }
  return sql;
}

/** Truncate all data tables and reset identity sequences. */
export async function resetDb() {
  const db = getTestSql();
  // Order matters: child tables first, then parent tables
  await db.unsafe(
    `TRUNCATE TABLE answers, slides, teams, game_state, questions, quizzes, admins RESTART IDENTITY CASCADE`
  );
}

beforeEach(() => {
  // Reset mock call history between tests; keep mock implementations.
  vi.clearAllMocks();
});

afterAll(async () => {
  if (sql) {
    await sql.end();
    sql = null;
  }
});
