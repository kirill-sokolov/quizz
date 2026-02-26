-- Add sort_order to slides for explicit ordering (supports extra slides)
ALTER TABLE slides ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Set sort_order for existing slides based on type
UPDATE slides SET sort_order = 0 WHERE type = 'video_warning';
UPDATE slides SET sort_order = 1 WHERE type = 'video_intro';
UPDATE slides SET sort_order = 2 WHERE type = 'question';
UPDATE slides SET sort_order = 3 WHERE type = 'timer';
UPDATE slides SET sort_order = 4 WHERE type = 'answer';

-- Add current_slide_id to game_state for precise slide tracking
ALTER TABLE game_state ADD COLUMN current_slide_id integer REFERENCES slides(id) ON DELETE SET NULL;
