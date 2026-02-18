import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  bigint,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status", { enum: ["draft", "active", "finished"] })
    .notNull()
    .default("draft"),
  joinCode: text("join_code").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  orderNum: integer("order_num").notNull(),
  text: text("text").notNull().default(""),
  options: jsonb("options").$type<string[]>().notNull().default([]),
  correctAnswer: text("correct_answer").notNull().default(""),
  timeLimitSec: integer("time_limit_sec").notNull().default(30),
});

export const slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["question", "timer", "answer"] }).notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  telegramChatId: bigint("telegram_chat_id", { mode: "bigint" }),
  isKicked: boolean("is_kicked").notNull().default(false),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
});

export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.questionId, t.teamId)]
);

export const gameState = pgTable(
  "game_state",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    currentQuestionId: integer("current_question_id").references(
      () => questions.id
    ),
    currentSlide: text("current_slide", {
      enum: ["question", "timer", "answer"],
    })
      .notNull()
      .default("question"),
    timerStartedAt: timestamp("timer_started_at"),
    status: text("status", { enum: ["lobby", "playing", "finished"] })
      .notNull()
      .default("lobby"),
  },
  (t) => [unique().on(t.quizId)]
);
