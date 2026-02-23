ALTER TABLE "answers" ADD COLUMN "awarded_score" real;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "question_type" text DEFAULT 'choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "weight" integer DEFAULT 1 NOT NULL;