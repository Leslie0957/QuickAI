CREATE TABLE IF NOT EXISTS image_generation_quota (
    user_id text NOT NULL,
    quota_day date NOT NULL,
    used integer NOT NULL DEFAULT 0 CHECK (used BETWEEN 0 AND 10),
    PRIMARY KEY (user_id, quota_day)
);
