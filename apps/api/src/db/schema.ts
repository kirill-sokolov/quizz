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
  real,
} from "drizzle-orm/pg-core";

// Типы слайдов - определены здесь для использования drizzle-kit
const SLIDE_TYPES = ["video_warning", "video_intro", "question", "timer", "answer", "extra", "results", "thanks", "final"] as const;

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status", { enum: ["draft", "active", "finished", "archived"] })
    .notNull()
    .default("draft"),
  joinCode: text("join_code").unique(),
  displayedOnTv: boolean("displayed_on_tv").notNull().default(false),
  demoImageUrl: text("demo_image_url"),
  rulesImageUrl: text("rules_image_url"),
  thanksImageUrl: text("thanks_image_url"),
  finalImageUrl: text("final_image_url"),
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
  explanation: text("explanation"),
  timeLimitSec: integer("time_limit_sec").notNull().default(30),
  timerPosition: text("timer_position", {
    enum: ["center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"],
  })
    .notNull()
    .default("center"),
  questionType: text("question_type", { enum: ["choice", "text"] })
    .notNull()
    .default("choice"),
  weight: integer("weight").notNull().default(1),
});

export const slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  type: text("type", { enum: SLIDE_TYPES }).notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  videoLayout: jsonb("video_layout").$type<{ top: number; left: number; width: number; height: number } | null>(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  telegramChatId: bigint("telegram_chat_id", { mode: "bigint" }),
  isKicked: boolean("is_kicked").notNull().default(false),
  isBot: boolean("is_bot").notNull().default(false),
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
    awardedScore: real("awarded_score"),
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
      enum: SLIDE_TYPES,
    })
      .notNull()
      .default("question"),
    timerStartedAt: timestamp("timer_started_at"),
    status: text("status", { enum: ["lobby", "playing", "finished"] })
      .notNull()
      .default("lobby"),
    registrationOpen: boolean("registration_open")
      .notNull()
      .default(false),
    resultsRevealCount: integer("results_reveal_count")
      .notNull()
      .default(0),
    showBotsOnTv: boolean("show_bots_on_tv")
      .notNull()
      .default(true),
    currentSlideId: integer("current_slide_id").references(() => slides.id, { onDelete: "set null" }),
  },
  (t) => [unique().on(t.quizId)]
);

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
