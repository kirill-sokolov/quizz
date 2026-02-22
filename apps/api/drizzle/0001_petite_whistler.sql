ALTER TABLE "game_state" ADD COLUMN "registration_open" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "explanation" text;--> statement-breakpoint
ALTER TABLE "slides" ADD COLUMN "video_layout" jsonb;