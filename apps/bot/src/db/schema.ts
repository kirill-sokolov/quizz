import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  bigint,
  unique,
} from "drizzle-orm/pg-core";

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  joinCode: text("join_code").notNull().unique(),
  adminChatId: bigint("admin_chat_id", { mode: "number" }).notNull(),
  status: text("status", { enum: ["waiting", "active", "finished"] })
    .notNull()
    .default("waiting"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id),
    teamNumber: integer("team_number").notNull(),
    captainChatId: bigint("captain_chat_id", { mode: "number" }).notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.gameId, t.teamNumber)]
);
