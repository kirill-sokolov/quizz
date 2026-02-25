ALTER TABLE "game_state" ADD COLUMN "show_bots_on_tv" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "is_bot" boolean DEFAULT false NOT NULL;