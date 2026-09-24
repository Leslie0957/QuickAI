CREATE TABLE IF NOT EXISTS public_profiles (
    user_id text PRIMARY KEY,
    display_name text NOT NULL,
    image_url text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creations_public_feed_idx
    ON creations (created_at DESC, id DESC)
    WHERE publish = true AND type = 'image';